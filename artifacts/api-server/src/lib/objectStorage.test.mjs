import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const STORAGE_ENV = {
  SUPABASE_URL: "https://primary.storage.test",
  SUPABASE_SERVICE_ROLE_KEY: "primary-key",
  SUPABASE_STORAGE_BUCKET: "primary-bucket",
  SECONDARY_SUPABASE_URL: "https://secondary.storage.test",
  SECONDARY_SUPABASE_SECRET_KEY: "secondary-key",
  SECONDARY_SUPABASE_STORAGE_BUCKET: "secondary-bucket",
};

let importId = 0;

async function loadObjectStorage(t, { failPrimarySign = false, failPrimaryUpload = false } = {}) {
  const previousEnv = Object.fromEntries(
    Object.keys(STORAGE_ENV).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, STORAGE_ENV);
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    mock.restoreAll();
  });

  const calls = [];
  mock.module("@workspace/db", {
    namedExports: { currentInstance: () => "primary" },
  });
  mock.module("@supabase/supabase-js", {
    namedExports: {
      createClient: (url, key) => ({
        storage: {
          createBucket: async (bucket) => {
            calls.push({ operation: "createBucket", url, key, bucket });
            return { data: {}, error: null };
          },
          from: (bucket) => ({
            createSignedUploadUrl: async (path) => {
              calls.push({ operation: "sign", url, key, bucket, path });
              if (url === STORAGE_ENV.SUPABASE_URL && failPrimarySign) {
                return { data: null, error: { message: "primary signing unavailable" } };
              }
              return { data: { signedUrl: `${url}/signed/${path}` }, error: null };
            },
            upload: async (path, _data, options) => {
              calls.push({ operation: "upload", url, key, bucket, path, options });
              if (url === STORAGE_ENV.SUPABASE_URL && failPrimaryUpload) {
                return { error: { message: "primary upload unavailable" } };
              }
              return { error: null };
            },
            download: async (path) => {
              calls.push({ operation: "download", url, key, bucket, path });
              return { data: new Blob(["image-bytes"], { type: "image/png" }), error: null };
            },
            remove: async (paths) => {
              calls.push({ operation: "remove", url, key, bucket, paths });
              return { error: null };
            },
          }),
        },
      }),
    },
  });

  const module = await import(`./objectStorage.ts?test=${++importId}`);
  return { service: new module.ObjectStorageService(), calls, module };
}

test("CAD storage failover status clears after a primary write probe succeeds", async (t) => {
  const { service, calls, module } = await loadObjectStorage(t);

  assert.equal(module.getCadStorageStatus().usingBackupStorage, false);
  assert.equal(module.recordCadStorageFailover(), true);
  assert.equal(module.getCadStorageStatus().usingBackupStorage, true);
  assert.equal(module.recordCadStorageFailover(), false);

  assert.equal(await service.probePrimaryStorageWrite(), true);
  assert.ok(calls.some((call) =>
    call.operation === "upload" &&
    call.url === STORAGE_ENV.SUPABASE_URL &&
    call.bucket === "primary-bucket" &&
    call.path.startsWith("health-checks/cad-"),
  ));
  assert.ok(calls.some((call) =>
    call.operation === "remove" &&
    call.url === STORAGE_ENV.SUPABASE_URL &&
    call.paths[0].startsWith("health-checks/cad-"),
  ));

  const failoverAt = module.getCadStorageStatus().lastFailoverAt;
  assert.equal(module.recordCadStorageRecovery(failoverAt), true);
  const recovered = module.getCadStorageStatus();
  assert.equal(recovered.usingBackupStorage, false);
  assert.ok(recovered.lastRecoveryAt);
});

test("CAD storage status stays in backup mode when the primary write probe fails", async (t) => {
  const { service, module } = await loadObjectStorage(t, { failPrimaryUpload: true });
  module.recordCadStorageFailover();

  assert.equal(await service.probePrimaryStorageWrite(), false);
  assert.equal(module.getCadStorageStatus().usingBackupStorage, true);
});

test("signed CSV uploads fall back to secondary and return a secondary object path", async (t) => {
  const { service, calls } = await loadObjectStorage(t, { failPrimarySign: true });

  const result = await service.mintUpload();

  assert.match(result.uploadURL, /^https:\/\/secondary\.storage\.test\/signed\/uploads\//);
  assert.match(result.objectPath, /^\/objects\/secondary\/[A-Za-z0-9-]{8,128}$/);
  assert.ok(calls.some((call) => call.operation === "sign" &&
    call.url === STORAGE_ENV.SUPABASE_URL && call.bucket === "primary-bucket"));
  assert.ok(calls.some((call) => call.operation === "sign" &&
    call.url === STORAGE_ENV.SECONDARY_SUPABASE_URL && call.bucket === "secondary-bucket"));
});

test("generated images fall back to secondary storage", async (t) => {
  const { service, calls } = await loadObjectStorage(t, { failPrimaryUpload: true });

  const objectPath = await service.uploadGeneratedImage(Buffer.from("image-bytes"), "image/png");

  assert.match(objectPath, /^\/objects\/secondary\/generated\/[A-Za-z0-9-]{8,128}$/);
  assert.ok(calls.some((call) => call.operation === "upload" &&
    call.url === STORAGE_ENV.SUPABASE_URL && call.path.startsWith("generated/")));
  assert.ok(calls.some((call) => call.operation === "upload" &&
    call.url === STORAGE_ENV.SECONDARY_SUPABASE_URL &&
    call.bucket === "secondary-bucket" && call.path.startsWith("generated/")));
});

test("secondary object paths download and delete from secondary storage", async (t) => {
  const { service, calls } = await loadObjectStorage(t);
  const objectPath = "/objects/secondary/generated/12345678-1234-1234-1234-123456789abc";

  const downloaded = await service.downloadObject(objectPath);
  await service.deleteObject(objectPath);

  assert.equal(downloaded.data.toString(), "image-bytes");
  assert.equal(downloaded.contentType, "image/png");
  assert.ok(calls.some((call) => call.operation === "download" &&
    call.url === STORAGE_ENV.SECONDARY_SUPABASE_URL &&
    call.bucket === "secondary-bucket" &&
    call.path === "generated/12345678-1234-1234-1234-123456789abc"));
  assert.ok(calls.some((call) => call.operation === "remove" &&
    call.url === STORAGE_ENV.SECONDARY_SUPABASE_URL &&
    call.bucket === "secondary-bucket" &&
    call.paths[0] === "generated/12345678-1234-1234-1234-123456789abc"));
});
