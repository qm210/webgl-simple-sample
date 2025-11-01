import { defineConfig } from 'vite';
import glslImport from './plugin/glslImport.js';

export default defineConfig({
    plugins: process.env.VITEST
        ? []
        : [glslImport()],
    test: {
        globals: true,
        environment: "happy-dom"
    }
});
