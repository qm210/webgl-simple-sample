const REGEX = {
    DEFINE:
        /\b#define\s*(?<name>\w*)(?<args>\(.*\))?\s*(?<value>.*)\s*$/g,
    GLOBAL:
        /\b(?<keyword>out|uniform|varying)\s*(?<type>\w+)\s*(?<name>\w*);/g,
    CONSTANT:
        /\bconst\s*(?<type>float|u?int|bool|[iu]vec[2-4]|mat[2-4])\s*(?<name>\w*)\s*=\s*(?<value>\S*);/g,
    FUNCTION:
        /(?:^|\n)\s*(?<returnType>\w+)\s+(?<name>\w+)\s*\((?<args>[^()]*)\)(?:\s*\{\s*(?<body>[^}]*)(?<=\n)})?\s*;?\n?/mg,
    FUNCTION_SIGNATURE:
        /(?:^|\n)\s*(?<returnType>\w+)\s+(?<name>\w+)\s*\((?<args>[^()]*)\)\s*\{/,

    MAGIC_KEYWORD:
        /\b(gl_Position|gl_PointSize|gl_FragCoord|gl_FrontFacing|gl_PointCoord|main)\b/g,
    KEYWORD:
        /\b(uniform|varying|attribute|const|in|out|[iu]?vec[234]|mat[234]|void|float|u?int|bool|sampler[123]D|return|discard|continue|break|if|else|texture|texelFetch|precision|highp|mediump|lowp)\b/g,
    BUILTIN_FUNCTION:
        /\b(mix|min|max|clamp|smoothstep|step|length|dot|normalize|cross|reflect|refract|sinh?|cosh?|tanh?|atan|exp|log|sqrt|pow|mod|modf|fract|abs|sign|floor|ceil)\b/g,
    NUMBER:
        /\b(-?\d+\.?\d*(e-?\d+)?[Uf]?)/g,
    DIRECTIVE:
        /^\s*(#.*)/g,

    ERROR_LOG:
        /:\s*([0-9]*):([0-9]*):\s*(.*)/g,
    // <--this holds for WebGl2, as of March 2025 - e.g. error logs look like:
    // ERROR: 0:12: '=' : dimension mismatch
    // -> parse accordingly: /<ignore>: <number>:<number>: <rest>/
};

export default REGEX;
