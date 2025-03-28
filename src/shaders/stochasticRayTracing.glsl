#version 300 es
precision highp float;
layout(location = 0) out vec4 screenColor; // would traditionally be the "fragColor"
layout(location = 1) out vec4 framebufferColor;
uniform vec2 iResolution;
uniform float iTime;
uniform int iFrame;
uniform sampler2D iFramebufferTexture;

void main() {
    framebufferColor = vec4(
        fract(0.01 * float(iFrame)),
        0.5 + 0.5 * sin(iTime),
        0.,
        1.
    );
    screenColor = framebufferColor;
}
