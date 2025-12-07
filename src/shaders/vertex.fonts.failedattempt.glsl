#version 300 es
precision highp float;

in vec2 aPosition;
in vec4 aGlyphRect;
// <-- normalized already as u0, v0, u1, v1

uniform vec2 uShiftTexCoord;
uniform vec2 uScaleTexCoord;

out vec2 vTexCoord;
out vec2 vDebug;

void main() {
    gl_Position = vec4(aPosition.xy, 0., 1.);
    vec2 st = aPosition;
    st = (st + 1.) * 0.5;
    // st.y = 1. - st.y;
    // st = (st + 1.) * 0.5;
    // st = st * uScaleTexCoord + uShiftTexCoord;
    vec4 glyphRect = aGlyphRect;
    glyphRect.xy = (glyphRect.xy + uShiftTexCoord) * uScaleTexCoord;
    glyphRect.zw = (glyphRect.zw + uShiftTexCoord) * uScaleTexCoord;
    vTexCoord = mix(glyphRect.xy, glyphRect.zw, st);
    vDebug = glyphRect.zw - glyphRect.xy;
    // vDebug = (vDebug + uShiftTexCoord) * uScaleTexCoord;
}
