import { randomInt, randomUUID } from "node:crypto";

export type WhiteboardOperation = {
  type: string;
  elementId?: string;
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  strokeColor?: string;
  backgroundColor?: string;
};

export function parseWhiteboardOperations(value: unknown): { operations?: WhiteboardOperation[]; error?: string } {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) {
    return { error: "Provide 1 to 30 whiteboard operations." };
  }
  const allowed = new Set(["add_text", "add_rectangle", "add_ellipse", "add_arrow", "update_text", "delete_element"]);
  const operations: WhiteboardOperation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { error: "Each whiteboard operation must be an object." };
    const operation = item as Record<string, unknown>;
    if (typeof operation.type !== "string" || !allowed.has(operation.type)) return { error: "A whiteboard operation type is invalid." };
    for (const key of ["x", "y", "width", "height", "fontSize"] as const) {
      if (operation[key] !== undefined && (typeof operation[key] !== "number" || !Number.isFinite(operation[key]))) {
        return { error: `Whiteboard ${key} values must be numbers.` };
      }
    }
    if (operation.text !== undefined && typeof operation.text !== "string") return { error: "Whiteboard text must be text." };
    if (operation.elementId !== undefined && typeof operation.elementId !== "string") return { error: "Whiteboard element ids must be text." };
    if (operation.strokeColor !== undefined && typeof operation.strokeColor !== "string") return { error: "Stroke colors must be text." };
    if (operation.backgroundColor !== undefined && typeof operation.backgroundColor !== "string") return { error: "Fill colors must be text." };
    operations.push(operation as WhiteboardOperation);
  }
  return { operations };
}

function safeNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function validCoordinate(value: number | undefined, fallback: number): number | null {
  const coordinate = value ?? fallback;
  return Number.isFinite(coordinate) && coordinate >= -10_000 && coordinate <= 10_000
    ? coordinate
    : null;
}

function validColor(value: string | undefined, fallback: string, allowTransparent: boolean): string | null {
  const color = value ?? fallback;
  if (allowTransparent && color === "transparent") return color;
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : null;
}

function textDimensions(text: string, fontSize: number): { width: number; height: number } {
  const lines = text.split("\n");
  return {
    width: Math.max(80, Math.min(1600, Math.ceil(Math.max(...lines.map((line) => line.length), 1) * fontSize * 0.62))),
    height: Math.max(fontSize * 1.25, lines.length * fontSize * 1.25),
  };
}

function newWhiteboardElement(
  type: string,
  operation: WhiteboardOperation,
): Record<string, unknown> | string {
  const x = validCoordinate(operation.x, 120);
  const y = validCoordinate(operation.y, 120);
  const strokeColor = validColor(operation.strokeColor, "#1e1e1e", false);
  const backgroundColor = validColor(operation.backgroundColor, "transparent", true);
  if (x === null || y === null || !strokeColor || !backgroundColor) {
    return "Use coordinates between -10,000 and 10,000 and valid six-digit hex colors (or transparent fill).";
  }
  const text = operation.text ?? "";
  if (text.length > 4000) return "Whiteboard text must be 4,000 characters or fewer.";
  const fontSize = safeNumber(operation.fontSize, 20, 12, 72);
  const dimensions = textDimensions(text, fontSize);
  const width = operation.width ?? (type === "text" ? dimensions.width : 180);
  const height = operation.height ?? (type === "text" ? dimensions.height : 100);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 10 || height < 10 || width > 4000 || height > 4000) {
    return "Shape width and height must be between 10 and 4,000.";
  }
  const common: Record<string, unknown> = {
    id: randomUUID().replaceAll("-", "").slice(0, 20),
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor,
    backgroundColor: type === "text" || type === "arrow" ? "transparent" : backgroundColor,
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: null,
    roundness: type === "rectangle" ? { type: 3 } : null,
    seed: randomInt(1, 2_147_483_647),
    version: 1,
    versionNonce: randomInt(1, 2_147_483_647),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  };
  if (type === "text") {
    return {
      ...common,
      text,
      fontSize,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      baseline: Math.round(fontSize * 0.85),
      containerId: null,
      originalText: text,
      autoResize: true,
      lineHeight: 1.25,
    };
  }
  if (type === "arrow") {
    return {
      ...common,
      points: [[0, 0], [width, height]],
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: "arrow",
      elbowed: false,
    };
  }
  return common;
}

export function applyWhiteboardOperations(
  elements: Record<string, unknown>[],
  operations: WhiteboardOperation[],
): { elements?: Record<string, unknown>[]; error?: string; changed?: number } {
  const next = elements.map((element) => ({ ...element }));
  let changed = 0;
  for (const operation of operations) {
    if (operation.type === "add_text" || operation.type === "add_rectangle" ||
      operation.type === "add_ellipse" || operation.type === "add_arrow") {
      if (operation.type === "add_text" && !operation.text?.trim()) return { error: "New whiteboard text cannot be empty." };
      const shapeType = operation.type === "add_text" ? "text"
        : operation.type === "add_rectangle" ? "rectangle"
          : operation.type === "add_ellipse" ? "ellipse" : "arrow";
      const element = newWhiteboardElement(shapeType, operation);
      if (typeof element === "string") return { error: element };
      next.push(element);
      changed += 1;
      continue;
    }

    const elementId = operation.elementId?.trim();
    if (!elementId) return { error: "An existing whiteboard element id is required." };
    const existing = next.find((element) => element.id === elementId && element.isDeleted !== true);
    if (!existing) return { error: `Whiteboard element ${elementId} was not found.` };
    if (operation.type === "update_text") {
      if (existing.type !== "text") return { error: "Only text elements can be updated with this operation." };
      if (typeof operation.text !== "string" || operation.text.length > 4000) {
        return { error: "Updated whiteboard text must contain 1 to 4,000 characters." };
      }
      const fontSize = safeNumber(existing.fontSize, 20, 12, 72);
      const dimensions = textDimensions(operation.text, fontSize);
      Object.assign(existing, {
        text: operation.text,
        originalText: operation.text,
        width: dimensions.width,
        height: dimensions.height,
        version: safeNumber(existing.version, 1, 1, 2_147_483_646) + 1,
        versionNonce: randomInt(1, 2_147_483_647),
        updated: Date.now(),
      });
      changed += 1;
      continue;
    }
    if (operation.type === "delete_element") {
      Object.assign(existing, {
        isDeleted: true,
        version: safeNumber(existing.version, 1, 1, 2_147_483_646) + 1,
        versionNonce: randomInt(1, 2_147_483_647),
        updated: Date.now(),
      });
      changed += 1;
    }
  }
  return { elements: next, changed };
}