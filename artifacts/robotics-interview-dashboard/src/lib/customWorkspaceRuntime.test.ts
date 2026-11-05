import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { compileWorkspaceSourceFiles, sandboxDocument } from "./customWorkspaceRuntime";

describe("custom workspace runtime", () => {
  it("inlines safe standalone SVG files used by images and styles", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h4v4H0z"/></svg>';
    const html = compileWorkspaceSourceFiles([
      { path: "index.html", content: '<img src="./assets/robot.svg"><style>.robot{background:url("./assets/robot.svg")}</style>' },
      { path: "assets/robot.svg", content: svg },
    ]);

    expect(html).toContain("data:image/svg+xml;charset=utf-8,");
    expect(html).toContain(encodeURIComponent(svg));
    expect(html).not.toContain("./assets/robot.svg");
  });

  it("does not inline SVG files that contain script or external references", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.invalid/image.png"/></svg>';
    const html = compileWorkspaceSourceFiles([
      { path: "index.html", content: '<img src="./assets/robot.svg">' },
      { path: "assets/robot.svg", content: svg },
    ]);

    expect(html).toContain('src="./assets/robot.svg"');
    expect(html).not.toContain("data:image/svg+xml");
  });

  it("keeps the iframe isolated and injects the selected theme", () => {
    const sandbox = sandboxDocument("<main>Preview</main>", true, ".mono { font-family: monospace; }");

    expect(sandbox).toContain(`Content-Security-Policy`);
    expect(sandbox).toContain(`connect-src 'none'`);
    expect(sandbox).toContain(`window.workspaceAPI`);
    expect(sandbox).toContain(`event.data.channel !== "workspace-tab"`);
    expect(sandbox).toContain(`[data-workspace-tab]`);
    expect(sandbox).toContain(`data-dashboard-stylesheet`);
    expect(sandbox).toContain(`.mono`);
    expect(sandbox).toContain(`--workspace-teal: #16869a`);
    expect(sandbox).toContain('<html class="dark">');
  });

  it("preserves tab markup for the host-controlled sidebar", () => {
    const sandbox = sandboxDocument(
      '<main><section data-workspace-tab="overview">Overview</section><section data-workspace-tab="reports">Reports</section></main>',
      false,
    );

    expect(sandbox).toContain('data-workspace-tab="overview"');
    expect(sandbox).toContain('data-workspace-tab="reports"');
    expect(sandbox).toContain('workspace:tabchange');
  });

  it("shows only the section selected by the host sidebar", () => {
    const sandbox = sandboxDocument(
      '<main><section data-workspace-tab="overview">Overview</section><section data-workspace-tab="reports">Reports</section></main>',
      false,
    );
    const dom = new JSDOM(sandbox, { runScripts: "dangerously" });
    try {
      dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
        data: { channel: "workspace-tab", id: "reports" },
        source: dom.window,
      }));

      const overview = dom.window.document.querySelector<HTMLElement>('[data-workspace-tab="overview"]');
      const reports = dom.window.document.querySelector<HTMLElement>('[data-workspace-tab="reports"]');
      expect(overview?.hidden).toBe(true);
      expect(overview?.style.getPropertyValue("display")).toBe("none");
      expect(reports?.hidden).toBe(false);
    } finally {
      dom.window.close();
    }
  });
});
