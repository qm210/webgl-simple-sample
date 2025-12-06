#version 300 es
precision highp float;

in vec2 aPosition;
in vec4 aGlyphRect;
// <-- normalized already as u0, v0, u1, v1

out vec2 vTexCoord;

void main() {
    gl_Position = vec4(aPosition.xy, 0., 1.);
    vTexCoord = mix(aGlyphRect.xy, aGlyphRect.zw, (aPosition + 1.) * 0.5);
}
