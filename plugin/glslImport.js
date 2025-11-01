import glsl from "vite-plugin-glsl";
import {createFilter} from "vite";

// note: this runs in the build / dev process, not in the app itself.

// modifies the behaviour of the existing CodeHighlighting Vite Plugin to our needs.
const existingPlugin = await glsl({
    compress: false
});

const glslImport = () => ({
    ...existingPlugin,
    enforce: "pre",
    name: "vite-plugin-glsl-qm",
    transform: {
        ...existingPlugin.transform,
        handler: async (src, id) => {
            const original = await existingPlugin.transform.handler(src, id);
            if (!original) {
                // this means this import was not a shader source
                return;
            }
            // reduce any consecutive number of empty lines to one line break
            const code = original.code
                .replace(/\\r\\n/g, "\\n")
                .replace(/\\n(\\n|\\r|\s)*?(?=\s*\w)/g, "\\n$1");
            return {
                ...original,
                code,
            };
        }
    }
});

export default glslImport;