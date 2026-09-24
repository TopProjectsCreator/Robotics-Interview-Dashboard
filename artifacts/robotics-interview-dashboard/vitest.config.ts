import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import path from "node:path";

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
    include: ["src/**/*.test.tsx"],
    setupFiles: ["./src/test-setup.ts"],
  },
});