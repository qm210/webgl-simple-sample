import standardSetup from "./3_SimpleGeometry.js";
import {startRenderLoop} from "../webgl/render.js";
import {createFramebufferWithTexture, createTextureFromImage} from "../webgl/helpers.js";

import fragmentShaderSource from "../shaders/spring-2025/framebufferPingPong.glsl";
import someSampleImage from "../textures/mysterious_capybara.png";

export default {
    title: "Stochastic Ray Tracing",
    init: (gl) => {
        const state = standardSetup.init(gl, fragmentShaderSource);

        if (!state.program) {
            return state;
        }

        state.framebuffer = [0, 1].map(() =>
            createFramebufferWithTexture(gl, {
                width: gl.drawingBufferWidth,
                height: gl.drawingBufferHeight,
                colorAttachment: gl.COLOR_ATTACHMENT0,
                // Diese Formate werden später wichtig, können hier aber auf dem Default bleiben:
                // internalFormat: gl.RGBA,
                // dataFormat: gl.RGBA,
                // dataType: gl.UNSIGNED_BYTE,
            })
        );

        state.location.previousRender = gl.getUniformLocation(state.program, "iPreviousRender");
        state.location.passIndex = gl.getUniformLocation(state.program, "iPassIndex");
        state.location.iFrame = gl.getUniformLocation(state.program, "iFrame");
        state.frameIndex = 0;

        // Hinweis: useProgram muss nur in der Renderschleife stehen, wenn es mehrere Shaderprogram gibt
        //          Es ist aber effizienter, beim selben zu bleiben.
        //          -> mit uniform flags zwischen verschiedenem Verhalten umschalten
        //          -> bereits erwähnter Nachteil:
        //             kleine Änderungen in großen Shadern erfordern komplette Neukompilation
        //          Probiert gerne mal den Unterschied aus, vielleicht merkt mans hier auch kaum.
        gl.useProgram(state.program);

        // Ein Bild als Textur laden, um schnell ein Beispiel als Renderziel zu haben
        state.sampleTexture = createTextureFromImage(gl, someSampleImage, {
            wrapS: gl.REPEAT,
            wrapT: gl.CLAMP_TO_EDGE,
            minFilter: gl.LINEAR,
        });
        state.location.iSampleImage = gl.getUniformLocation(state.program, "iSampleImage");

        return state;
    },
    generateControls: (gl, state, elements) => [{
        type: "renderButton",
        title: "Render",
        onClick: () => {
            startRenderLoop(
                state => render(gl, state),
                state,
                elements
            );
        }
    }, {
        type: "label",
        name: "iTime",
    }
    ]
};

export function takePingPongFramebuffers(state) {
    // "Frame Buffer Ping Pong": wir beschreiben die Framebuffer immer abwechselnd:
    // "ping": write fbo 0, read texture 1
    // "pong": write fbo 1, read texture 0
    // etc.
    const pingIndex = state.frameIndex % 2;
    const pongIndex = 1 - pingIndex;
    return {
        write: state.framebuffer[pingIndex],
        read: state.framebuffer[pongIndex],
    }
}

function render(gl, state) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform1i(state.location.iFrame, state.frameIndex);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.sampleTexture);
    gl.uniform1i(state.location.iSampleImage, 1);

    const {write, read} = takePingPongFramebuffers(state);

    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.uniform1i(state.location.previousRender, 0);

    gl.uniform1i(state.location.passIndex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.uniform1i(state.location.passIndex, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    /*
     * Wem das mit dem Ping Pong nach zu viel Aufwand scheint...
     * hier ein bisschen Kontext, wohin andere Versuche führen könnten:
     */

    /**
     * Naivster Ansatz:
     *

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixelArray = new Uint8Array(width * height * 4);
    gl.readBuffer(gl.BACK);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    --> dann per texImage2D wieder einspielen.

    // Das geht, aber über Round Trip GPU -> CPU -> GPU
    // Datenaustausch zur CPU blockiert die Pipeline. So kommen wir nicht weit.
     * /

    /**
     * Weniger-aber-trotzdem-noch-zu-Naiver Ansatz:
     * "Framebuffer Blitting"
     *
     gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
     gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
     gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
     gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
     *
     * -> kopiert aber dennoch im Hintergrund das ganze Bild. Könnte man mal gegenchecken. Aber nicht heute.
     */

    /**
     *  Besser, aber leider nicht möglicher Ansatz:
     *

    // Schritt 1: Framebuffer binden, d.h. auf seine zugehörige Textur rendern
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Schritt 2: Framebuffer entbinden = auf Bildschirm rendern
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // braucht aber die Textur vom Framebuffer
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, framebuffer.texture);
    gl.uniform1i(state.location.previousRender, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

     // ist leider nicht so einfach:
     // -> [.WebGL-0x6c9400db7f00] GL_INVALID_OPERATION:
     //                            Feedback loop formed between Framebuffer and active Texture.

     */
}
