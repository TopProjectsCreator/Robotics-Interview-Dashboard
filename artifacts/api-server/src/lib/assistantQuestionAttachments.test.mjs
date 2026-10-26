import assert from "node:assert/strict";
import test from "node:test";
import { readdir } from "node:fs/promises";
import os from "node:os";
import { strToU8, zipSync } from "fflate";
import {
  AssistantQuestionAttachmentError,
  prepareAssistantQuestionAnswers,
} from "./assistantQuestionAttachments.ts";

function createPdfWithText(text) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

const fileQuestion = [{ id: "reference", type: "fileUpload", maxFiles: 2 }];

test("extracts PDF text transiently and removes the uploaded data from the answer", async () => {
  const before = new Set((await readdir(os.tmpdir())).filter((name) => name.startsWith("robotics-builder-question-")));
  const pdf = createPdfWithText("Builder reference torque limit");
  const answers = await prepareAssistantQuestionAnswers(fileQuestion, {
    reference: [{
      name: "specification.pdf",
      type: "application/pdf",
      size: pdf.length,
      dataUrl: `data:application/pdf;base64,${pdf.toString("base64")}`,
    }],
  });

  const attachment = answers.reference[0];
  assert.equal(attachment.name, "specification.pdf");
  assert.match(attachment.textContent, /Builder reference torque limit/);
  assert.match(attachment.textContent, /untrusted document content/);
  assert.equal("dataUrl" in attachment, false);
  const after = (await readdir(os.tmpdir())).filter((name) => name.startsWith("robotics-builder-question-"));
  assert.deepEqual(after.filter((name) => !before.has(name)), []);
});

test("extracts text from a DOCX attachment and passes only the extracted text onward", async () => {
  const docx = zipSync({
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      "</Types>",
    ),
    "_rels/.rels": strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>",
    ),
    "word/document.xml": strToU8(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      "<w:body><w:p><w:r><w:t>Team build specification</w:t></w:r></w:p></w:body></w:document>",
    ),
  });
  const answers = await prepareAssistantQuestionAnswers(fileQuestion, {
    reference: [{
      name: "specification.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      dataUrl: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${Buffer.from(docx).toString("base64")}`,
    }],
  });
  const attachment = answers.reference[0];
  assert.match(attachment.textContent, /Team build specification/);
  assert.equal("dataUrl" in attachment, false);
});

test("rejects unsupported file types, bad file signatures, and oversized uploads", async () => {
  await assert.rejects(
    prepareAssistantQuestionAnswers(fileQuestion, {
      reference: [{ name: "program.exe", type: "application/octet-stream" }],
    }),
    (error) => error instanceof AssistantQuestionAttachmentError && /not supported/.test(error.message),
  );
  await assert.rejects(
    prepareAssistantQuestionAnswers(fileQuestion, {
      reference: [{
        name: "fake.pdf",
        dataUrl: `data:application/pdf;base64,${Buffer.from("not a PDF").toString("base64")}`,
      }],
    }),
    (error) => error instanceof AssistantQuestionAttachmentError && /valid PDF/.test(error.message),
  );
  const oversized = Buffer.alloc(2 * 1024 * 1024 + 1, 0x41);
  await assert.rejects(
    prepareAssistantQuestionAnswers(fileQuestion, {
      reference: [{
        name: "large.pdf",
        dataUrl: `data:application/pdf;base64,${oversized.toString("base64")}`,
      }],
    }),
    (error) => error instanceof AssistantQuestionAttachmentError && /2 MB/.test(error.message),
  );
});

test("bounds Office archive expansion before parsing", async () => {
  const invalidArchive = Buffer.from([
    0x50, 0x4b, 0x03, 0x04,
    ...Buffer.alloc(40),
  ]);
  await assert.rejects(
    prepareAssistantQuestionAnswers(fileQuestion, {
      reference: [{
        name: "specification.docx",
        dataUrl: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${invalidArchive.toString("base64")}`,
      }],
    }),
    (error) => error instanceof AssistantQuestionAttachmentError && /Office archive format/.test(error.message),
  );
  const zipBomb = zipSync({
    "[Content_Types].xml": strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    "word/document.xml": strToU8("A".repeat(10 * 1024 * 1024 + 1)),
  });
  assert.ok(zipBomb.length < 2 * 1024 * 1024);
  await assert.rejects(
    prepareAssistantQuestionAnswers(fileQuestion, {
      reference: [{
        name: "expanded.docx",
        dataUrl: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${Buffer.from(zipBomb).toString("base64")}`,
      }],
    }),
    (error) => error instanceof AssistantQuestionAttachmentError && /expands beyond/.test(error.message),
  );
});
