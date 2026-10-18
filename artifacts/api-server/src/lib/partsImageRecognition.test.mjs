import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { after, before, test, mock } from "node:test";
import {
  decodePartsImage,
  parsePartsImageIdentification,
  PARTS_IMAGE_MAX_BYTES,
} from "./partsImageRecognition.ts";

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

const calls = { model: [] };
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
              if (modelError) throw modelError;
              return modelResponse;
            },
          },
        },
      },
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
    },
  });

  const [{ default: express }, { default: router }] = await Promise.all([
    import("express"),
    import(`../routes/partsImageRecognition.ts?test=${++importId}`),
  ]);
  const app = express();
  app.use(express.json({ limit: "4.1mb" }));
  app.use((req, _res, next) => {
    req.log = { warn() {}, error() {} };
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

test("recognition returns an explicit unclear result without asserting supplier or SKU facts", async () => {
  modelError = null;
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
  assert.equal(calls.model.at(-1).model, process.env.AI_ASSISTANT_VISION_MODEL || "inclusionai/ling-3.0-flash-vl:free");
});

test("recognition rejects malformed model output and reports provider outages", async () => {
  modelError = null;
  modelResponse = { choices: [{ message: { content: "unstructured answer" } }] };
  const invalid = await postImage();
  assert.equal(invalid.status, 502);

  modelError = new Error("provider unavailable");
  const outage = await postImage();
  assert.equal(outage.status, 503);
  assert.match((await outage.json()).error, /temporarily unavailable/);
  modelError = null;
});
