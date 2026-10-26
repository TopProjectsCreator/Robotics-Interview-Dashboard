import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CadModelViewer } from "./CadModelViewer";
import { workspaceAttachmentKind } from "./WorkspaceFileViewer";
import { cadRenderFormat } from "../lib/cadFormats";
import { cadUploadContentType } from "../lib/cadUpload";
import { officeAttachmentFixtures } from "../test-fixtures/officeAttachments";

vi.mock("@google/model-viewer", () => ({}));
vi.mock("./ChatGlbViewer", () => ({ ChatGlbViewer: ({ name }: { name: string }) => <div>{name}</div> }));
vi.mock("./ChatParasolidViewer", () => ({ ChatParasolidViewer: ({ name }: { name: string }) => <div>{name}</div> }));
vi.mock("./ChatStlViewer", () => ({ ChatStlViewer: ({ name }: { name: string }) => <div>{name}</div> }));
vi.mock("./ChatStepViewer", () => ({ ChatStepViewer: ({ name }: { name: string }) => <div>{name}</div> }));
vi.mock("./CadMeshViewer", () => ({ CadMeshViewer: ({ name }: { name: string }) => <div>{name}</div> }));
vi.mock("./CadThreeMfViewer", () => ({ CadThreeMfViewer: ({ name }: { name: string }) => <div>{name}</div> }));

beforeEach(() => {
  delete window.officeParser;
});

describe("CAD workspace office and JSON previews", () => {
  it.each(officeAttachmentFixtures)("$name is classified consistently and displays readable content", async fixture => {
    const isJson = fixture.name.endsWith(".json") || fixture.contentType === "application/json";
    if (!isJson) {
      window.officeParser = {
        parseOffice: vi.fn(async file => ({
          toMarkdown: () => `${fixture.expectedText} · ${file instanceof File ? file.name : "Office file"}`,
        })),
      };
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(await fixture.body.arrayBuffer(), {
        status: 200,
        headers: { "content-type": fixture.contentType },
      })),
    );

    const { container } = render(
      <CadModelViewer name={fixture.name} src={`/api/storage/objects/${fixture.name}`} contentType={fixture.contentType} />,
    );
    const preview = await screen.findByTestId("text-attachment-preview");

    expect(preview).toHaveTextContent(fixture.expectedText);
    expect(cadRenderFormat(fixture.name, fixture.contentType)).toBe(workspaceAttachmentKind(fixture.name, fixture.contentType));
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
    if (isJson) {
      expect(() => JSON.parse(preview.textContent ?? "")).not.toThrow();
      expect(preview.textContent).toContain('\n  "');
    } else {
      expect(window.officeParser?.parseOffice).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        expect.objectContaining({ extractAttachments: false }),
      );
    }
  });

  it("uses extension MIME defaults when workspace files have vague browser types", () => {
    expect(cadUploadContentType(new File(["ppt"], "brief.ppt", { type: "application/octet-stream" }))).toBe("application/vnd.ms-powerpoint");
    expect(cadUploadContentType(new File(["ods"], "scores.ods", { type: "" }))).toBe("application/vnd.oasis.opendocument.spreadsheet");
    expect(cadUploadContentType(new File(['{"ready":true}'], "robot.json", { type: "" }))).toBe("application/json");
    expect(cadRenderFormat("brief.ppt", "application/octet-stream")).toBe("presentation");
    expect(cadRenderFormat("robot.json", "application/octet-stream")).toBe("text");
  });

  it.each([
    { name: "broken.ppt", contentType: "application/vnd.ms-powerpoint", body: new Blob(["broken"]) },
    { name: "broken.json", contentType: "application/json", body: new Blob(['{"bad":'], { type: "application/json" }) },
  ])("$name shows a non-blank accessible download fallback when parsing fails", async fixture => {
    if (fixture.name.endsWith(".ppt")) {
      window.officeParser = { parseOffice: vi.fn().mockRejectedValue(new Error("Invalid Office document")) };
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(await fixture.body.arrayBuffer(), {
        status: 200,
        headers: { "content-type": fixture.contentType },
      })),
    );

    render(<CadModelViewer name={fixture.name} src={`/api/storage/objects/${fixture.name}`} contentType={fixture.contentType} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(`Couldn’t preview ${fixture.name}`);
    expect(within(alert).getByRole("link", { name: `Download ${fixture.name}` })).toHaveAttribute(
      "href",
      expect.stringMatching(/^blob:/),
    );
  });
});
