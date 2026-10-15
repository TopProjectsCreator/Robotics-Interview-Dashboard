import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch {
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});

// Proves the quota-fallback behaviour: when the primary storage instance
// refuses (Supabase egress quota), uploads and reads transparently use the
// secondary instance instead of failing, and old objects still resolve.

function makeStorage(label, { restricted = false } = {}) {
  const calls = [];
  const fail = () => {
    if (restricted) {
      throw new Error(`Could not create Supabase storage bucket "app-uploads": Service for this project is restricted due to the following violations: exceed_egress_quota`);
    }
    return null;
  };
  const quota = () => ({ message: "Service for this project is restricted due to the following violations: exceed_egress_quota" });
  return {
    label,
    calls,
    client: {
      storage: {
        async createBucket() {
          calls.push("createBucket");
          if (restricted) return { data: null, error: quota() };
          return { data: { name: "app-uploads", file_size_limit: 50 * 1024 * 1024 }, error: null };
        },
        async getBucket() {
          calls.push("getBucket");
          if (restricted) return { data: null, error: quota() };
          return { data: { name: "app-uploads", file_size_limit: 50 * 1024 * 1024 }, error: null };
        },
        async updateBucket() { calls.push("updateBucket"); return { error: null }; },
        from() {
          const bucket = {
            async upload(path) {
              calls.push("upload:" + path);
              if (restricted) return { error: quota() };
              return { error: null };
            },
            async download(path) {
              calls.push("download:" + path);
              if (restricted) return { data: null, error: quota() };
              return { data: { arrayBuffer: async () => new TextEncoder().encode(`bytes-of-${label}:${path}`).buffer, type: "image/png" }, error: null };
            },
            async createSignedUploadUrl(path) {
              calls.push("mint:" + path);
              if (restricted) return { data: null, error: quota() };
              return { data: { signedUrl: `https://${label}.supabase.co/storage/v1/upload/sign/${path}` }, error: null };
            },
            async createSignedUrl(path) {
              calls.push("sign:" + path);
              if (restricted) return { data: null, error: quota() };
              return { data: { signedUrl: `https://${label}.supabase.co/storage/v1/sign/${path}` }, error: null };
            },
            async remove(paths) {
              calls.push("remove:" + paths.join(","));
              if (restricted) return { error: quota() };
              return { error: null };
            },
            async list() {
              calls.push("list");
              if (restricted) return { data: null, error: quota() };
              return { data: [], error: null };
            },
          };
          return bucket;
        },
      },
    },
  };
}

const primary = makeStorage("primary", { restricted: true });
const secondary = makeStorage("secondary");

let routedInstance = "primary";

mock.module("@workspace/db", {
  namedExports: {
    currentInstance: () => routedInstance,
    runWithInstance: (instance, fn) => {
      const previous = routedInstance;
      routedInstance = instance === "secondary" ? "secondary" : "primary";
      let result;
      try {
        result = fn();
      } catch (error) {
        routedInstance = previous;
        throw error;
      }
      if (result && typeof result.then === "function") {
        return result.finally(() => {
          routedInstance = previous;
        });
      }
      routedInstance = previous;
      return result;
    },
  },
});
mock.module("@supabase/supabase-js", {
  namedExports: {
    createClient: (url) => (String(url).includes("secondary") ? secondary.client : primary.client),
  },
});

process.env.SUPABASE_URL = "https://primary.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "primary-key";
process.env.SECONDARY_SUPABASE_URL = "https://secondary.supabase.co";
process.env.SECONDARY_SUPABASE_SECRET_KEY = "secondary-key";
process.env.SUPABASE_STORAGE_BUCKET = "app-uploads";
process.env.SECONDARY_SUPABASE_STORAGE_BUCKET = "app-uploads";

const { ObjectStorageService } = await import("./objectStorage.ts");

test("uploads fall back to the secondary instance when the primary is over quota", async () => {
  const path = await new ObjectStorageService().uploadChatImage(Buffer.from("img"), "image/png");

  assert.ok(path.startsWith("/objects/"), "returns an object path the client can store");
  // Objects that land on the secondary carry an instance prefix in their path
  // (/objects/secondary/<id>), so compare on the object id itself.
  const objectId = path.slice(path.lastIndexOf("/") + 1);
  assert.ok(
    secondary.calls.includes("upload:" + "uploads/" + objectId),
    "the bytes landed on the secondary instance",
  );
  assert.ok(
    primary.calls.some((c) => c === "createBucket" || c.startsWith("upload:")),
    "the primary was attempted first, so a healthy primary is still preferred",
  );
});

test("reads resolve objects written on the secondary during a primary outage", async () => {
  const downloaded = await new ObjectStorageService().downloadObject("/objects/abc-12345");

  assert.equal(downloaded.contentType, "image/png");
  assert.equal(Buffer.from(downloaded.data).toString(), "bytes-of-secondary:uploads/abc-12345");
});

test("mints signed upload URLs on the secondary when the primary refuses", async () => {
  const minted = await new ObjectStorageService().mintUpload();

  assert.equal(minted.objectPath.startsWith("/objects/"), true);
  assert.ok(minted.uploadURL.includes("secondary.supabase.co"), "signed URL points at the instance that accepted it");
});
