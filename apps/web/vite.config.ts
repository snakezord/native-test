import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Pre-bundle workspace packages for faster development
    include: [],
  },
  ssr: {
    // Externalize workspace packages in SSR to prevent issues
    noExternal: [],
  },
});
