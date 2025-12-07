#version 300 es
precision mediump float;

in vec4 aPosition;
uniform vec2 iResolution;
out vec2 st;
out vec2 uv;
out vec2 texelSize;
out float aspRatio;
out mat2 uv2st;

void main() {
    gl_Position = vec4(aPosition.xy, 0., 1.);
    aspRatio = iResolution.x / iResolution.y;
    // [-1, 1] -> x [-aspRatio, aspRatio]; y [-1, 1]
    uv = iResolution / iResolution.y * aPosition.xy;
    // [-1, 1] -> [0, 1] mit invertierter Vertikalen
    st = 0.5 * vec2(1. + aPosition.x, 1. - aPosition.y);
    // convenience: st = uv2st * uv + 0.5;
    uv2st = mat2(.5 / aspRatio, 0, 0., -.5);

    // für Operationen auf Texturen voll ok so:
    texelSize = 1. / iResolution.xy;
}
