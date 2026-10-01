import { createRoot } from "react-dom/client";

import { renderInlineMarkdown } from "./App";

const fixtureNames = [
  "robotics-clip.webm",
  "interview-tone.flac",
  "interview-tone.ogg",
  "unsupported-alac.m4a",
  "unsupported-hevc.mp4",
];

const root = document.getElementById("root");
if (!root) throw new Error("Browser test root is missing");

createRoot(root).render(
  <main>
    {fixtureNames.map(name => (
      <section key={name} data-testid={`preview-${name}`}>
        <h2>{name}</h2>
        {renderInlineMarkdown(`[${name}](/api/storage/objects/fixture-${name})`)}
      </section>
    ))}
  </main>,
);