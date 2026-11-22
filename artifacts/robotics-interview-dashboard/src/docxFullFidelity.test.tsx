import { strToU8, zipSync } from "fflate";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceFileViewer } from "./components/WorkspaceFileViewer";

// A 1x1 PNG. docx-preview turns the embedded relationship into a data: URL.
const ONE_PIXEL_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=";

const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    <w:p><w:r><w:t>Interview notes</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Applicant</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Score</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>9</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p><w:r><w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="914400" cy="914400"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="1" name="Picture 1"/>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic>
            <pic:nvPicPr><pic:cNvPr id="0" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr>
            <pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
            <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
          </pic:pic>
        </a:graphicData></a:graphic>
      </wp:inline>
    </w:drawing></w:r></w:p>
  </w:body>
</w:document>`;

function docxWithTableAndImage(): Blob {
  const bytes = zipSync({
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="png" ContentType="image/png"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        "</Types>",
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        "</Relationships>",
    ),
    "word/document.xml": strToU8(DOCUMENT_XML),
    "word/_rels/document.xml.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>' +
        "</Relationships>",
    ),
    "word/media/image1.png": new Uint8Array(Buffer.from(ONE_PIXEL_PNG_BASE64, "base64")),
  });
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("full-fidelity DOCX preview", () => {
  it("renders a hand-built DOCX as real DOM with a table and an embedded image", async () => {
    const { renderAsync } = await import("docx-preview");
    const blob = docxWithTableAndImage();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    await renderAsync(buffer, container, undefined, { inWrapper: true, useBase64URL: true });

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(table).toHaveTextContent("Applicant");
    expect(table).toHaveTextContent("Ada Lovelace");
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("src", expect.stringMatching(/^data:image/));
    container.remove();
  });

  it("shows tables and images inline and downloads only after an explicit click", async () => {
    const clickedAnchors: HTMLAnchorElement[] = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedAnchors.push(this);
    });
    const blob = docxWithTableAndImage();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(await blob.arrayBuffer(), { status: 200, headers: { "content-type": blob.type } })),
    );

    const { container, rerender } = render(<WorkspaceFileViewer name="notes.docx" src="/api/storage/objects/notes.docx" />);

    const preview = await waitFor(() => {
      const element = container.querySelector('[data-testid="docx-preview"]');
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    await waitFor(() => {
      expect(preview.querySelector("table")).not.toBeNull();
      expect(preview.querySelector("img")).not.toBeNull();
    });
    expect(preview).toHaveTextContent("Ada Lovelace");
    expect(container).toHaveTextContent("document preview");
    expect(await screen.findByRole("button", { name: "Download notes.docx" })).toHaveAttribute("type", "button");
    expect(container.querySelector('a[download]')).not.toBeInTheDocument();
    expect(clickSpy).not.toHaveBeenCalled();

    rerender(<WorkspaceFileViewer name="other-channel.docx" src="/api/storage/objects/other-channel.docx" />);

    const nextPreview = await waitFor(() => {
      const element = container.querySelector('[data-testid="docx-preview"]');
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    await waitFor(() => expect(nextPreview.querySelector("table")).not.toBeNull());
    const nextDownload = await screen.findByRole("button", { name: "Download other-channel.docx" });
    expect(container.querySelector('a[download]')).not.toBeInTheDocument();
    expect(clickSpy).not.toHaveBeenCalled();

    fireEvent.click(nextDownload);

    expect(clickSpy).toHaveBeenCalledOnce();
    expect(clickedAnchors[0]?.download).toBe("other-channel.docx");
    expect(clickedAnchors[0]?.href).toMatch(/^blob:/);
  });

  it("never leaves a blank box when a DOCX cannot be rendered or extracted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("not a docx", {
          status: 200,
          headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
        }),
      ),
    );

    render(<WorkspaceFileViewer name="broken.docx" src="/api/storage/objects/broken.docx" />);

    const alert = await screen.findByRole("alert", undefined, { timeout: 15_000 });
    expect(alert).toHaveTextContent("Couldn’t preview broken.docx");
    expect(within(alert).getByRole("button", { name: "Download broken.docx" })).toHaveAttribute("type", "button");
  });
});
