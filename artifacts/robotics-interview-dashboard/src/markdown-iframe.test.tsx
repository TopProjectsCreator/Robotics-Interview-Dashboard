import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownContent } from "./App";

vi.mock("@google/model-viewer", () => ({}));
vi.mock("heic2any", () => ({ default: vi.fn() }));

const YOUTUBE_SNIPPET = `<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="YouTube video player" frameborder="0" allowfullscreen></iframe>`;

describe("markdown iframe embeds", () => {
  it("renders a pasted iframe snippet as a sandboxed embed", () => {
    const { container } = render(
      <MarkdownContent source={`Before\n\n${YOUTUBE_SNIPPET}\n\nAfter`} />,
    );

    const embed = container.querySelector('[data-testid="chat-iframe-embed"]') as HTMLElement;
    expect(embed).not.toBeNull();
    const frame = embed.querySelector("iframe") as HTMLIFrameElement;
    expect(frame).toHaveAttribute("src", "https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(frame.getAttribute("sandbox")).toContain("allow-scripts");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-top-navigation");
    expect(frame).toHaveAttribute("title", "YouTube video player");
    expect(frame).toHaveAttribute("allowfullscreen");
    expect(frame.parentElement?.style.maxWidth).toBe("560px");
    expect(frame.style.aspectRatio).toBe("560 / 315");
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
  });

  it("renders a self-closing snippet without a closing tag", () => {
    const { container } = render(
      <MarkdownContent source={'<iframe src="https://www.openstreetmap.org/export/embed.html" />'} />,
    );
    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame).toHaveAttribute("src", "https://www.openstreetmap.org/export/embed.html");
  });

  it("falls back to a default title from the host", () => {
    const { container } = render(
      <MarkdownContent source={'<iframe src="https://player.vimeo.com/video/1"></iframe>'} />,
    );
    const frame = container.querySelector("iframe")!;
    expect(frame).toHaveAttribute("title", "player.vimeo.com embed");
  });

  it("honours a height-only embed with a clamped fixed height", () => {
    const { container } = render(
      <MarkdownContent source={'<iframe height="4000" src="https://docs.google.com/document/d/x"></iframe>'} />,
    );
    const embed = container.querySelector('[data-testid="chat-iframe-embed"]') as HTMLElement;
    const frame = embed.querySelector("iframe") as HTMLIFrameElement;
    expect(frame.style.height).toBe("900px");
  });

  it("blocks javascript: srcs", () => {
    const { container } = render(<MarkdownContent source={'<iframe src="javascript:alert(1)"></iframe>'} />);
    expect(container.querySelector('[data-testid="chat-iframe-blocked"]')).not.toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("blocks same-origin and http snippets", () => {
    const { container } = render(
      <MarkdownContent source={'<iframe src="/api/queue/chat"></iframe>\n\n<iframe src="http://insecure.example.com"></iframe>'} />,
    );
    expect(container.querySelectorAll('[data-testid="chat-iframe-blocked"]')).toHaveLength(2);
  });

  it("renders several snippets in source order", () => {
    const { container } = render(
      <MarkdownContent source={`${YOUTUBE_SNIPPET}\n\n<iframe src="https://player.vimeo.com/video/1"></iframe>`} />,
    );
    const frames = Array.from(container.querySelectorAll('[data-testid="chat-iframe-embed"] iframe'));
    expect(frames.map(frame => (frame as HTMLIFrameElement).title)).toEqual([
      "YouTube video player",
      "player.vimeo.com embed",
    ]);
  });
});

describe("markdown iframe inside code fences", () => {
  it("keeps a fenced snippet as text and the after-fence prose intact", () => {
    const { container } = render(
      <MarkdownContent source={"```\n<iframe src=\"https://www.youtube.com/embed/x\"></iframe>\n```\n\nVisible text"} />,
    );

    expect(container.querySelector('[data-testid="chat-iframe-embed"]')).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText("Visible text")).toBeInTheDocument();
    expect(container.textContent).toContain("iframe");
  });
});

describe("markdown iframe collapse", () => {
  it("hides and restores the frame through the header toggle", () => {
    const { container } = render(<MarkdownContent source={YOUTUBE_SNIPPET} />);

    const embed = container.querySelector('[data-testid="chat-iframe-embed"]') as HTMLElement;
    expect(embed.querySelector("iframe")).not.toBeNull();
    fireEvent.click(within(embed).getByTestId("chat-iframe-toggle"));
    expect(embed.querySelector("iframe")).toBeNull();
    expect(within(embed).getByTestId("chat-iframe-restore")).toHaveTextContent("Embed hidden");
    fireEvent.click(within(embed).getByTestId("chat-iframe-restore"));
    expect(embed.querySelector("iframe")).not.toBeNull();
  });
});
