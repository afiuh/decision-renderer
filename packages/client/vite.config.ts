import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7342,
    proxy: {
      "/api": "http://127.0.0.1:7341",
      "/ws": { target: "ws://127.0.0.1:7341", ws: true },
    },
  },
  build: { outDir: "dist" },
});
