import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildCadDockerArgs,
  cadContentType,
  isCadFileExtension,
  scanCadOutputDirectory,
} from "./cadPython.ts";

describe("buildCadDockerArgs", () => {
  test("locks down the sandbox and mounts /out", () => {
    const args = buildCadDockerArgs({ outDir: "/tmp/cad-out-test" });
    const joined = args.join(" ");
    assert.match(joined, /run --rm -i/);
    assert.match(joined, /--network none/);
    assert.match(joined, /--read-only/);
    assert.match(joined, /--memory/);
    assert.match(joined, /--cap-drop ALL/);
    assert.match(joined, /--security-opt no-new-privileges=true/);
    assert.match(joined, /--user 65534:65534/);
    assert.match(joined, /-v \/tmp\/cad-out-test:\/out:rw/);
    // The image must appear before the timeout command, and the script
    // reaches python on stdin (`-I -`).
    const imageIndex = args.indexOf("robotics-dashboard/cad-sandbox:latest");
    assert.ok(imageIndex > 0, "image name present");
    assert.equal(args[imageIndex + 1], "timeout");
    assert.deepEqual(args.slice(-3), ["python", "-I", "-"]);
  });

  test("image name can be overridden via PYTHON_CAD_IMAGE", async () => {
    const previous = process.env.PYTHON_CAD_IMAGE;
    process.env.PYTHON_CAD_IMAGE = "example/cad:test";
    try {
      // Re-import to pick up the env var at module scope.
      const mod = await import(`./cadPython.ts?case=${Date.now()}`);
      const args = mod.buildCadDockerArgs({ outDir: "/tmp/cad-out-x" });
      assert.ok(args.includes("example/cad:test"));
    } finally {
      process.env.PYTHON_CAD_IMAGE = previous;
    }
  });
});

describe("cadContentType / isCadFileExtension", () => {
  test("accepts the model formats we export", () => {
    for (const ext of ["stl", "step", "stp", "iges", "brep", "obj", "off", "3mf", "glb"]) {
      assert.equal(isCadFileExtension(ext), true, ext);
      assert.equal(typeof cadContentType(ext), "string", ext);
    }
  });

  test("is case-insensitive and rejects unknown extensions", () => {
    assert.equal(isCadFileExtension("STL"), true);
    assert.equal(isCadFileExtension("evil.sh"), false);
    assert.equal(cadContentType("evil.sh"), null);
    assert.equal(isCadFileExtension(""), false);
  });
});

describe("scanCadOutputDirectory", () => {
  test("collects CAD files as buffers, skipping junk", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cad-scan-"));
    try {
      await writeFile(path.join(dir, "model.stl"), Buffer.from([1, 2, 3, 4, 5]));
      await writeFile(path.join(dir, "assembly.step"), Buffer.from("ISO-10303-21;\nEND-ISO-10303-21;\n"));
      await writeFile(path.join(dir, "notes.txt"), "not a model");
      await writeFile(path.join(dir, "empty.stl"), Buffer.alloc(0));
      await mkdir(path.join(dir, "nested"), { recursive: true });
      await writeFile(path.join(dir, "nested", "ignored.stl"), Buffer.from([9, 9]));
      const files = await scanCadOutputDirectory(dir);
      const names = files.map((file) => file.name).sort();
      assert.deepEqual(names, ["assembly.step", "model.stl"]);
      const stl = files.find((file) => file.name === "model.stl");
      assert.equal(stl.extension, "stl");
      assert.equal(stl.contentType, "model/stl");
      assert.equal(stl.buffer.length, 5);
      assert.deepEqual([...stl.buffer], [1, 2, 3, 4, 5]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
