import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { access, chmod, constants, copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  // Keep existing output while building. Concurrent workflow restarts can
  // overlap during the native Rust build; clearing dist here can delete the
  // entry bundle another build has already emitted.

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
  await copyFile(
    path.resolve(artifactDir, "src/lib/parasolidPreviewWorker.py"),
    path.join(distDir, "parasolidPreviewWorker.py"),
  );

  const nativeSourceDir = path.resolve(artifactDir, "native/cadconvert");
  const nativeTargetDir = path.join(nativeSourceDir, "target/release");
  const nativeBinaries = [
    path.join(nativeTargetDir, "cadconvert"),
    path.join(nativeTargetDir, "cadprogressive"),
  ];
  const nativeBuildMarker = path.join(nativeTargetDir, ".api-build-input-hash");
  const nativeInputs = await hashNativeInputs(nativeSourceDir);
  const binariesExist = await Promise.all(nativeBinaries.map(fileExists));
  let nativeBuildIsCurrent = binariesExist.every(Boolean);

  if (nativeBuildIsCurrent) {
    try {
      nativeBuildIsCurrent = (await readFile(nativeBuildMarker, "utf8")).trim() === nativeInputs.hash;
    } catch {
      // Older workspaces have no marker. Trust existing binaries only if none
      // of their source inputs is newer, then seed the content-based marker.
      const binaryStats = await Promise.all(nativeBinaries.map((binary) => stat(binary)));
      nativeBuildIsCurrent = binaryStats.every((binary) => binary.mtimeMs >= nativeInputs.newestInputMtime);
      if (nativeBuildIsCurrent) await writeFile(nativeBuildMarker, nativeInputs.hash);
    }
  }

  if (!nativeBuildIsCurrent) {
    try {
      // The build image has no Rust toolchain by default. Install a minimal
      // one so the CAD converter (Parasolid/STEP -> progressive tiles) can be
      // built: without it a 1 GB X_T file cannot be previewed at all.
      if (!existsSync(join(homedir(), ".cargo/bin/cargo"))) {
        try {
          execFileSync(
            "curl",
            ["-sSf", "https://sh.rustup.rs", "-o", join(tmpdir(), "rustup-init.sh")],
            { stdio: "inherit" },
          );
          execFileSync(
            "sh",
            [join(tmpdir(), "rustup-init.sh"), "-y", "--default-toolchain", "stable", "--profile", "minimal"],
            { stdio: "inherit" },
          );
        } catch (installError) {
          console.warn(
            `Could not install a Rust toolchain (${installError?.message ?? "unknown"}). The CAD preview converter will be unavailable.`,
          );
        }
      }
      execFileSync(
        "cargo",
        [
          "build",
          "--release",
          "--locked",
          "--package",
          "cad-cli",
          "--bin",
          "cadconvert",
          "--bin",
          "cadprogressive",
        ],
        {
          cwd: nativeSourceDir,
          stdio: "inherit",
          env: {
            ...process.env,
            PATH: `${join(homedir(), ".cargo", "bin")}:${process.env.PATH ?? ""}`,
            CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS ?? "2",
          },
        },
      );
      if ((await Promise.all(nativeBinaries.map(fileExists))).every(Boolean)) {
        await writeFile(nativeBuildMarker, nativeInputs.hash);
      }
    } catch (err) {
      // Render's Node image has no Rust toolchain. The Parasolid preview
      // endpoint needs these binaries, but the rest of the API does not.
      if (err?.code !== "ENOENT") throw err;
      console.warn(
        "cargo not found — skipping native cadconvert binaries (parasolid preview will be unavailable)",
      );
    }
  }
  const nativeDistDir = path.join(distDir, "native");
  await mkdir(nativeDistDir, { recursive: true });
  await copyIfExists(
    path.join(nativeSourceDir, "target/release/cadconvert"),
    path.join(nativeDistDir, "cadconvert"),
  );
  await copyIfExists(
    path.join(nativeSourceDir, "target/release/cadprogressive"),
    path.join(nativeDistDir, "cadprogressive"),
  );
}

async function hashNativeInputs(rootDir) {
  const hash = createHash("sha256");
  let newestInputMtime = 0;

  async function visit(directory) {
    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entry.isDirectory() && (entry.name === "target" || entry.name === ".git")) continue;
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(filePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const [contents, metadata] = await Promise.all([readFile(filePath), stat(filePath)]);
      hash.update(path.relative(rootDir, filePath));
      hash.update("\0");
      hash.update(contents);
      newestInputMtime = Math.max(newestInputMtime, metadata.mtimeMs);
    }
  }

  await visit(rootDir);
  return { hash: hash.digest("hex"), newestInputMtime };
}

async function fileExists(filePath) {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(source, destination) {
  try {
    await access(source, constants.R_OK);
  } catch {
    console.warn(`Skipping missing native binary: ${source}`);
    return;
  }
  await copyFile(source, destination);
  await chmod(destination, 0o755);
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
