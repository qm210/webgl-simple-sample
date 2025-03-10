import { defineConfig } from 'vite';
import glslImport from './plugin/glslImport.js';

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        glslImport()
    ],
})
