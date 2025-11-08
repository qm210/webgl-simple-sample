#version 300 es

in vec4 aPosition;

uniform vec2 texelSize;

out vec2 st;
out vec2 stL;
out vec2 stR;
out vec2 stT;
out vec2 stB;
out float aspRatio;

void main() {
    st = aPosition.xy * 0.5 + 0.5;
    stL = st - vec2(texelSize.x, 0.);
    stR = st + vec2(texelSize.x, 0.);
    stT = st + vec2(0., texelSize.y);
    stB = st - vec2(0., texelSize.y);
    aspRatio = texelSize.y / texelSize.x;
    gl_Position = vec4(aPosition.xy, 0., 1.);
}
