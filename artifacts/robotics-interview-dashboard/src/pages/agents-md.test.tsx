import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import canonicalBriefing from "../../public/AGENTS.md?raw";
import AgentsMdPage from "./agents-md";

function mockBriefingResponse(markdown: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    text: async () => markdown,
  }));
}

function sourceSectionHeadings(markdown: string) {
  return [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1].trim());
}

describe("AgentsMdPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    mockBriefingResponse(canonicalBriefing);
  });

  it("renders canonical briefing content and links its source headings", async () => {
    render(<AgentsMdPage />);

    const article = screen.getByTestId("agents-md-article");
    await waitFor(() => expect(article).toHaveTextContent("Server is referee"));
    expect(article).toHaveTextContent("Cross-team reads return nothing");
    expect(article).toHaveTextContent("Why it's safe");

    const navigation = screen.getByTestId("agents-md-toc-nav");
    const sectionHeadings = sourceSectionHeadings(canonicalBriefing);
    for (const title of sectionHeadings) {
      const link = within(navigation).getByRole("link", { name: title });
      const id = link.getAttribute("href")?.slice(1);
      expect(id).toBeTruthy();
      const target = id ? document.getElementById(id) : null;
      expect(target).toBeInTheDocument();
      expect(article).toContainElement(target);
      expect(target).toHaveTextContent(title);
    }
    expect(within(navigation).getAllByRole("link")).toHaveLength(sectionHeadings.length);
  });

  it("renders changed source content and keeps the raw copy and download actions", async () => {
    const changedBriefing = "# Canonical title\n\n## New source section\n\nA newly added canonical detail.\n";
    mockBriefingResponse(changedBriefing);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<AgentsMdPage />);

    expect(await screen.findByRole("heading", { name: "New source section" })).toBeInTheDocument();
    expect(screen.getByText("A newly added canonical detail.")).toBeInTheDocument();
    expect(screen.getByTestId("agents-md-toc-new-source-section")).toHaveAttribute("href", "#new-source-section");
    expect(screen.getByTestId("link-download-agents-md")).toHaveAttribute("href", "/AGENTS.md");
    expect(screen.getByTestId("link-download-agents-md")).toHaveAttribute("download", "AGENTS.md");

    fireEvent.click(screen.getByTestId("button-copy-agents-md"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(changedBriefing));
    expect(screen.getByTestId("link-agents-md-raw")).toHaveAttribute("href", "/AGENTS.md");
  });

  it("removes unsafe markup from the rendered Markdown", async () => {
    mockBriefingResponse("# Briefing\n\n## Safe heading\n\n<script>window.compromised = true</script>\n");
    render(<AgentsMdPage />);

    const article = screen.getByTestId("agents-md-article");
    await waitFor(() => expect(article.querySelector("h2")).toHaveTextContent("Safe heading"));
    expect(article.querySelector("script")).not.toBeInTheDocument();
    expect(article).not.toHaveTextContent("window.compromised");
  });
});
