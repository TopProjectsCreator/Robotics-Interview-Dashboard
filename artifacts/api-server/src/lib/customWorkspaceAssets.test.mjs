import assert from "node:assert/strict";
import test from "node:test";
import { inlineLocalSvgAssets } from "./customWorkspaceAssets.ts";

test("inlines safe local SVGs referenced by HTML and CSS", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h4v4H0z"/></svg>';
  const result = inlineLocalSvgAssets(
    '<img src="./assets/robot.svg"><style>.robot{background:url("./assets/robot.svg")}</style>',
    [{ path: "assets/robot.svg", content: svg }],
  );

  assert.equal((result.match(/data:image\/svg\+xml;charset=utf-8,/g) ?? []).length, 2);
  assert.ok(result.includes(encodeURIComponent(svg)));
  assert.ok(!result.includes("./assets/robot.svg"));
});

test("leaves unsafe SVG assets unembedded", () => {
  const scriptSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  const remoteSvg = '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.invalid/image.png"/></svg>';
  const result = inlineLocalSvgAssets(
    '<img src="./assets/script.svg"><img src="./assets/remote.svg">',
    [
      { path: "assets/script.svg", content: scriptSvg },
      { path: "assets/remote.svg", content: remoteSvg },
    ],
  );

  assert.ok(result.includes('src="./assets/script.svg"'));
  assert.ok(result.includes('src="./assets/remote.svg"'));
  assert.ok(!result.includes("data:image/svg+xml"));
});
