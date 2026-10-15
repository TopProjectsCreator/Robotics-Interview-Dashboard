import { describe, expect, test } from "vitest";
import { zipSync, strToU8 } from "fflate";

import { parseThreeMf, parseThreeMfModelXml } from "./threeMf";

function archive(modelXml: string, extra: Record<string, string> = {}): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types/>'),
    "_rels/.rels": strToU8('<?xml version="1.0"?><Relationships/>'),
    "3D/3dmodel.model": strToU8(modelXml),
    ...Object.fromEntries(
      Object.entries(extra).map(([name, contents]) => [name, strToU8(contents)]),
    ),
  });
}

const CUBE = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model" name="Bracket">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="10" y="0" z="0"/>
          <vertex x="0" y="10" z="0"/>
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2" color="#FF0000"/>
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1"/>
  </build>
</model>`;

describe("parseThreeMfModelXml", () => {
  test("reads vertices and triangles from a single-object model", () => {
    const model = parseThreeMfModelXml(CUBE);
    expect(model.meshes).toHaveLength(1);
    expect(model.meshes[0].positions).toEqual(new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]));
    expect(model.meshes[0].indices).toEqual(new Uint32Array([0, 1, 2]));
    expect(model.triangleCount).toBe(1);
    expect(model.names).toEqual(["Bracket"]);
  });

  test("reads per-corner colours as RGBA bytes", () => {
    const model = parseThreeMfModelXml(CUBE);
    expect(model.meshes[0].colors).toEqual(
      new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255]),
    );
  });

  test("applies build item transforms in world space", () => {
    const transformed = CUBE.replace(
      '<item objectid="1"/>',
      '<item objectid="1" transform="1 0 0 0 1 0 0 0 1 100 200 300"/>',
    );
    const model = parseThreeMfModelXml(transformed);
    // Column-major: translation lands in the last column.
    expect(Array.from(model.meshes[0].positions)).toEqual([
      100, 200, 300, 110, 200, 300, 100, 210, 300,
    ]);
  });

  test("flattens component hierarchies with nested transforms", () => {
    const assembly = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/>
        </vertices>
        <triangles><triangle v1="0" v2="1" v3="2"/></triangles>
      </mesh>
    </object>
    <object id="2" type="model">
      <components>
        <component objectid="1" transform="1 0 0 0 1 0 0 0 1 10 0 0"/>
      </components>
    </object>
    <object id="3" type="model">
      <components>
        <component objectid="2" transform="1 0 0 0 1 0 0 0 1 0 0 5"/>
      </components>
    </object>
  </resources>
  <build><item objectid="3"/></build>
</model>`;
    const model = parseThreeMfModelXml(assembly);
    expect(model.meshes).toHaveLength(1);
    expect(Array.from(model.meshes[0].positions)).toEqual([
      10, 0, 5, 11, 0, 5, 10, 1, 5,
    ]);
  });

  test("applies build items more than once when the same object is instanced", () => {
    const repeated = CUBE.replace(
      '<item objectid="1"/>',
      '<item objectid="1"/><item objectid="1" transform="1 0 0 0 1 0 0 0 1 50 0 0"/>',
    );
    const model = parseThreeMfModelXml(repeated);
    expect(model.meshes).toHaveLength(2);
    expect(model.triangleCount).toBe(2);
  });

  test("ignores components pointing at objects that are not in the file", () => {
    const dangling = CUBE.replace('<item objectid="1"/>', '<item objectid="99"/>');
    // The dangling item contributes nothing, so nothing is renderable.
    expect(() => parseThreeMfModelXml(dangling)).toThrow(/No renderable geometry/);
  });

  test("falls back to every object when <build> is missing", () => {
    const noBuild = CUBE.replace(/<build>[\s\S]*<\/build>/, "");
    const model = parseThreeMfModelXml(noBuild);
    expect(model.meshes).toHaveLength(1);
    expect(model.triangleCount).toBe(1);
  });

  test("reports the declared unit so the viewer can scale consistently", () => {
    expect(parseThreeMfModelXml(CUBE).unitScaleToMillimetres).toBe(1);
    expect(
      parseThreeMfModelXml(CUBE.replace('unit="millimeter"', 'unit="inch"'))
        .unitScaleToMillimetres,
    ).toBe(25.4);
  });

  test("stops a component cycle instead of recursing forever", () => {
    const cyclic = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/>
        </vertices>
        <triangles><triangle v1="0" v2="1" v3="2"/></triangles>
      </mesh>
      <components><component objectid="2"/></components>
    </object>
    <object id="2" type="model">
      <components><component objectid="1"/></components>
    </object>
  </resources>
  <build><item objectid="1"/></build>
</model>`;
    const model = parseThreeMfModelXml(cyclic);
    // The mesh is still read; the cycle is bounded by the depth cap.
    expect(model.meshes.length).toBeGreaterThan(0);
    expect(model.triangleCount).toBeGreaterThan(0);
  });

  test("rejects malformed XML and files without a model element", () => {
    expect(() => parseThreeMfModelXml("<model><unclosed>")).toThrow(/malformed/);
    expect(() => parseThreeMfModelXml("<other/>")).toThrow(/no model definition/);
  });

  test("rejects a model whose geometry is unusable", () => {
    const empty = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources><object id="1" type="model"><mesh><vertices/><triangles/></mesh></object></resources>
  <build><item objectid="1"/></build>
</model>`;
    expect(() => parseThreeMfModelXml(empty)).toThrow(/No renderable geometry/);
  });
});

describe("parseThreeMf", () => {
  test("reads a real archive", () => {
    const model = parseThreeMf(archive(CUBE));
    expect(model.triangleCount).toBe(1);
  });

  test("finds the model part regardless of its exact filename", () => {
    const renamed = zipSync({
      "3D/sliced-output.model": strToU8(CUBE),
    });
    expect(parseThreeMf(renamed).triangleCount).toBe(1);
  });

  test("explains an archive with no model part", () => {
    const noModel = zipSync({ "Metadata/thumbnail.png": strToU8("not a model") });
    expect(() => parseThreeMf(noModel)).toThrow(/no model file/);
  });

  test("explains a file that is not a ZIP archive at all", () => {
    expect(() => parseThreeMf(strToU8("this is not a zip"))).toThrow(
      /could not be opened as a 3MF archive/,
    );
  });

  test("ignores texture and thumbnail payloads", () => {
    const withTexture = archive(CUBE, {
      "Metadata/thumbnail.png": "fake png bytes",
      "3D/Textures/color.png": "fake texture bytes",
    });
    expect(parseThreeMf(withTexture).triangleCount).toBe(1);
  });
});
