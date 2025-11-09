#version 300 es

in vec4 aPosition;

uniform vec2 texelSize;

out vec2 st;
out vec2 stL; // left
out vec2 stR; // right
out vec2 stU; // up
out vec2 stD; // down
out float aspRatio;

void main() {
    st = aPosition.xy * 0.5 + 0.5;
    stL = st - vec2(texelSize.x, 0.);
    stR = st + vec2(texelSize.x, 0.);
    stU = st + vec2(0., texelSize.y);
    stD = st - vec2(0., texelSize.y);
    aspRatio = texelSize.y / texelSize.x;
    gl_Position = vec4(aPosition.xy, 0., 1.);
}
