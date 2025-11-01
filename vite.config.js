import { defineConfig } from 'vite';
import glslImport from './plugin/glslImport.js';

export default defineConfig({
    plugins: [glslImport()],
    test: {
        globals: true,
        environment: "happy-dom"
    }
});
