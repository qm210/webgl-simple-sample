#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;

// nice abbreviation for concise but uneasily readable code
vec4 c = vec4(1., 0., -1., 0.5);

void circle(in vec2 uv, inout vec3 col, inout float d) {
    vec2 pos = vec2(0.9, 0.3);
        // + 0.2 * vec2(sin(3. * iTime), cos(3. * iTime));

    col = c.yxy;
    d = clamp(3. * length(uv - pos) - 1., 0., 1.);
//    if (length(uv - pos) < 0.3) {
//        col = c.xxy;
//    }
//    if (max(uv.x - pos.x, uv.y - pos.y) < 0.5) { // (abs(uv.x - pos.x) < 0.3 && abs(uv.y - pos.y) < 0.3) {
//        col = c.yyx;
//    }
//    if (abs(uv.x - pos.x) * abs(uv.y - pos.y) < 0.005) {
//        col = c.yxx;
//    }
//    if (abs(uv.x - pos.x - 0.3) + abs(uv.y - pos.y - 0.3) < 0.5) {
//        col = c.xxx;
//    }
//    if (abs(length(uv - pos) - 0.55) < 0.05) {
//        col = c.ywx;
//    }
    return;
}
// d = clamp(6. * length(uv - pos) - 1., 0., 1.);
// d = 10. * abs(length(uv - pos) - 0.4);

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
    float d = 0.;
    col2 = c.yyx;
    circle(uv, col2, d);
    col = mix(col2, col, d);

    fragColor = vec4(col, 1.0);
}

//uv.x = fract(10. * uv.x) * 0.1; //uv.y = abs(0.5 - uv.y);

// col2 = c.yxy;
// float scale = 0.8 + 0.5 * sin(iTime);
// circle(scale * uv - vec2(0.6, 0.3), col2, d);
// d *= d;
// col = mix(col2, col, d);
