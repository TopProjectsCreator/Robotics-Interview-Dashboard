import { fireEvent, render, screen } from "@testing-library/react";
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

  it("explains that external websites may prohibit embedding", () => {
    render(
      <WhiteboardEditor
        whiteboard={null}
        saving={false}
        error=""
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.getByTestId("whiteboard-embed-policy-note")).toHaveTextContent(
      "Some websites prohibit iframe embedding.",
    );
    expect(screen.getByTestId("whiteboard-embed-policy-note")).toHaveTextContent(
      "security settings may be responsible",
    );
  });

  it("offers a safe new-tab link only for a selected valid website embed", () => {
    render(
      <WhiteboardEditor
        whiteboard={null}
        saving={false}
        error=""
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.queryByTestId("link-open-embedded-site")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-select-test-embed"));

    const link = screen.getByTestId("link-open-embedded-site");
    expect(link).toHaveAttribute("href", "https://example.com/board");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not offer a new-tab link for an unsafe selected embed URL", () => {
    render(
      <WhiteboardEditor
        whiteboard={null}
        saving={false}
        error=""
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("button-select-invalid-test-embed"));

    expect(screen.queryByTestId("link-open-embedded-site")).not.toBeInTheDocument();
  });
});
