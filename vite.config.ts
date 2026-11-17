import { defineConfig } from "vite";

export default defineConfig({
  server: {
    open: "/game/index.html"
  },
  build: {
    rollupOptions: {
      input: "game/index.html"
    }
  }
});
