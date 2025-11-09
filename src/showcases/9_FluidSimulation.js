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
        // also initialize the curl framebuffer texture (there is only one), while we're at it
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffer.fluid.curl.fbo);
        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // and reset these shenanigans (is needless for us here, but good style in general.)
        // TODO: MEASURE THAT IN MS DIFFERENCE (also, Indexed Draw)
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
            type: "floatInput",
            name: "iCurlStrength",
            defaultValue: 0,
            min: -100,
            max: 100,
        }, {
            type: "button",
            name: "doRenderVelocity",
            label: "Render Velocity instead of Image",
            onClick: (button) => {
                state.doRenderVelocity = (state.doRenderVelocity + 1) % 3;
                button.textContent =
                    state.doRenderVelocity === 1
                        ? "Rendering: Velocity Texture (.rg)"
                        : state.doRenderVelocity === 2
                        ? "Rendering: Curl Texture (.r)"
                        :"Rendering Image, click to debug other textures";
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
    PROCESS_VELOCITY_1: 11,
    PROCESS_VELOCITY_2: 12,
    PROCESS_VELOCITY_3: 13,
    PROCESS_VELOCITY_4: 14,
    PROCESS_IMAGE: 50,
    RENDER_TO_SCREEN: 99,
};

let write, readPrevious, readVelocity;
let lastSpawned = -10000;
const SPAWN_EVERY_SECONDS = 3.;

function render(gl, state) {
    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform1f(state.location.deltaTime, state.deltaTime);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform1i(state.location.iFrame, state.frameIndex);

    gl.uniform1f(state.location.iColorDissipation, state.iColorDissipation);
    gl.uniform1f(state.location.iVelocityDissipation, state.iVelocityDissipation);
    gl.uniform1f(state.location.iMaxInitialVelocity, state.iMaxInitialVelocity);
    gl.uniform1f(state.location.iCurlStrength, state.iCurlStrength);
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
    if (state.time - lastSpawned > SPAWN_EVERY_SECONDS) {
        state.spawnSeed = Math.floor(state.time / SPAWN_EVERY_SECONDS);
        lastSpawned = state.time;
    }
    gl.uniform1f(state.location.iSpawnSeed, state.spawnSeed);

    gl.uniform1i(state.location.doRenderVelocity, state.doRenderVelocity);

    // also, the assignment of the two input textures stay the same:
    // texPrevious @ texture unit gl.TEXTURE0
    //  -> when a shader pass uses texPrevious, gl.activeTexture(gl.TEXTURE0) must be used before binding the texture
    // texVelocity @ texture unit gl.TEXTURE1
    //  -> when a shader pass uses texVelocity, gl.activeTexture(gl.TEXTURE1) must be... blah blah.
    gl.uniform1i(state.location.texPrevious, 0);
    gl.uniform1i(state.location.texVelocity, 1);
    gl.uniform1i(state.location.texCurl, 2); // could also use 0 here because we will not conflict, but this is needless.
    // and depending on what we want to write, we need to bind that corresponding Framebuffer only
    // (so if these are part of a ping-pong-pair, swap them after drawing to make them usable for a later pass)

    /////////////

    gl.uniform1i(state.location.iPassIndex, PASS.INIT_VELOCITY);

    [write, readPrevious] = state.framebuffer.fluid.velocity.currentWriteAndRead();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.uniform2fv(state.location.texelSize, state.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.fluid.velocity.doPingPong();

    /////////////

    gl.uniform1i(state.location.iPassIndex, PASS.INIT_IMAGE);

    [write, readPrevious] = state.framebuffer.image.currentWriteAndRead();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.uniform2fv(state.location.texelSize, state.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.image.doPingPong();

    /////////////

    // Use Velocity to calculate a fresh Scalar: Curl

    gl.uniform1i(state.location.iPassIndex, PASS.PROCESS_VELOCITY_1);

    write = state.framebuffer.fluid.curl;
    [, readVelocity] = state.framebuffer.fluid.velocity.currentWriteAndRead();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readVelocity.texture);
    gl.uniform2fv(state.location.texelSize, state.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    /////////////

    // Use Curl and Velocity to calculate new Velocity

    gl.uniform1i(state.location.iPassIndex, PASS.PROCESS_VELOCITY_2);
    [write, readVelocity] = state.framebuffer.fluid.velocity.currentWriteAndRead();
    const readCurl = state.framebuffer.fluid.curl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readVelocity.texture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, readCurl.texture); // is the curl framebuffer here
    gl.uniform2fv(state.location.texelSize, state.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // ! ... we did use Velocity to write Velocity, so do the ping-pong:
    state.framebuffer.fluid.velocity.doPingPong();

    /////////////

    // Use Velocity to calculate a fresh Scalar: Divergence

    gl.uniform1i(state.location.iPassIndex, PASS.PROCESS_VELOCITY_3);

    write = state.framebuffer.fluid.divergence;
    [, readVelocity] = state.framebuffer.fluid.velocity.currentWriteAndRead();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.uniform2fv(state.location.texelSize, state.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // ! ... we did not write to anything we've read from, i.e. no swap here

    /////////////

    gl.uniform1i(state.location.iPassIndex, PASS.PROCESS_VELOCITY_4);

    [write, readPrevious] = state.framebuffer.fluid.velocity.currentWriteAndRead();
    readVelocity = readPrevious;
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readVelocity.texture);
    gl.uniform2fv(state.location.texelSize, state.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.fluid.velocity.doPingPong();

    /////////////
    gl.uniform1i(state.location.iPassIndex, PASS.PROCESS_IMAGE);

    [write, readPrevious] = state.framebuffer.image.currentWriteAndRead();
    [, readVelocity] = state.framebuffer.fluid.velocity.currentWriteAndRead();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readVelocity.texture);
    gl.uniform2fv(state.location.texelSize, state.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.image.doPingPong();

    /////////////
    gl.uniform1i(state.location.iPassIndex, PASS.RENDER_TO_SCREEN);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

}
