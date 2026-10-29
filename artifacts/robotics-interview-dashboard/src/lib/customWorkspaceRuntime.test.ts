import { describe, expect, it } from "vitest";
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
    const sandbox = sandboxDocument("<main>Preview</main>", true);

    expect(sandbox).toContain(`Content-Security-Policy`);
    expect(sandbox).toContain(`connect-src 'none'`);
    expect(sandbox).toContain(`window.workspaceAPI`);
    expect(sandbox).toContain('<html class="dark">');
  });
});
