// client/vite.config.ts
import { defineConfig } from "vite";
export default defineConfig({
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
        },
      },
    },
  },
});
