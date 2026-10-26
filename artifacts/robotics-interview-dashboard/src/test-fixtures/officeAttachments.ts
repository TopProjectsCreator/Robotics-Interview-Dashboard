import { gunzipSync, strToU8, zipSync } from "fflate";

import legacyPowerPointGzipBase64 from "./office/legacy-powerpoint.ppt.gz.txt?raw";
import legacyWordGzipBase64 from "./office/legacy-word.doc.gz.txt?raw";

export type OfficeAttachmentFixture = {
  name: string;
  contentType: string;
  body: Blob;
  expectedText: string;
};

const sampleText = "Readable Office fixture";

function pptxFixture(): Blob {
  const zip = zipSync({
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
        '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' +
        "</Types>",
    ),
    "_rels/.rels": strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>' +
        "</Relationships>",
    ),
    "ppt/presentation.xml": strToU8(
      '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>',
    ),
    "ppt/_rels/presentation.xml.rels": strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>' +
        "</Relationships>",
    ),
    "ppt/slides/slide1.xml": strToU8(
      '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
        `<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${sampleText}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
    ),
  });
  return new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

function openDocumentFixture(kind: "text" | "spreadsheet" | "presentation"): Blob {
  const mimeTypes = {
    text: "application/vnd.oasis.opendocument.text",
    spreadsheet: "application/vnd.oasis.opendocument.spreadsheet",
    presentation: "application/vnd.oasis.opendocument.presentation",
  };
  const content = kind === "text"
    ? `<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text><text:p>${sampleText}</text:p></office:text></office:body></office:document-content>`
    : kind === "spreadsheet"
      ? `<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:spreadsheet><table:table table:name="Sample"><table:table-row><table:table-cell office:value-type="string"><text:p>${sampleText}</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet></office:body></office:document-content>`
      : `<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:presentation><draw:page draw:name="Slide 1"><draw:frame><draw:text-box><text:p>${sampleText}</text:p></draw:text-box></draw:frame></draw:page></office:presentation></office:body></office:document-content>`;
  const zip = zipSync({
    mimetype: [strToU8(mimeTypes[kind]), { level: 0 }],
    "content.xml": strToU8(content),
    "META-INF/manifest.xml": strToU8(
      `<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="${mimeTypes[kind]}"/></manifest:manifest>`,
    ),
  });
  return new Blob([zip], { type: mimeTypes[kind] });
}

function decompressedFixture(base64: string, contentType: string): Blob {
  const compressed = Uint8Array.from(atob(base64.trim()), character => character.charCodeAt(0));
  return new Blob([gunzipSync(compressed)], { type: contentType });
}

export const officeAttachmentFixtures: OfficeAttachmentFixture[] = [
  {
    name: "deck.ppt",
    contentType: "application/vnd.ms-powerpoint",
    body: decompressedFixture(legacyPowerPointGzipBase64, "application/vnd.ms-powerpoint"),
    expectedText: "Title Placeholder",
  },
  {
    name: "deck-modern.pptx",
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    body: pptxFixture(),
    expectedText: sampleText,
  },
  {
    name: "slides-without-extension",
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    body: pptxFixture(),
    expectedText: sampleText,
  },
  {
    name: "notes.odt",
    contentType: "application/vnd.oasis.opendocument.text",
    body: openDocumentFixture("text"),
    expectedText: sampleText,
  },
  {
    name: "scores.ods",
    contentType: "application/vnd.oasis.opendocument.spreadsheet",
    body: openDocumentFixture("spreadsheet"),
    expectedText: sampleText,
  },
  {
    name: "slides.odp",
    contentType: "application/vnd.oasis.opendocument.presentation",
    body: openDocumentFixture("presentation"),
    expectedText: sampleText,
  },
  {
    name: "legacy.doc",
    contentType: "application/msword",
    body: decompressedFixture(legacyWordGzipBase64, "application/msword"),
    expectedText: "My name is Ryan",
  },
  {
    name: "legacy-no-extension",
    contentType: "application/msword",
    body: decompressedFixture(legacyWordGzipBase64, "application/msword"),
    expectedText: "My name is Ryan",
  },
  {
    name: "vague-type.ppt",
    contentType: "application/octet-stream",
    body: decompressedFixture(legacyPowerPointGzipBase64, "application/octet-stream"),
    expectedText: "Title Placeholder",
  },
  {
    name: "settings.json",
    contentType: "application/json",
    body: new Blob(['{"robot":{"name":"Ada","ready":true}}'], { type: "application/json" }),
    expectedText: '"name": "Ada"',
  },
  {
    name: "settings-vague.json",
    contentType: "application/octet-stream",
    body: new Blob(['{"team":["north","south"]}'], { type: "application/octet-stream" }),
    expectedText: '"north"',
  },
  {
    name: "settings-no-extension",
    contentType: "application/json",
    body: new Blob(['{"source":"mime type"}'], { type: "application/json" }),
    expectedText: '"source": "mime type"',
  },
];
