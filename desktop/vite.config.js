import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// Tauri expects a fixed dev port and must not clear its own Rust output.
export default defineConfig({
  plugins: [preact()],
  clearScreen: false,
  // Stand-alone: do not inherit the web app's postcss/tailwind config.
  css: { postcss: {} },
  server: { port: 2406, strictPort: true },
  build: {
    target: "chrome110", // WebView2 is evergreen Chromium
    cssMinify: true,
    reportCompressedSize: false,
  },
  test: {
    include: ["src/**/*.test.js"],
  },
});
