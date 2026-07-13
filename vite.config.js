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
  // Tests transform JSX via esbuild; use React's automatic runtime so component
  // files don't need an explicit `import React`.
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (REACT_VENDOR_RE.test(id)) return "react-vendor";

          return id
            .toString()
            .split("node_modules/")[1]
            .split("/")[0]
            .toString();
        },
      },
    },
    chunkSizeWarningLimit: 6000000,
  },
});
