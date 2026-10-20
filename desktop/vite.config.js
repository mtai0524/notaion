import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// Tauri expects a fixed dev port and must not clear its own Rust output.
export default defineConfig({
  plugins: [preact()],
  clearScreen: false,
  // Stand-alone: do not inherit the web app's postcss/tailwind config.
  css: { postcss: {} },
  // The daily view is the web app's TUI (../src). Resolve the packages those
  // files import from desktop/node_modules — CI only installs this folder.
  // (react / react-dom are aliased to preact/compat by the preset.)
  resolve: { dedupe: ["preact", "prop-types", "date-fns", "react-icons", "react-beautiful-dnd"] },
  // `..` so dev can import ../shared (export logic shared with the web app).
  server: { port: 2406, strictPort: true, fs: { allow: [".."] } },
  build: {
    target: "chrome110", // WebView2 is evergreen Chromium
    cssMinify: true,
    reportCompressedSize: false,
  },
  test: {
    include: ["src/**/*.test.js"],
  },
});
