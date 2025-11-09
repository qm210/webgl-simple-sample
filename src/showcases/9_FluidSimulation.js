import {startRenderLoop} from "../webgl/render.js";
import {
    createFramebufferWithTexture,
    createPingPongFramebuffersWithTexture,
    updateResolutionInState
} from "../webgl/helpers.js";

import vertexShaderSource from "../shaders/vertex.basicWithDifferentials.glsl"
import fragmentShaderSource from "../shaders/fluidPlayground.glsl";
import {initBasicState} from "./common.js";

export default {
    title: "Fluid Dynamics Playground",
    init: (gl, sources = {}) => {
        sources.vertex ??= vertexShaderSource;
        sources.fragment ??= fragmentShaderSource;
        const state = initBasicState(gl, sources);

        // TODO: check difference with IndexBuffer / drawElements() some day...

        if (!state.program) {
            return state;
        }

        // TODO: Resizing the canvas DOES NOT scale the framebuffers / textures yet!! MUST DO
        const {width, height} = updateResolutionInState(state, gl);
        state.frameIndex = 0;

        state.framebuffer = {
            image: createPingPongFramebuffersWithTexture(gl, {
                width,
                height,
                colorAttachment: gl.COLOR_ATTACHMENT0,
            }),
            fluid: {}
        };
        state.fluid = {
            width: Math.floor(128 * width / height),
            height: 128
        };
        state.fluid.texelSize = [1 / state.fluid.width, 1 / state.fluid.height];
        state.fluid.scalarField = {
            width: state.fluid.width,
            height: state.fluid.height,
            internalFormat: gl.R16F,
            dataFormat: gl.RED,
            dataType: gl.HALF_FLOAT,
            minFilter: gl.NEAREST,
            magFilter: gl.NEAREST,
        };
        state.fluid.vec2Field = {
            width: state.fluid.width,
            height: state.fluid.height,
            internalFormat: gl.RG16F,
            dataFormat: gl.RG,
            dataType: gl.HALF_FLOAT,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR,
        };
        state.framebuffer.fluid = {
            velocity: createPingPongFramebuffersWithTexture(gl, state.fluid.vec2Field),
            divergence: createFramebufferWithTexture(gl, state.fluid.scalarField),
            curl: createFramebufferWithTexture(gl, state.fluid.scalarField),
            pressure: createPingPongFramebuffersWithTexture(gl, state.fluid.scalarField),
        };
        state.doRenderVelocity = 0;
        // need some way of controlling when to spawn, because the input textures should then have that
        // external value _exactly_ one frame, that is quite hard to accomplish inside the shader.
        state.spawnSeed = 0.;

        gl.useProgram(state.program);

        // initialize the velocity framebuffer texture ([1] = pong = first read) to constant values
        // rg == vec2(0,0) should be default anyway, but why not make sure.
        const [, initialVelocity] = state.framebuffer.fluid.velocity.currentWriteAndRead();
        gl.bindFramebuffer(gl.FRAMEBUFFER, initialVelocity.fbo);
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return state;
    },
    generateControls: (gl, state, elements) => ({
        onRender: () => {
            startRenderLoop(
                state => render(gl, state),
                state,
                elements
            );
        },
        uniforms: [{
            type: "floatInput",
            name: "iColorDissipation",
            defaultValue: 0.3,
            min: 0.,
            max: 2.,
        }, {
            type: "floatInput",
            name: "iVelocityDissipation",
            defaultValue: 0.1,
            min: 0.,
            max: 2.,
        }, {
            type: "floatInput",
            name: "iMaxInitialVelocity",
            defaultValue: 1,
            min: 0,
            max: 100,
        }, {
            type: "button",
            name: "doRenderVelocity",
            label: "Render Velocity instead of Image",
            onClick: (button) => {
                state.doRenderVelocity = Number(!state.doRenderVelocity);
                button.textContent = `Render Velocity instead of Image = ${state.doRenderVelocity}`;
                console.log(state);
            }
        }, {
            type: "floatInput",
            name: "iNoiseLevel",
            defaultValue: 1,
            min: 0.,
            max: 2.,
        }, {
            type: "floatInput",
            name: "iNoiseFreq",
            defaultValue: 1,
            min: 0.01,
            max: 10.,
        }, {
            type: "floatInput",
            name: "iNoiseOffset",
            defaultValue: 0,
            min: -1,
            max: 1,
        }, {
            type: "floatInput",
            name: "iFractionSteps",
            defaultValue: 1,
            min: 1,
            max: 10.,
            step: 1,
        }, {
            type: "floatInput",
            name: "iFractionScale",
            defaultValue: 2.,
            min: 0.01,
            max: 10.,
        }, {
            type: "floatInput",
            name: "iFractionAmplitude",
            defaultValue: 0.5,
            min: 0.01,
            max: 2.,
        }, {
            type: "floatInput",
            name: "iCloudMorph",
            defaultValue: 0,
            min: 0,
            max: 2,
        }, {
            type: "floatInput",
            name: "iCloudVelX",
            defaultValue: 0,
            min: -2.,
            max: 2,
        }, {
            type: "vec3Input",
            name: "iFree0",
            defaultValue: [0, 0, 0],
            min: -9.99,
            max: +9.99,
        }, {
            type: "vec3Input",
            name: "iFree1",
            defaultValue: [0, 0, 0],
            min: -9.99,
            max: +9.99,
        }, {
            type: "vec3Input",
            name: "iFree2",
            defaultValue: [0, 0, 0],
            min: -9.99,
            max: +9.99,
        }]
    })
};

const PASS = {
    INIT_VELOCITY: 0,
    INIT_IMAGE: 1,
    PROCESS_VELOCITY: 2,
    PROCESS_IMAGE: 3,
    RENDER_TO_SCREEN: 4,
};

let lastSpawned = -10000;
let write, read;

function render(gl, state) {
    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform1f(state.location.deltaTime, state.deltaTime);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform1i(state.location.iFrame, state.frameIndex);
    gl.uniform1f(state.location.iColorDissipation, state.iColorDissipation);
    gl.uniform1f(state.location.iVelocityDissipation, state.iVelocityDissipation);
    gl.uniform1f(state.location.iMaxInitialVelocity, state.iMaxInitialVelocity);
    gl.uniform1i(state.location.doRenderVelocity, state.doRenderVelocity);

    gl.uniform1f(state.location.iNoiseLevel, state.iNoiseLevel);
    gl.uniform1f(state.location.iNoiseFreq, state.iNoiseFreq);
    gl.uniform1f(state.location.iNoiseOffset, state.iNoiseOffset);
    gl.uniform1i(state.location.iFractionSteps, Math.floor(state.iFractionSteps));
    gl.uniform1f(state.location.iFractionScale, state.iFractionScale);
    gl.uniform1f(state.location.iFractionAmplitude, state.iFractionAmplitude);
    gl.uniform1f(state.location.iCloudMorph, state.iCloudMorph);
    gl.uniform1f(state.location.iCloudVelX, state.iCloudVelX);
    gl.uniform3fv(state.location.iFree0, state.iFree0);
    gl.uniform3fv(state.location.iFree1, state.iFree1);
    gl.uniform3fv(state.location.iFree2, state.iFree2);

    // as we now only have write texture _at_the_same_time_, only need one color attachment
    // -> no gl.drawBuffers() required.

    state.spawnSeed = -1.;
    if (state.time - lastSpawned > 4.) {
        state.spawnSeed = Math.floor(state.time / 4.);
        lastSpawned = state.time;
    }
    gl.uniform1f(state.location.iSpawnSeed, state.spawnSeed);

    gl.uniform1i(state.location.doRenderVelocity, state.doRenderVelocity);

    // also, the assignment of the two input textures stay the same:
    gl.uniform1i(state.location.texPrevious, 0); // <-- texture unit gl.TEXTURE0
    gl.uniform1i(state.location.texVelocity, 1); // <-- texture unit gl.TEXTURE1

    /////////////
    gl.uniform1i(state.location.iPassIndex, PASS.INIT_VELOCITY);

    [write, read] = state.framebuffer.fluid.velocity.currentWriteAndRead();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.uniform2fv(state.location.texelSize, state.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.fluid.velocity.doPingPong();

    /////////////
    gl.uniform1i(state.location.iPassIndex, PASS.INIT_IMAGE);

    [write, read] = state.framebuffer.image.currentWriteAndRead();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.uniform2fv(state.location.texelSize, state.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.image.doPingPong();

    /////////////
    gl.uniform1i(state.location.iPassIndex, PASS.PROCESS_VELOCITY);

    [write, read] = state.framebuffer.fluid.velocity.currentWriteAndRead();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    let velocityRead = read;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, velocityRead.texture);
    gl.uniform2fv(state.location.texelSize, state.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.fluid.velocity.doPingPong();

    /////////////
    gl.uniform1i(state.location.iPassIndex, PASS.PROCESS_IMAGE);

    [write, read] = state.framebuffer.image.currentWriteAndRead();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    [, velocityRead] = state.framebuffer.fluid.velocity.currentWriteAndRead();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, velocityRead.texture);
    gl.uniform2fv(state.location.texelSize, state.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.image.doPingPong();

    /////////////
    gl.uniform1i(state.location.iPassIndex, PASS.RENDER_TO_SCREEN);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

}
