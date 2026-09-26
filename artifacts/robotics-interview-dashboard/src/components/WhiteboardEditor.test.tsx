import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WhiteboardEditor } from "./WhiteboardEditor";

describe("WhiteboardEditor embed validation", () => {
  it("allows unlisted HTTP(S) hosts and rejects malformed or non-web URLs", () => {
    render(
      <WhiteboardEditor
        whiteboard={null}
        saving={false}
        error=""
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    const editor = screen.getByTestId("excalidraw-stub");
    expect(editor).toHaveAttribute("data-embed-valid-unlisted-http", "true");
    expect(editor).toHaveAttribute("data-embed-valid-unlisted-https", "true");
    expect(editor).toHaveAttribute("data-embed-invalid-malformed", "false");
    expect(editor).toHaveAttribute("data-embed-invalid-ftp", "false");
    expect(editor).toHaveAttribute("data-embed-invalid-javascript", "false");
  });
});