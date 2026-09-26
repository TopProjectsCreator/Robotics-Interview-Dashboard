import * as Y from "yjs";

export type DocumentAssistantEditMode = "append" | "replace";

export function documentDocFromEnvelope(raw: string): Y.Doc {
  const doc = new Y.Doc();
  try {
    const parsed = JSON.parse(raw) as { yState?: unknown };
    if (typeof parsed.yState === "string" && parsed.yState) {
      Y.applyUpdate(doc, new Uint8Array(Buffer.from(parsed.yState, "base64")));
    }
    return doc;
  } catch (error) {
    doc.destroy();
    throw error;
  }
}

function renderNode(node: Y.XmlElement | Y.XmlText): string {
  if (node instanceof Y.XmlText) return node.toString();

  const children = node.toArray().map((child) =>
    child instanceof Y.XmlElement || child instanceof Y.XmlText ? renderNode(child) : "",
  );
  const content = children.join("");

  if (node.nodeName === "heading") {
    const level = Number(node.getAttribute("level") ?? 1);
    return `${"#".repeat(Math.max(1, Math.min(6, Number.isInteger(level) ? level : 1)))} ${content}`;
  }
  if (node.nodeName === "bulletList") {
    return node.toArray().map((child) =>
      child instanceof Y.XmlElement ? `- ${renderNode(child)}` : "",
    ).filter(Boolean).join("\n");
  }
  if (node.nodeName === "orderedList") {
    return node.toArray().map((child, index) =>
      child instanceof Y.XmlElement ? `${index + 1}. ${renderNode(child)}` : "",
    ).filter(Boolean).join("\n");
  }
  if (node.nodeName === "hardBreak") return "\n";
  return content;
}

export function documentPlainText(doc: Y.Doc): string {
  return doc.getXmlFragment("default").toArray()
    .map((node) => node instanceof Y.XmlElement || node instanceof Y.XmlText ? renderNode(node) : "")
    .filter(Boolean)
    .join("\n\n");
}

function xmlText(text: string): Y.XmlText {
  const node = new Y.XmlText();
  if (text) node.insert(0, text);
  return node;
}

function paragraph(text: string): Y.XmlElement {
  const node = new Y.XmlElement("paragraph");
  node.insert(0, [xmlText(text)]);
  return node;
}

function listItem(text: string): Y.XmlElement {
  const node = new Y.XmlElement("listItem");
  node.insert(0, [paragraph(text)]);
  return node;
}

function contentBlocks(content: string): Y.XmlElement[] {
  const blocks = content.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const nodes: Y.XmlElement[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      const list = new Y.XmlElement("bulletList");
      list.insert(0, lines.map((line) => listItem(line.replace(/^[-*]\s+/, ""))));
      nodes.push(list);
      continue;
    }
    if (lines.every((line) => /^\d+[.)]\s+/.test(line))) {
      const list = new Y.XmlElement("orderedList");
      list.setAttribute("start", "1");
      list.insert(0, lines.map((line) => listItem(line.replace(/^\d+[.)]\s+/, ""))));
      nodes.push(list);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(lines[0] ?? "");
    if (heading && lines.length === 1) {
      const node = new Y.XmlElement("heading");
      node.setAttribute("level", String(heading[1].length));
      node.insert(0, [xmlText(heading[2])]);
      nodes.push(node);
      continue;
    }
    nodes.push(paragraph(block));
  }

  return nodes;
}

export function applyDocumentAssistantContent(
  doc: Y.Doc,
  mode: DocumentAssistantEditMode,
  content: string,
): void {
  const fragment = doc.getXmlFragment("default");
  if (mode === "replace") fragment.delete(0, fragment.length);

  const nodes = contentBlocks(content);
  if (nodes.length === 0 && mode === "replace") nodes.push(paragraph(""));
  if (nodes.length > 0) fragment.insert(fragment.length, nodes);
}