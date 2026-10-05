import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownContent } from "./App";

vi.mock("@google/model-viewer", () => ({}));
vi.mock("heic2any", () => ({ default: vi.fn() }));

describe("markdown details blocks", () => {
  it("renders a collapsed disclosure with the summary label", () => {
    const { container } = render(
      <MarkdownContent source={"Before\n\n<details>\n<summary>Show **reasoning**</summary>\n\nHidden body text\n\n</details>\n\nAfter"} />,
    );

    const details = container.querySelector("details.chat-markdown-details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    const summary = within(details as HTMLElement).getByText(/Show/);
    expect(summary.textContent).toBe("Show reasoning");
    expect(within(details as HTMLElement).getByText("reasoning").tagName).toBe("STRONG");
    expect(within(details as HTMLElement).getByText("Hidden body text")).toBeInTheDocument();
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
  });

  it("honours the open attribute", () => {
    const { container } = render(<MarkdownContent source={'<details open>\n<summary>Open me</summary>\nBody\n</details>'} />);
    expect(container.querySelector("details.chat-markdown-details")).toHaveAttribute("open");
  });

  it("renders markdown block structure inside the body", () => {
    const { container } = render(
      <MarkdownContent
        source={"<details>\n<summary>Breakdown</summary>\n\n1. First\n2. Second\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n</details>"}
      />,
    );

    const details = container.querySelector("details.chat-markdown-details") as HTMLElement;
    expect(within(details).getAllByRole("listitem")).toHaveLength(2);
    expect(within(details).getByRole("table")).toBeInTheDocument();
    expect(within(details).getByText("Second")).toBeInTheDocument();
  });

  it("supports nested details", () => {
    const { container } = render(
      <MarkdownContent
        source={"<details>\n<summary>Outer</summary>\n\n<details>\n<summary>Inner</summary>\n\nDeep body\n\n</details>\n\n</details>"}
      />,
    );

    const details = container.querySelectorAll("details.chat-markdown-details");
    expect(details).toHaveLength(2);
    const outer = details[0] as HTMLElement;
    const inner = outer.querySelector("details.chat-markdown-details") as HTMLElement;
    expect(within(outer).getByText("Outer")).toBeInTheDocument();
    expect(within(inner).getByText("Deep body")).toBeInTheDocument();
  });

  it("renders multiple sibling details blocks in source order", () => {
    const { container } = render(
      <MarkdownContent source={"<details>\n<summary>First</summary>\nOne\n</details>\n\n<details>\n<summary>Second</summary>\nTwo\n</details>"} />,
    );

    const labels = Array.from(container.querySelectorAll("details.chat-markdown-details summary")).map(node => node.textContent);
    expect(labels).toEqual(["First", "Second"]);
  });

  it("keeps surrounding prose and svg blocks intact", () => {
    const { container } = render(
      <MarkdownContent
        source={'Intro line\n\n<details>\n<summary>Chart data</summary>\nUnderlying numbers\n</details>\n\n<svg width="10" height="10"><rect width="10" height="10" /></svg>\n\nOutro line'}
      />,
    );

    expect(screen.getByText("Intro line")).toBeInTheDocument();
    expect(screen.getByText("Outro line")).toBeInTheDocument();
    expect(container.querySelector("details.chat-markdown-details")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("falls back to a default label and body when no summary is present", () => {
    const { container } = render(<MarkdownContent source={"<details>\nBody without summary\n</details>"} />);
    const details = container.querySelector("details.chat-markdown-details") as HTMLElement;
    expect(within(details).getByText("Details")).toBeInTheDocument();
    expect(within(details).getByText("Body without summary")).toBeInTheDocument();
  });

  it("leaves an unclosed details tag as literal text", () => {
    const { container } = render(<MarkdownContent source={"<details>\n<summary>Broken</summary>\nNo closing tag"} />);
    expect(container.querySelector("details.chat-markdown-details")).toBeNull();
    expect(screen.getByText(/No closing tag/)).toBeInTheDocument();
  });

  it("never injects raw html from inside a details body", () => {
    const { container } = render(
      <MarkdownContent source={'<details>\n<summary>Payload</summary>\n<img src=x onerror="alert(1)">\n</details>'} />,
    );
    const details = container.querySelector("details.chat-markdown-details") as HTMLElement;
    expect(details.querySelector("img")).toBeNull();
    expect(details.textContent).toContain("onerror");
  });
});
