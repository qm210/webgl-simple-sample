import { defineConfig } from "vite";
import glslImport from "./plugin/vite-plugin-glsl";

export default defineConfig({
    plugins: [glslImport({
        minify: false,
        keepAllComments: true,
    })],
    assetsInclude: ['src/textures/**/*.png'],
    test: {
        globals: true,
        environment: "happy-dom"
    }
});
