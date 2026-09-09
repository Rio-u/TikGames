import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // three.js + the post-processing stack is ~1.2MB of the bundle and never changes between
        // releases. Splitting it out means a deploy only invalidates the app chunk, and the
        // browser keeps the expensive half cached across updates.
        // Matched by module path rather than by entry name: `postprocessing` is a transitive
        // peer here, not a direct dependency, so naming it as an entry fails to resolve.
        manualChunks(id) {
          if (id.includes("/three/")) return "three";
          if (id.includes("postprocessing")) return "postprocessing";
          return undefined;
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
});
