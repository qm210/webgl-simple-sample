import glsl from "vite-plugin-glsl";

// note: this runs in the _build_ process, not in the app itself.

// modifies the behaviour of the existing GLSL Vite Plugin to our needs.
const existingPlugin = glsl({
    compress: false
});

const glslImport = () => ({
    ...existingPlugin,
    enforce: "pre",
    name: "vite-plugin-glsl-qm",
    transform: async (src, id) => {
        const original = await existingPlugin.transform(src, id);
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
    },
});

export default glslImport;