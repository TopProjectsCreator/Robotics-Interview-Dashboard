import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { strToU8, zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

import { MarkdownContent, renderInlineMarkdown } from "./App";
import { officeAttachmentFixtures } from "./test-fixtures/officeAttachments";
import { TooltipProvider } from "./components/ui/tooltip";

vi.mock("@google/model-viewer", () => ({}));
vi.mock("heic2any", () => ({
  default: vi.fn(),
}));
vi.mock("./components/ChatStlViewer", () => ({
  ChatStlViewer: ({ name }: { name: string }) => <div data-testid="chat-stl-attachment">{name} · STL model</div>,
}));
vi.mock("./components/CadMeshViewer", () => ({
  CadMeshViewer: ({ name }: { name: string }) => (
    <div data-testid="cad-mesh-attachment">{name} · mesh preview</div>
  ),
}));
vi.mock("./components/CadThreeMfViewer", () => ({
  CadThreeMfViewer: ({ name, src }: { name: string; src: string }) => (
    <figure data-testid="chat-3mf-attachment">
      <span>{name} · 3MF model</span>
      <a href={src} download={name}>Download 3MF</a>
    </figure>
  ),
}));
vi.mock("./components/ChatParasolidViewer", () => ({
  ChatParasolidViewer: ({ name, src }: { name: string; src: string }) => (
    <figure data-testid="chat-parasolid-attachment">
      <span>{name} · Parasolid 3D preview</span>
      <a href={src} download={name}>Download CAD file</a>
    </figure>
  ),
}));

const DOCX_FIXTURE_BASE64 =
  "UEsDBBQAAAAIADoNOF15bjPX6AAAAK0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH1QyU7DMBD9FWuuKHHggBCK0wPLETiUDxjZk8SqN3nc0v49Tlt6QIXjzFv1+tXeO7GjzDYGBbdtB4KCjsaGScHn+rV5AMEFg0EXAyk4EMNq6NeHRCyqNrCCuZT0KCXrmTxyGxOFiowxeyz1zJNMqDc4kbzrunupYygUSlMWDxj6Zxpx64p42df3qUcmxyCeTsQlSwGm5KzGUnG5C+ZXSnNOaKvyyOHZJr6pBJBXExbk74Cz7r0Ok60h8YG5vKGvLPkVs5Em6q2vyvZ/mys94zhaTRf94pZy1MRcF/euvSAebfjpL49zD99QSwMEFAAAAAgAOg04XZv9N+qtAAAAKQEAAAsAAABfcmVscy8ucmVsc43POw7CMAwG4KtE3mlaBoRQ0y4IqSsqB7ASN61oHkrCo7cnAwNFDIy2f3+W6/ZpZnanECdnBVRFCYysdGqyWsClP232wGJCq3B2lgQsFKFt6jPNmPJKHCcfWTZsFDCm5A+cRzmSwVg4TzZPBhcMplwGzT3KK2ri27Lc8fBpwNpknRIQOlUB6xdP/9huGCZJRydvhmz6ceIrkWUMmpKAhwuKq3e7yCzwpuarF5sXUEsDBBQAAAAIADoNOF0t7xcEtgAAAPMAAAARAAAAd29yZC9kb2N1bWVudC54bWxFjsFuwjAMhl8lyn2k4zBNVVsOIK5ME5N2DYmhkRq7sg2Ft6cpBy6f5d/2Jzebex7MDVgSYWs/V5U1gIFiwktr/477j29rRD1GPxBCax8gdtM1Ux0pXDOgmlmAUk+t7VXH2jkJPWQvKxoB59mZOHudW764iTiOTAFEZn8e3Lqqvlz2CW1Rnig+Sh0LuEC7XzqRpiAmoQLfEkxmd9j+m3O665WhcWWpkBcupwJBf9gtwcvp3v92T1BLAQIUAxQAAAAIADoNOF15bjPX6AAAAK0BAAATAAAAAAAAAAAAAACAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAgAOg04XZv9N+qtAAAAKQEAAAsAAAAAAAAAAAAAAIABGQEAAF9yZWxzLy5yZWxzUEsBAhQDFAAAAAgAOg04XS3vFwS2AAAA8wAAABEAAAAAAAAAAAAAAIAB7wEAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAADAAMAuQAAANQCAAAAAA==";

type Fixture = {
  name: string;
  contentType: string;
  body: Blob;
  assertPreview: (container: HTMLElement) => void;
};

function spreadsheetFixture(extension: "xls" | "xlsx"): Blob {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Applicant", "Score"],
    ["Ada Lovelace", "9"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Scores");
  const bytes = XLSX.write(workbook, { type: "array", bookType: extension });
  return new Blob([bytes], { type: extension === "xls" ? "application/vnd.ms-excel" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function glbFixture(): Blob {
  const json = Buffer.from(JSON.stringify({ asset: { version: "2.0" } }), "utf8");
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const bytes = Buffer.alloc(20 + paddedLength, 0x20);
  bytes.write("glTF", 0, 4, "ascii");
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(paddedLength, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  json.copy(bytes, 20);
  return new Blob([bytes], { type: "model/gltf-binary" });
}

function stlFixture(): Blob {
  const bytes = Buffer.alloc(134);
  bytes.write("robot STL fixture", 0, "ascii");
  bytes.writeUInt32LE(1, 80);
  bytes.writeFloatLE(0, 84);
  bytes.writeFloatLE(0, 88);
  bytes.writeFloatLE(1, 92);
  bytes.writeFloatLE(0, 96);
  bytes.writeFloatLE(0, 100);
  bytes.writeFloatLE(0, 104);
  bytes.writeFloatLE(1, 108);
  bytes.writeFloatLE(0, 112);
  bytes.writeFloatLE(0, 116);
  bytes.writeFloatLE(1, 120);
  bytes.writeFloatLE(0, 124);
  bytes.writeFloatLE(0, 128);
  bytes.writeUInt16LE(0, 132);
  return new Blob([bytes], { type: "model/stl" });
}

function threeMfFixture(): Blob {
  const bytes = zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types/>'),
    "3D/3dmodel.model": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">' +
        '<resources><object id="1" type="model"><mesh>' +
        '<vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices>' +
        '<triangles><triangle v1="0" v2="1" v3="2"/></triangles>' +
        "</mesh></object></resources><build><item objectid=\"1\"/></build></model>",
    ),
  });
  return new Blob([bytes], { type: "model/3mf" });
}

function objFixture(): Blob {
  return new Blob(
    [
      "# unit square\n",
      "v 0 0 0\n",
      "v 1 0 0\n",
      "v 1 1 0\n",
      "v 0 1 0\n",
      "vn 0 0 1\n",
      "f 1//1 2//1 3//1 4//1\n",
    ],
    { type: "model/obj" },
  );
}

function plyFixture(): Blob {
  return new Blob(
    [
      "ply\n",
      "format ascii\n",
      "element vertex 3\n",
      "property float x\nproperty float y\nproperty float z\n",
      "element face 1\n",
      "property list uchar int vertex_indices\n",
      "end_header\n",
      "0 0 0\n1 0 0\n0 1 0\n",
      "3 0 1 2\n",
    ],
    { type: "model/ply" },
  );
}

function heicFixture(): Blob {
  // ISO Base Media File Format `ftyp` header with HEIC-compatible brands.
  const bytes = Buffer.alloc(20);
  bytes.writeUInt32BE(bytes.length, 0);
  bytes.write("ftyp", 4, "ascii");
  bytes.write("heic", 8, "ascii");
  bytes.writeUInt32BE(0, 12);
  bytes.write("mif1", 16, "ascii");
  return new Blob([bytes], { type: "image/heic" });
}

const fixtures: Fixture[] = [
  {
    name: "robot.glb",
    contentType: "model/gltf-binary",
    body: glbFixture(),
    assertPreview: container => {
      expect(container.querySelector("model-viewer")).toBeInTheDocument();
      expect(container).toHaveTextContent("3D model");
    },
  },
  {
    name: "robot.stl",
    contentType: "model/stl",
    body: stlFixture(),
    assertPreview: container => {
      expect(container.querySelector('[data-testid="chat-stl-attachment"]')).toBeInTheDocument();
      expect(container).toHaveTextContent("STL model");
    },
  },
  {
    name: "frame.obj",
    contentType: "model/obj",
    body: objFixture(),
    assertPreview: container => {
      expect(container.querySelector('[data-testid="cad-mesh-attachment"]')).toBeInTheDocument();
      expect(container).toHaveTextContent("frame.obj");
    },
  },
  {
    name: "scan.ply",
    contentType: "model/ply",
    body: plyFixture(),
    assertPreview: container => {
      expect(container.querySelector('[data-testid="cad-mesh-attachment"]')).toBeInTheDocument();
      expect(container).toHaveTextContent("scan.ply");
    },
  },
  {
    name: "bracket.3mf",
    contentType: "model/3mf",
    body: threeMfFixture(),
    assertPreview: container => {
      expect(container.querySelector('[data-testid="chat-3mf-attachment"]')).toBeInTheDocument();
      expect(container).toHaveTextContent("3MF model");
      expect(container.querySelector("a[download='bracket.3mf']")).toHaveAttribute("href", expect.stringMatching(/^blob:/));
    },
  },
  {
    name: "robot.x_t",
    contentType: "model/x-parasolid",
    body: new Blob(["Parasolid text fixture"], { type: "model/x-parasolid" }),
    assertPreview: container => {
      expect(container.querySelector('[data-testid="chat-parasolid-attachment"]')).toBeInTheDocument();
      expect(container).toHaveTextContent("Parasolid 3D preview");
      expect(container.querySelector("a[download='robot.x_t']")).toHaveAttribute("href", expect.stringMatching(/^blob:/));
    },
  },
  {
    name: "robot.x_b",
    contentType: "model/x-parasolid",
    body: new Blob([new Uint8Array([0x50, 0x61, 0x72, 0x61, 0x53, 0x6f, 0x6c, 0x69, 0x64])], { type: "model/x-parasolid" }),
    assertPreview: container => {
      expect(container.querySelector('[data-testid="chat-parasolid-attachment"]')).toBeInTheDocument();
      expect(container.querySelector("a[download='robot.x_b']")).toBeInTheDocument();
    },
  },
  {
    name: "scores.csv",
    contentType: "text/csv",
    body: new Blob(["Applicant,Score\nAda Lovelace,9\nGrace Hopper,10\n"], { type: "text/csv" }),
    assertPreview: container => {
      expect(container.querySelector("table")).toBeInTheDocument();
      expect(container).toHaveTextContent("Ada Lovelace");
      expect(container).toHaveTextContent("Grace Hopper");
    },
  },
  {
    name: "scores.tsv",
    contentType: "text/tab-separated-values",
    body: new Blob(["Applicant\tScore\nAda Lovelace\t9\n"], { type: "text/tab-separated-values" }),
    assertPreview: container => {
      expect(container.querySelector("table")).toBeInTheDocument();
      expect(container).toHaveTextContent("Applicant");
      expect(container).toHaveTextContent("9");
    },
  },
  {
    name: "scores.xls",
    contentType: "application/vnd.ms-excel",
    body: spreadsheetFixture("xls"),
    assertPreview: container => {
      expect(container.querySelector("table")).toBeInTheDocument();
      expect(container).toHaveTextContent("Scores");
      expect(container).toHaveTextContent("Ada Lovelace");
    },
  },
  {
    name: "scores.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: spreadsheetFixture("xlsx"),
    assertPreview: container => {
      expect(container.querySelector("table")).toBeInTheDocument();
      expect(container).toHaveTextContent("Scores");
      expect(container).toHaveTextContent("Ada Lovelace");
    },
  },
  {
    name: "candidate.png",
    contentType: "image/png",
    body: new Blob(["png fixture"], { type: "image/png" }),
    assertPreview: container => expect(container.querySelector("img")).toBeInTheDocument(),
  },
  {
    name: "portrait.heic",
    contentType: "application/octet-stream",
    body: heicFixture(),
    assertPreview: container => {
      expect(container.querySelector("img[alt='portrait.heic']")).toBeInTheDocument();
      expect(container.querySelector("img")).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    },
  },
  {
    name: "logo.svg",
    contentType: "image/svg+xml",
    body: new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'],
      { type: "image/svg+xml" },
    ),
    assertPreview: container => {
      expect(container.querySelector("img[alt='logo.svg']")).toBeInTheDocument();
      expect(container.querySelector("img")).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    },
  },
  {
    name: "interview.mp3",
    contentType: "audio/mpeg",
    body: new Blob(["audio fixture"], { type: "audio/mpeg" }),
    assertPreview: container => expect(container.querySelector("audio")).toBeInTheDocument(),
  },
  {
    name: "interview.flac",
    contentType: "audio/flac",
    body: new Blob([new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0x00, 0x00, 0x00, 0x22])], { type: "audio/flac" }),
    assertPreview: container => {
      expect(container.querySelector("audio[controls]")).toBeInTheDocument();
      expect(container.querySelector("audio")).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    },
  },
  {
    name: "interview.ogg",
    contentType: "application/ogg",
    body: new Blob([new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00])], { type: "application/ogg" }),
    assertPreview: container => {
      expect(container.querySelector("audio[controls]")).toBeInTheDocument();
      expect(container.querySelector("audio")).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    },
  },
  {
    name: "walkthrough.mp4",
    contentType: "video/mp4",
    body: new Blob(["video fixture"], { type: "video/mp4" }),
    assertPreview: container => expect(container.querySelector("video")).toBeInTheDocument(),
  },
  {
    name: "walkthrough.webm",
    contentType: "application/octet-stream",
    body: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81])], { type: "video/webm" }),
    assertPreview: container => {
      expect(container.querySelector("video[controls]")).toBeInTheDocument();
      expect(container.querySelector("video")).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    },
  },
  {
    name: "brief.pdf",
    contentType: "application/pdf",
    body: new Blob(["%PDF-1.4\nfixture"], { type: "application/pdf" }),
    assertPreview: container => expect(container.querySelector("iframe")).toBeInTheDocument(),
  },
  {
    name: "notes.txt",
    contentType: "text/plain",
    body: new Blob(["Interview notes: strong systems thinking."], { type: "text/plain" }),
    assertPreview: container => {
      expect(container.querySelector("pre")).toBeInTheDocument();
      expect(container).toHaveTextContent("strong systems thinking");
    },
  },
  {
    name: "interview-notes.docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    body: new Blob([Buffer.from(DOCX_FIXTURE_BASE64, "base64")], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
    assertPreview: container => {
      expect(container).toHaveTextContent("Robotics interview DOCX fixture");
      expect(container).toHaveTextContent("document preview");
    },
  },
];

beforeEach(() => {
  delete window.officeParser;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(await (fixtures.find(fixture => fixture.name === "scores.csv")?.body ?? new Blob()).arrayBuffer(), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    ),
  );
});

describe("chat attachment inline previews", () => {
  it("renders generated images, safe SVG, storage-backed files, and mini-tools together in Markdown", async () => {
    vi.mocked(fetch).mockImplementation(async input => {
      const url = String(input);
      const isPdf = url.includes("brief.pdf");
      return new Response(isPdf ? "%PDF-1.4\nfixture" : "generated image fixture", {
        status: 200,
        headers: { "content-type": isPdf ? "application/pdf" : "image/png" },
      });
    });
    const source = [
      "Generated content:",
      "",
      "![Generated image](/api/storage/objects/generated-image)",
      "",
      "[brief.pdf](/api/storage/objects/brief.pdf)",
      "",
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
      "",
      "```robotics-mini-tool",
      JSON.stringify({
        type: "checklist",
        title: "Build checklist",
        items: ["Check the wheels"],
      }),
      "```",
    ].join("\n");
    const { container } = render(<MarkdownContent source={source} />);

    await waitFor(() => {
      expect(container.querySelector("img[alt='Generated image']")).toBeInTheDocument();
      expect(container.querySelector("iframe[title='brief.pdf']")).toBeInTheDocument();
    });
    expect(container.querySelector("svg circle")).toBeInTheDocument();
    expect(container.querySelector('[data-testid="chat-mini-tool"]')).toHaveTextContent("Build checklist");
    const renderedResourceAttributes = Array.from(container.querySelectorAll("[src], [href], [poster]"))
      .flatMap(element => Array.from(element.attributes, attribute => attribute.value));
    expect(renderedResourceAttributes.some(value => value.includes("/api/storage/"))).toBe(false);
  });

  it("shows a safe fallback for an invalid mini-tool block", () => {
    const { container } = render(
      <MarkdownContent source={"```robotics-mini-tool\n" + JSON.stringify({
        type: "hosted-app",
        title: "Unsupported",
        html: "<script>window.location='https://example.com'</script>",
      }) + "\n```"} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("This interactive preview is unavailable.");
    expect(container.querySelector("script, iframe, a")).not.toBeInTheDocument();
  });

  it.each(fixtures)("$name renders inline without a storage link", async fixture => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(await fixture.body.arrayBuffer(), {
        status: 200,
        headers: { "content-type": fixture.contentType },
      }),
    );

    const { container } = render(
      <div>{renderInlineMarkdown(`[${fixture.name}](/api/storage/objects/fixture-${fixture.name})`)}</div>,
    );

    await waitFor(() => fixture.assertPreview(container), { timeout: 15_000 });

    const renderedResourceAttributes = Array.from(container.querySelectorAll("[src], [href], [poster]"))
      .flatMap(element => Array.from(element.attributes, attribute => attribute.value));
    expect(renderedResourceAttributes.some(value => value.includes("/api/storage/"))).toBe(false);
  });

  it.each(officeAttachmentFixtures)("$name renders readable office or JSON content inline", async fixture => {
    const isJson = fixture.name.endsWith(".json") || fixture.contentType === "application/json";
    if (!isJson) {
      window.officeParser = {
        parseOffice: vi.fn(async file => ({
          toMarkdown: () => `# ${fixture.expectedText} · ${file instanceof File ? file.name : "office file"}`,
        })),
      };
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(await fixture.body.arrayBuffer(), {
        status: 200,
        headers: { "content-type": fixture.contentType },
      }),
    );

    const { container } = render(
      <div>{renderInlineMarkdown(`[${fixture.name}](/api/storage/objects/fixture-${fixture.name})`)}</div>,
    );

    const preview = await screen.findByTestId("text-attachment-preview", undefined, { timeout: 15_000 });
    expect(preview).toHaveTextContent(fixture.expectedText);
    if (isJson) {
      expect(() => JSON.parse(preview.textContent ?? "")).not.toThrow();
      expect(preview.textContent).toContain('\n  "');
    } else {
      expect(window.officeParser?.parseOffice).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        expect.objectContaining({ extractAttachments: false }),
      );
    }
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
  });

  it.each([
    { name: "broken.pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", body: new Blob(["not a presentation"]) },
    { name: "broken.json", contentType: "application/json", body: new Blob(['{"missing":'], { type: "application/json" }) },
  ])("$name has an accessible download fallback when parsing fails", async fixture => {
    if (fixture.name.endsWith(".pptx")) {
      window.officeParser = { parseOffice: vi.fn().mockRejectedValue(new Error("Invalid presentation")) };
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(await fixture.body.arrayBuffer(), {
        status: 200,
        headers: { "content-type": fixture.contentType },
      }),
    );

    const { container } = render(
      <div>{renderInlineMarkdown(`[${fixture.name}](/api/storage/objects/broken-${fixture.name})`)}</div>,
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(`Couldn’t preview ${fixture.name}`);
    expect(within(alert).getByRole("link", { name: `Download ${fixture.name}` })).toHaveAttribute(
      "href",
      expect.stringMatching(/^blob:/),
    );
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("keeps a HEIC image preview when the browser reports a successful load", async () => {
    const fixture = fixtures.find(item => item.name === "portrait.heic")!;
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(await fixture.body.arrayBuffer(), {
        status: 200,
        headers: { "content-type": fixture.contentType },
      }),
    );

    const { container } = render(
      <div>{renderInlineMarkdown(`[${fixture.name}](/api/storage/objects/fixture-${fixture.name})`)}</div>,
    );
    const image = await waitFor(() => {
      const preview = container.querySelector<HTMLImageElement>("img");
      expect(preview).toBeInTheDocument();
      return preview!;
    });

    fireEvent.load(image);

    expect(image).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/couldn’t preview/i);
    const { default: heic2any } = await import("heic2any");
    expect(heic2any).not.toHaveBeenCalled();
  });

  it("converts a HEIC image to a browser-supported preview after decode failure", async () => {
    const fixture = fixtures.find(item => item.name === "portrait.heic")!;
    const { default: heic2any } = await import("heic2any");
    vi.mocked(heic2any).mockResolvedValueOnce(new Blob(["converted JPEG"], { type: "image/jpeg" }));
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce("blob:heic-source")
      .mockReturnValueOnce("blob:heic-jpeg-preview");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(await fixture.body.arrayBuffer(), {
        status: 200,
        headers: { "content-type": fixture.contentType },
      }),
    );

    const { container } = render(
      <div>{renderInlineMarkdown(`[${fixture.name}](/api/storage/objects/fixture-${fixture.name})`)}</div>,
    );
    const image = await waitFor(() => {
      const preview = container.querySelector<HTMLImageElement>("img");
      expect(preview).toBeInTheDocument();
      return preview!;
    });
    const originalPreviewUrl = image.getAttribute("src");

    fireEvent.error(image);

    await waitFor(() => {
      const convertedPreview = container.querySelector<HTMLImageElement>("img");
      expect(convertedPreview).toBeInTheDocument();
      expect(convertedPreview).not.toHaveAttribute("src", originalPreviewUrl);
      expect(convertedPreview).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    });
    expect(heic2any).toHaveBeenCalledWith(expect.objectContaining({ toType: "image/jpeg" }));
    const renderedResourceAttributes = Array.from(container.querySelectorAll("[src], [href], [poster]"))
      .flatMap(element => Array.from(element.attributes, attribute => attribute.value));
    expect(renderedResourceAttributes.some(value => value.includes("/api/storage/"))).toBe(false);
  });

  it("shows a clear fallback when a HEIC image cannot be decoded or converted", async () => {
    const fixture = fixtures.find(item => item.name === "portrait.heic")!;
    const { default: heic2any } = await import("heic2any");
    vi.mocked(heic2any).mockRejectedValueOnce(new Error("HEIC conversion unavailable"));
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(await fixture.body.arrayBuffer(), {
        status: 200,
        headers: { "content-type": fixture.contentType },
      }),
    );

    const { container } = render(
      <div>{renderInlineMarkdown(`[${fixture.name}](/api/storage/objects/fixture-${fixture.name})`)}</div>,
    );
    const image = await waitFor(() => {
      const preview = container.querySelector<HTMLImageElement>("img");
      expect(preview).toBeInTheDocument();
      return preview!;
    });

    fireEvent.error(image);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Couldn’t preview portrait.heic. Try opening it in an app that supports HEIC.",
    );
    expect(container.querySelector("img")).not.toBeInTheDocument();
    const renderedResourceAttributes = Array.from(container.querySelectorAll("[src], [href], [poster]"))
      .flatMap(element => Array.from(element.attributes, attribute => attribute.value));
    expect(renderedResourceAttributes.some(value => value.includes("/api/storage/"))).toBe(false);
  });
});

describe("chat mention rendering", () => {
  it("highlights a known interviewer and reveals their profile details on focus", async () => {
    const person = {
      token: "Ishaan",
      label: "Ishaan",
      detail: "Interviewer · tryout team",
      initials: "I",
      kind: "interviewer" as const,
    };
    const { container } = render(
      <TooltipProvider>{renderInlineMarkdown("Thanks, @Ishaan!", [person])}</TooltipProvider>,
    );

    const mention = container.querySelector('[data-testid="chat-mention-ishaan"]');
    expect(mention).toHaveTextContent("@Ishaan");
    fireEvent.focus(mention as HTMLElement);
    await waitFor(() => expect(screen.getByText("Interviewer · tryout team")).toBeVisible());
  });

  it("renders an applicant reference with roster context on focus", async () => {
    const applicant = {
      token: "Applicant Casey Nguyen (Grade 6)",
      label: "Casey Nguyen",
      detail: "Applicant · Grade 6 · Queue #4",
      initials: "CN",
      kind: "applicant" as const,
    };
    const { container } = render(
      <TooltipProvider>{renderInlineMarkdown("Please review @Applicant Casey Nguyen (Grade 6).", [applicant])}</TooltipProvider>,
    );

    const mention = container.querySelector(".chat-mention");
    expect(mention).toHaveTextContent("@Applicant Casey Nguyen (Grade 6)");
    fireEvent.focus(mention as HTMLElement);
    await waitFor(() => expect(screen.getByText("Applicant · Grade 6 · Queue #4")).toBeVisible());
  });
});