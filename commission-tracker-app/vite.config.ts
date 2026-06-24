import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // Necesario para GitHub Pages de proyecto: el sitio vive en /commission-tracker/
  base: "/commission-tracker/",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
