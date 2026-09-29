export type ProgressiveCadTile = {
  id: string;
  bytes: number;
  triangles: number;
  center: [number, number, number];
  radius: number;
};

export type ProgressiveCadPreviewManifest = {
  previewId: string;
  overviewBytes: number;
  detailBytes: number;
  triangles: number;
  tiles: ProgressiveCadTile[];
};

export function parseProgressiveCadPreviewManifest(
  value: unknown,
): ProgressiveCadPreviewManifest {
  if (!value || typeof value !== "object") {
    throw new Error("The converter returned an invalid progressive preview.");
  }

  const manifest = value as Record<string, unknown>;
  if (
    typeof manifest.previewId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(manifest.previewId) ||
    typeof manifest.overviewBytes !== "number" ||
    !Number.isSafeInteger(manifest.overviewBytes) ||
    manifest.overviewBytes <= 0 ||
    typeof manifest.detailBytes !== "number" ||
    !Number.isSafeInteger(manifest.detailBytes) ||
    manifest.detailBytes <= 0 ||
    typeof manifest.triangles !== "number" ||
    !Number.isSafeInteger(manifest.triangles) ||
    manifest.triangles <= 0 ||
    !Array.isArray(manifest.tiles) ||
    manifest.tiles.length === 0
  ) {
    throw new Error("The converter returned an incomplete progressive preview.");
  }

  const tiles = manifest.tiles.map((candidate): ProgressiveCadTile => {
    if (!candidate || typeof candidate !== "object") {
      throw new Error("The converter returned an invalid detail tile.");
    }
    const tile = candidate as Record<string, unknown>;
    if (
      typeof tile.id !== "string" ||
      !/^g\d+$/.test(tile.id) ||
      typeof tile.bytes !== "number" ||
      !Number.isSafeInteger(tile.bytes) ||
      tile.bytes <= 0 ||
      typeof tile.triangles !== "number" ||
      !Number.isSafeInteger(tile.triangles) ||
      tile.triangles <= 0 ||
      !Array.isArray(tile.center) ||
      tile.center.length !== 3 ||
      !tile.center.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate)) ||
      typeof tile.radius !== "number" ||
      !Number.isFinite(tile.radius) ||
      tile.radius < 0
    ) {
      throw new Error("The converter returned an invalid detail tile.");
    }
    return {
      id: tile.id,
      bytes: tile.bytes,
      triangles: tile.triangles,
      center: tile.center as [number, number, number],
      radius: tile.radius,
    };
  });
  if (new Set(tiles.map((tile) => tile.id)).size !== tiles.length) {
    throw new Error("The converter returned duplicate detail tiles.");
  }

  return {
    previewId: manifest.previewId,
    overviewBytes: manifest.overviewBytes,
    detailBytes: manifest.detailBytes,
    triangles: manifest.triangles,
    tiles,
  };
}