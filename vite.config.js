import { defineConfig } from "vite";
import glslImport from "vite-plugin-glsl";

export default defineConfig({
    plugins: [glslImport({
        minify: false
    })],
    test: {
        globals: true,
        environment: "happy-dom"
    }
});
