#version 300 es
precision mediump float;
out vec4 fragColor;
in vec2 vTexCoord;

uniform sampler2D uMSDF;
uniform vec3 uTextColor;
uniform float uPxRange;


uniform vec2 iResolution;
uniform vec4 iMouseDrag;
uniform float iTime;
uniform int iFrame;

uniform float iFree0;
uniform float iFree1;
uniform float iFree2;
uniform float iFree3;
uniform float iFree4;
uniform float iFree5;

const vec4 c = vec4(1,0,-1,0.0001);

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

/*
void renderFont() {
    float screenPxRange = 1.0; // Adjust based on atlas pxRange
    vec2 screenPos = gl_FragCoord.xy / screenPxRange;
    vec2 dxdy = dFdx(screenPos) * 0.5 + dFdy(screenPos) * 0.5;
    float d = median(msdf.r, msdf.g, msdf.b) - 0.5;
    float screenPixDistance = length(dxdy) > 0.0 ? d / length(dxdy) : 0.0;
    float opacity = clamp(screenPixDistance + 0.5, 0.0, 1.0);
}
*/

void main() {
//    vec2 st = gl_FragCoord.xy / iResolution.xy;
//    st.y = 1. - st.y;

    vec3 msd = texture(uMSDF, vTexCoord).rgb;
    float sdf = median(msd.r, msd.g, msd.b) - 0.5;
    float alpha = clamp(sdf/fwidth(sdf) + 0.5, 0., 1.0);
    // float alpha = smoothstep(0.5 - 0.01, 0.5 + 0.01, sdf);
    // fragColor = vec4(uTextColor, alpha);
    fragColor = vec4(1, 0.2, alpha, 1.);
}
