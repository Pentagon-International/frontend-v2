import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  // Dev/prod default: serve from site root (/)
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@components": resolve(__dirname, "./src/components"),
      "@pages": resolve(__dirname, "./src/pages"),
      "@store": resolve(__dirname, "./src/store"),
      "@api": resolve(__dirname, "./src/api"),
      "@layout": resolve(__dirname, "./src/layout"),
      "@theme": resolve(__dirname, "./src/theme"),
      "@assets": resolve(__dirname, "./src/assets"),
    },
  },
  server: {
    port: 5173,
    open: true,
    cors: true,
  },
  build: {
    outDir: "dist",
    minify: "esbuild",
    sourcemap: false,
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (
            id.includes("plotly.js-basic-dist") ||
            id.includes("react-plotly.js")
          ) {
            return "plotly";
          }
          if (id.includes("pdfjs-dist")) {
            return "pdfjs";
          }
          if (id.includes("echarts") || id.includes("zrender")) {
            return "echarts";
          }
          if (id.includes("@mantine")) {
            return "mantine";
          }
          if (
            id.includes("react-dom") ||
            id.includes("react-router") ||
            id.includes("/react/")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
  // Define template name and metadata
  define: {
    "import.meta.env.VITE_APP_NAME": JSON.stringify("Pentafox Starter Kit"),
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      process.env.npm_package_version,
    ),
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: { skipLibCheck: true },
    },
  },
});
