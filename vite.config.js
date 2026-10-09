import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        portal: resolve(__dirname, "index.html"),
        chat: resolve(__dirname, "chat/index.html"),
        security: resolve(__dirname, "security/index.html"),
      },
    },
  },
});
