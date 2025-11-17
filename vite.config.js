import { defineConfig } from "vite";
import glslImport from "./plugin/vite-plugin-glsl";

export default defineConfig({
    plugins: [glslImport({
        minify: false,
        keepAllComments: true,
    })],
    test: {
        globals: true,
        environment: "happy-dom"
    }
});
