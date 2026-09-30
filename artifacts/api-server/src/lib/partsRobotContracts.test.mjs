import assert from "node:assert/strict";
import test from "node:test";
import {
  CreatePartsPriceSnapshotBody,
  GetPartsRobotDetailsResponse,
  UpdatePartsCatalogCostBody,
  UpdatePartsRobotPreviewBody,
  UploadPartsRobotPreviewFileResponse,
} from "../../../../lib/api-zod/src/generated/api.ts";

test("generated robot detail response contract accepts currency subtotals and unknown costs", () => {
  const response = {
    robot: {
      id: "robot-1",
      name: "Scout",
      preview: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    parts: [{
      partId: "part-1",
      name: "Sensor",
      vendorKey: "vendor-a",
      vendorName: "Supplier A",
      sku: null,
      productUrl: null,
      quantity: 2,
      unitCost: null,
      costCurrency: null,
      lineTotal: null,
      priceSnapshots: [],
    }],
    subtotalsByCurrency: [{ currency: "USD", amount: 0 }],
    unpricedPartCount: 1,
  };
  assert.equal(GetPartsRobotDetailsResponse.safeParse(response).success, true);
  assert.equal(
    GetPartsRobotDetailsResponse.safeParse({
      ...response,
      subtotalsByCurrency: [{ currency: "usd", amount: 0 }],
    }).success,
    false,
  );
});

test("generated request contracts constrain saved costs, quote provenance, and preview upload inputs", () => {
  assert.equal(
    UpdatePartsCatalogCostBody.safeParse({ unitCost: null, costCurrency: null }).success,
    true,
  );
  assert.equal(
    UpdatePartsCatalogCostBody.safeParse({ unitCost: 3.25, costCurrency: "USD" }).success,
    true,
  );
  assert.equal(
    UpdatePartsCatalogCostBody.safeParse({ unitCost: -1, costCurrency: "USD" }).success,
    false,
  );
  assert.equal(
    CreatePartsPriceSnapshotBody.safeParse({
      unitPrice: 4.5,
      currency: "CAD",
      sourceUrl: "https://supplier.example.com/item",
      isStartingAt: true,
    }).success,
    true,
  );
  assert.equal(
    UpdatePartsRobotPreviewBody.safeParse({
      objectPath: "/objects/preview-1234",
      fileName: "robot.glb",
      contentType: "model/gltf-binary",
    }).success,
    true,
  );
  assert.equal(
    UploadPartsRobotPreviewFileResponse.safeParse({ objectPath: "/objects/preview-1234" }).success,
    true,
  );
});