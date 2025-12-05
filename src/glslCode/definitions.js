const MAGIC_SYMBOLS = [
    "gl_Position",
    "gl_PointSize",
    "gl_FragCoord",
    "gl_FrontFacing",
    "gl_PointCoord",
    "main",
];

export const REGEX = {
    DEFINE_DIRECTIVE:
        /^[ \t]*#define\s*(?<name>\w*)(?<args>\(.*?\))?\s*(?<value>.*)\s*$/mg,
    SHADER_VARIABLE:
        /^\b(layout\s*\(location\s*=\s*(?<location>\d+)\)\s*)?(?<keyword>out|uniform|varying|attribute)\s*(?<type>\w+)\s*(?<name>\w*);/mg,
    CONSTANT:
        /\bconst\s*(?<type>float|u?int|bool|[iu]?vec[2-4]|mat[2-4])\s*(?<name>\w*)\s*=\s*(?<value>\S*);/g,
    FUNCTION:
        /\b(?<returnType>\w+)\s+(?<name>\w+)\s*\((?<args>[^()]*)\)(?:\s*\{\s*(?<body>[^}]*)(?<=\n)})?\s*;?\n?/mg,
    FUNCTION_SIGNATURE:
        /\b(?<returnType>\w+)\s+(?<name>\w+)\s*\((?<args>[^()]*)\)\s*\{/g,
    STRUCT:
        /\bstruct\s+(?<name>\w+)\s*\{(?<body>[^}]*)}/mg,
    MAGIC_SYMBOL:
        new RegExp(`\\b(${MAGIC_SYMBOLS.join('|')})\\b`, 'g'),
    KEYWORD:
        /\b(?<!#)(uniform|varying|attribute|layout|const|in|out|[iu]?vec[234]|mat[234]|void|float|u?int|bool|sampler[123]D|return|discard|continue|break|if|else|struct|fwidth|texture|textureSize|texelFetch|precision|highp|mediump|lowp)\b/g,
    BUILTIN_FUNCTION:
        /\b(mix|min|max|clamp|smoothstep|step|length|dot|normalize|cross|reflect|refract|sinh?|cosh?|tanh?|atan|exp|log|sqrt|pow|mod|modf|fract|abs|sign|floor|ceil|all|any|greaterThan|greaterThanEqual|lessThan|lessThanEqual)\b/g,
    NUMBER:
        /\b(-?\d+\.?\d*(e-?\d+)?[Uf]?)/g,
    DIRECTIVE:
        /^\s*#(?<keyword>\w+)\s*(?<expression>.*?)\s*$/mg,
    DIRECTIVE_KEYWORD:
        /(?=#)\s*\b(defined|optimize|debug)\b/g,
    BLOCK_DELIMITER:
        /(?<braceOpen>\{)|(?<braceClose>})|(?<commentOpen>\/\*)|(?<commentClose>\*\/)/g,
    LEADING_SPACES:
        /^ *(?=\S)/,
    VISIBLE_LINE_COMMENT:
        /\/\/\/.*$/mg,

    ERROR_LOG:
        /:\s*([0-9]*):([0-9]*):\s*(.*)/g,
    // <--this holds for WebGl2, as of March 2025 - e.g. error logs look like:
    // ERROR: 0:12: '=' : dimension mismatch
    // -> parse accordingly: /<ignore>: <number>:<number>: <rest>/
};

export const SymbolType = {
    DefineDirective: "DefineDirective",
    ShaderVariable: "ShaderVariable",
    Constant: "CustomConstant",
    CustomFunction: "CustomFunction",
    Struct: "CustomStruct",
};

export const SymbolRegex = {
    [SymbolType.DefineDirective]: REGEX.DEFINE_DIRECTIVE,
    [SymbolType.ShaderVariable]: REGEX.SHADER_VARIABLE,
    [SymbolType.Constant]: REGEX.CONSTANT,
    [SymbolType.CustomFunction]: REGEX.FUNCTION_SIGNATURE,
    [SymbolType.Struct]: REGEX.STRUCT,
};
