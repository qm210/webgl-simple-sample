#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;

// nice abbreviation for concise but uneasily readable code
vec3 c = vec3(1., 0., -1.);

void circle(in vec2 uv, inout vec3 col, inout float d) {
    vec2 pos = vec2(0.5, 0.3) +
        0.2 * vec2(sin(3. * iTime), cos(3. * iTime));

    d = 10. * abs(length(uv - pos) - 0.9);
    // d = clamp(6. * length(uv - pos) - 1., 0., 1.);
}

/*
void basicIdea(in vec2 uv, inout vec3 col, inout float d) {
    col = c.yyx;
    d = 0.;
}
*/

void main() {
    vec2 uv = gl_FragCoord.xy/iResolution.y;
    vec3 col = vec3(0.2, 0.015, 0.1);
    vec3 col2;
    float d;

    col2 = c.yyx;
    circle(uv, col2, d);
    col = mix(col2, col, d);

    float scale = 1.;
    // float scale = 0.8 + 0.5 * sin(iTime);
    col2 = c.yxy;

    circle(scale * uv - vec2(0.6, 0.3), col2, d);
    // d *= d;
    col = mix(col2, col, d);

    fragColor = vec4(col, 1.0);
}
