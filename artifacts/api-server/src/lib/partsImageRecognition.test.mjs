import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { after, before, test, mock } from "node:test";
import {
  decodePartsImage,
  parsePartsImageIdentification,
  PARTS_IMAGE_MAX_BYTES,
} from "./partsImageRecognition.ts";
import { resolveFreeVisionFallback } from "./partsVisionRouting.ts";

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

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const validInput = {
  contentType: "image/png",
  imageBase64: pngBytes.toString("base64"),
};

test("image validation requires matching supported file signatures and a strict base64 payload", () => {
  assert.equal(decodePartsImage(validInput)?.contentType, "image/png");
  assert.equal(decodePartsImage({ ...validInput, contentType: "image/jpeg" }), null);
  assert.equal(decodePartsImage({ ...validInput, imageBase64: `${validInput.imageBase64}junk` }), null);

  const maxBytes = Buffer.alloc(PARTS_IMAGE_MAX_BYTES);
  pngBytes.copy(maxBytes);
  assert.equal(decodePartsImage({ ...validInput, imageBase64: maxBytes.toString("base64") })?.bytes.length, PARTS_IMAGE_MAX_BYTES);
  const overLimit = Buffer.alloc(PARTS_IMAGE_MAX_BYTES + 1);
  pngBytes.copy(overLimit);
  assert.equal(decodePartsImage({ ...validInput, imageBase64: overLimit.toString("base64") }), null);
});

test("model output parser tolerates JSON fences but rejects malformed and unidentified guesses", () => {
  const valid = {
    identified: true,
    name: "  Aluminum channel  ",
    category: "  Structure ",
    description: "  Extruded aluminum profile ",
    sku: null,
    uncertainty: "medium",
    uncertaintyReason: "The profile is visible but its series is not clear.",
    supplier: "Unverified supplier",
    productUrl: "https://example.invalid/part",
  };
  const parsed = parsePartsImageIdentification(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``);
  assert.equal(parsed?.name, "Aluminum channel");
  assert.equal("supplier" in parsed, false);
  assert.equal("productUrl" in parsed, false);
  assert.equal(parsePartsImageIdentification("not json"), null);
  assert.equal(parsePartsImageIdentification(JSON.stringify({ ...valid, name: " " })), null);
  assert.deepEqual(
    parsePartsImageIdentification(JSON.stringify({
      ...valid,
      identified: false,
      name: "should be discarded",
      sku: "guess",
      uncertainty: "high",
    })),
    {
      identified: false,
      name: "",
      category: null,
      description: null,
      sku: null,
      uncertainty: "high",
      uncertaintyReason: valid.uncertaintyReason,
    },
  );
});

const calls = { model: [], catalog: [], logs: [] };
const validModelResponse = {
  choices: [{
    message: {
      content: JSON.stringify({
        identified: true,
        name: "Aluminum channel",
        category: "Structure",
        description: "Extruded aluminum profile.",
        sku: null,
        uncertainty: "medium",
        uncertaintyReason: "The profile series is not visible.",
      }),
    },
  }],
};
let modelResponse = {
  choices: [{
    message: {
      content: JSON.stringify({
        identified: true,
        name: "Aluminum channel",
        category: "Structure",
        description: "Extruded aluminum profile.",
        sku: null,
        uncertainty: "medium",
        uncertaintyReason: "The profile series is not visible.",
      }),
    },
  }],
};
let modelError = null;
let modelSequence = [];
let modelCatalog = [];
let catalogError = null;
let importId = 0;

before(async () => {
  mock.module("@workspace/api-zod", {
    namedExports: {
      IdentifyPartsImageBody: {
        safeParse: (value) => ({
          success: Boolean(
            value &&
            ["image/jpeg", "image/png", "image/webp"].includes(value.contentType) &&
            typeof value.imageBase64 === "string" &&
            value.imageBase64.length >= 4 &&
            value.imageBase64.length <= 4194304
          ),
          data: value,
        }),
      },
      IdentifyPartsImageResponse: {
        safeParse: (value) => ({
          success: Boolean(
            value &&
            typeof value.identified === "boolean" &&
            typeof value.name === "string" &&
            (value.category === null || typeof value.category === "string") &&
            (value.description === null || typeof value.description === "string") &&
            (value.sku === null || typeof value.sku === "string") &&
            ["low", "medium", "high"].includes(value.uncertainty) &&
            (value.uncertaintyReason === null || typeof value.uncertaintyReason === "string") &&
            (!value.identified || value.name.trim().length > 0)
          ),
          data: value,
        }),
      },
    },
  });
  mock.module("@workspace/integrations-openai-ai-server", {
    namedExports: {
      openai: {
        chat: {
          completions: {
            create: async (request) => {
              calls.model.push(request);
              if (modelSequence.length) {
                const next = modelSequence.shift();
                if (next instanceof Error) throw next;
                return next;
              }
              if (modelError) throw modelError;
              return modelResponse;
            },
          },
        },
      },
    },
  });
  mock.module("../lib/assistantModel", {
    namedExports: {
      AssistantModelPolicyError: class AssistantModelPolicyError extends Error {
        constructor(message, status) { super(message); this.status = status; }
      },
      listAssistantProviderModels: async () => {
        calls.catalog.push(true);
        if (catalogError) throw catalogError;
        return modelCatalog;
      },
      getAssistantModelPolicyWithCatalog: async () => {
        calls.catalog.push(true);
        if (catalogError) throw catalogError;
        return {
          policy: { locked: false },
          effectiveModels: modelCatalog,
        };
      },
      resolveTeamAssistantModel: async (_teamId, requestedModel) => requestedModel,
    },
  });
  mock.module("../middlewares/adminAuth", {
    namedExports: {
      requireAdmin: (req, res, next) => {
        if (req.get("x-test-auth") !== "allowed") {
          res.status(401).json({ error: "Authentication required" });
          return;
        }
        next();
      },
      requestTeamId: async () => "test-team",
    },
  });

  const [{ default: express }, { default: router }] = await Promise.all([
    import("express"),
    import(`../routes/partsImageRecognition.ts?test=${++importId}`),
  ]);
  const app = express();
  app.use(express.json({ limit: "4.1mb" }));
  app.use((req, _res, next) => {
    req.log = {
      warn: (...args) => calls.logs.push(args),
      error: (...args) => calls.logs.push(args),
    };
    next();
  });
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  globalThis.partsRecognitionTestServer = { server, baseUrl };
});

after(async () => {
  await new Promise((resolve) => globalThis.partsRecognitionTestServer.server.close(resolve));
  mock.restoreAll();
});

async function postImage({ auth = true, body = validInput } = {}) {
  return fetch(`${globalThis.partsRecognitionTestServer.baseUrl}/api/parts/catalog/identify-image`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { "x-test-auth": "allowed" } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("recognition requires Parts authentication before calling the vision model", async () => {
  calls.model.length = 0;
  const response = await postImage({ auth: false });
  assert.equal(response.status, 401);
  assert.equal(calls.model.length, 0);
});

test("recognition rejects invalid image content before calling the vision model", async () => {
  calls.model.length = 0;
  const response = await postImage({
    body: { ...validInput, contentType: "image/jpeg" },
  });
  assert.equal(response.status, 400);
  assert.equal(calls.model.length, 0);
});

test("fallback selection excludes paid, text-only, primary, and unverified catalog entries", () => {
  assert.equal(resolveFreeVisionFallback(["openrouter/free"], [
    { id: "provider/free-text", isFree: true, architecture: { input_modalities: ["text"] } },
    { id: "provider/paid-image", isFree: false, architecture: { input_modalities: ["image"] } },
    { id: "openrouter/free", isFree: true, architecture: { input_modalities: ["image"] } },
    { id: "provider/free-image", isFree: true, architecture: { input_modalities: ["text", "image"] } },
    { id: "provider/unknown", isFree: true },
  ]), "provider/free-image");
  assert.equal(resolveFreeVisionFallback(["openrouter/free"], [
    { id: "provider/free-text", isFree: true, architecture: { input_modalities: ["text"] } },
    { id: "provider/unknown", isFree: true },
  ]), undefined);
});

test("recognition returns an explicit unclear result without asserting supplier or SKU facts", async () => {
  process.env.AI_ASSISTANT_VISION_MODEL = "";
  modelError = null;
  modelSequence = [];
  modelCatalog = [];
  modelResponse = {
    choices: [{
      message: {
        content: JSON.stringify({
          identified: false,
          name: "",
          category: null,
          description: null,
          sku: null,
          uncertainty: "high",
          uncertaintyReason: "The image is too blurry.",
        }),
      },
    }],
  };
  const response = await postImage();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    identified: false,
    name: "",
    category: null,
    description: null,
    sku: null,
    uncertainty: "high",
    uncertaintyReason: "The image is too blurry.",
  });
  assert.equal(calls.model.at(-1).model, "openrouter/free");
});

test("an explicit vision model setting overrides the free router", async () => {
  const previous = process.env.AI_ASSISTANT_VISION_MODEL;
  process.env.AI_ASSISTANT_VISION_MODEL = "provider/custom-vision";
  modelError = null;
  modelSequence = [];
  modelResponse = validModelResponse;

  const response = await postImage();
  assert.equal(response.status, 200);
  assert.equal(calls.model.at(-1).model, "provider/custom-vision");

  if (previous === undefined) delete process.env.AI_ASSISTANT_VISION_MODEL;
  else process.env.AI_ASSISTANT_VISION_MODEL = previous;
});

test("a transient router failure falls back only to a catalog-verified free vision model", async () => {
  process.env.AI_ASSISTANT_VISION_MODEL = "";
  calls.model.length = 0;
  calls.catalog.length = 0;
  calls.logs.length = 0;
  modelError = null;
  modelSequence = [Object.assign(new Error("provider token=do-not-log image=private"), { status: 429, code: "RATE_LIMITED" }), validModelResponse];
  modelCatalog = [
    { id: "provider/free-text", isFree: true, architecture: { input_modalities: ["text"] } },
    { id: "provider/paid-vision", isFree: false, architecture: { input_modalities: ["text", "image"] } },
    { id: "provider/free-vision", isFree: true, architecture: { input_modalities: ["text", "image"] } },
  ];

  const response = await postImage();
  assert.equal(response.status, 200);
  assert.deepEqual(calls.model.map(({ model }) => model), ["openrouter/free", "provider/free-vision"]);
  assert.equal(calls.catalog.length, 1);
  assert.doesNotMatch(JSON.stringify(calls.logs), /do-not-log|private/);
});

test("a transient failure is bounded to one verified fallback and keeps the sanitized outage response", async () => {
  process.env.AI_ASSISTANT_VISION_MODEL = "";
  calls.model.length = 0;
  calls.catalog.length = 0;
  modelError = null;
  modelSequence = [
    Object.assign(new Error("provider unavailable"), { status: 503 }),
    Object.assign(new Error("second provider unavailable"), { status: 503 }),
  ];
  modelCatalog = [
    { id: "provider/free-vision", isFree: true, architecture: { input_modalities: ["text", "image"] } },
  ];

  const response = await postImage();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Image identification is temporarily unavailable. Try again or add the part manually.",
  });
  assert.deepEqual(calls.model.map(({ model }) => model), ["openrouter/free", "provider/free-vision"]);
});

test("authentication and non-retryable provider failures do not load fallback candidates", async () => {
  process.env.AI_ASSISTANT_VISION_MODEL = "";
  calls.model.length = 0;
  calls.catalog.length = 0;
  modelError = null;
  modelSequence = [
    Object.assign(new Error("Invalid request"), { status: 400, code: "INVALID_REQUEST" }),
    Object.assign(new Error("Provider authentication failed"), { status: 401, code: "UNAUTHORIZED" }),
  ];

  for (const expectedCalls of [1, 2]) {
    const providerFailure = await postImage();
    assert.equal(providerFailure.status, 503);
    assert.equal(calls.model.length, expectedCalls);
  }
  assert.equal(calls.catalog.length, 0);

  calls.model.length = 0;
  const unauthenticated = await postImage({ auth: false });
  assert.equal(unauthenticated.status, 401);
  assert.equal(calls.model.length, 0);
});

test("malformed responses get one fallback attempt, then preserve the invalid-result response", async () => {
  process.env.AI_ASSISTANT_VISION_MODEL = "";
  calls.model.length = 0;
  modelError = null;
  modelSequence = [
    { choices: [{ message: { content: "unstructured answer" } }] },
    validModelResponse,
  ];
  modelCatalog = [
    { id: "provider/free-vision", isFree: true, architecture: { input_modalities: ["image"] } },
  ];
  const fallbackSuccess = await postImage();
  assert.equal(fallbackSuccess.status, 200);
  assert.deepEqual(calls.model.map(({ model }) => model), ["openrouter/free", "provider/free-vision"]);

  calls.model.length = 0;
  modelSequence = [
    { choices: [{ message: { content: "unstructured answer" } }] },
    { choices: [{ message: { content: "still not JSON" } }] },
  ];
  const invalid = await postImage();
  assert.equal(invalid.status, 502);
  assert.match((await invalid.json()).error, /could not be identified reliably/);
  assert.equal(calls.model.length, 2);
});

test("recognition reports provider outages without exposing provider details", async () => {
  process.env.AI_ASSISTANT_VISION_MODEL = "";
  calls.model.length = 0;
  calls.catalog.length = 0;
  modelSequence = [];
  modelCatalog = [];
  modelError = Object.assign(new Error("provider credential=private"), { status: 503 });
  modelResponse = validModelResponse;
  const outage = await postImage();
  assert.equal(outage.status, 503);
  assert.match((await outage.json()).error, /temporarily unavailable/);
  assert.equal(calls.model.length, 1);
  assert.equal(calls.catalog.length, 1);
  assert.doesNotMatch(JSON.stringify(calls.logs), /credential=private/);
  modelError = null;
});
