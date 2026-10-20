import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const REACT_VENDOR_RE = /node_modules\/(react|react-dom|scheduler|its-fine|use-sync-external-store)(\/|$)/;

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 2405,
  },
  assetsInclude: ['**/*.md'],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vite/Rollup runtime helpers (lazy-import preloader, CJS interop)
          // live outside node_modules; without their own chunk Rollup parks
          // them in whatever vendor chunk it meets first — once that was the
          // three.js one, so every page downloaded three.js.
          if (id.includes("vite/preload-helper") || id.includes("commonjsHelpers")) return "vite-runtime";
          if (!id.includes("node_modules")) return;

          if (REACT_VENDOR_RE.test(id)) return "react-vendor";

          // One chunk per package. Scoped packages keep their full name so
          // e.g. @react-spring/web doesn't share a chunk with
          // @react-spring/three (which drags three.js into every page).
          const [scopeOrName, name] = id.split("node_modules/")[1].split("/");
          return scopeOrName.startsWith("@") ? `${scopeOrName}-${name}` : scopeOrName;
        },
      },
    },
    chunkSizeWarningLimit: 6000000,
  },
});
