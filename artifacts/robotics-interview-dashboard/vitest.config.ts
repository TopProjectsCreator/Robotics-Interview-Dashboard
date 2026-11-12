import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import path from "node:path";

// The surrounding shell may export NODE_ENV=production, which loads the
// production react-dom build and breaks @testing-library/react's act().
// Tests must always resolve the development/test builds.
process.env.NODE_ENV = "test";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "open-color/open-color.json": path.resolve(import.meta.dirname, "src/test-stubs/open-color.ts"),
      "@excalidraw/excalidraw/index.css": path.resolve(import.meta.dirname, "src/test-stubs/empty.css"),
      "@excalidraw/excalidraw": path.resolve(import.meta.dirname, "src/test-stubs/excalidraw.tsx"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
    setupFiles: ["./src/test-setup.ts"],
  },
});