import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { build as esbuild } from "esbuild";

function buildServer() {
  return {
    name: "build-server",
    closeBundle: async () => {
      await esbuild({
        entryPoints: ["server/index.ts"],
        bundle: true,
        platform: "node",
        packages: "external",
        format: "cjs",
        outfile: "dist/index.cjs",
      });
      console.log("✅ Server compiled: dist/index.cjs");
    },
  };
}

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: true,
    strictPort: true,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), buildServer()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
