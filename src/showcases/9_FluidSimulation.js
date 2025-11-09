import {startRenderLoop} from "../webgl/render.js";
import {
    createFramebufferWithTexture,
    createPingPongFramebuffersWithTexture, halfFloatOptions, resolutionScaled,
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
            fluid: {},
            post: {},
        };
        state.fluid = resolutionScaled(128, width, height);
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

        // analog zum scalarField oben -> Helper definiert :)
        state.framebuffer.post.sunrays = {
            options: halfFloatOptions(
                gl,
                resolutionScaled(196, width, height),
                gl.R16F,
                gl.LINEAR
            ),
            effect: undefined,
            afterblur: undefined,
        }
        state.framebuffer.post.sunrays.effect =
            createFramebufferWithTexture(gl,
                state.framebuffer.post.sunrays.options
            );
        state.framebuffer.post.sunrays.tempForBlur =
            createFramebufferWithTexture(gl,
                state.framebuffer.post.sunrays.options
            );

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
            min: -500,
            max: 500,
        }, {
            type: "floatInput",
            name: "iCurlStrength",
            defaultValue: 0,
            min: -0.5,
            max: 1.5,
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
            name: "iSunraysWeight",
            defaultValue: 1.,
            min: 0.,
            max: 20.,
        }, {
            type: "floatInput",
            name: "iSunraysIterations",
            defaultValue: 5,
            min: 1,
            max: 30,
            step: 1,
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
    PROCESS_VELOCITY_5: 15,
    PROCESS_VELOCITY_6: 16,
    PROCESS_VELOCITY_7: 17,
    PROCESS_FLUID_COLOR: 50,
    POST_PREPARE_SUNRAYS_MASK: 80,
    POST_APPLY_SUNRAYS: 81,
    POST_BLUR_SUNRAYS: 82,
    RENDER_TO_SCREEN: 99,
};

let write, readPrevious, readVelocity;
let lastSpawned = -10000;
const SPAWN_EVERY_SECONDS = 2.5;

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
    gl.uniform1f(state.location.iSunraysWeight, state.iSunraysWeight);
    gl.uniform1f(state.location.iSunraysIterations, state.iSunraysIterations);

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
    gl.uniform1i(state.location.texPostSunrays, 3);
    gl.uniform1i(state.location.texPostBloom, 4);
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

    // Note: need to unbind the curl texture itself when we want to write to its framebuffer.
    //       we _could_ clean this up right after the next step (or avoid a third texture unit altogether)
    //       but it _is_ convenient that we can just render the texture for debugging in the last pass.
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, null);

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
    gl.bindTexture(gl.TEXTURE_2D, readCurl.texture);
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

    // MISSING PASS: init pressure
    //               -> ein Write auf Pressure-Textur
    // MISSING PASS: divergence and pressure -> propagate pressure
    //               -> ein paar Iterationen auf Pressure-Textur
    // MISSING PASS: gradien subtract (vec3 vel -> vel - nabla pressure) for incompressible flow
    //               -> pressure und velocity schreiben auf velocity

    /////////////

    // Use Velocity as velocity AND as previous value to advect / dissipate Velocity
    gl.uniform1i(state.location.iPassIndex, PASS.PROCESS_VELOCITY_7);

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

    // Use Velocity as velocity and last image color as previous value to advect / dissipate Density
    // (Density, together with the somehow chosen start color, is what we actually see as colored cloud image)
    gl.uniform1i(state.location.iPassIndex, PASS.PROCESS_FLUID_COLOR);

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

    // the prepare step takes the previous image and writes to the next _image_

    gl.uniform1i(state.location.iPassIndex, PASS.POST_PREPARE_SUNRAYS_MASK);

    [write, readPrevious] = state.framebuffer.image.currentWriteAndRead();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.uniform2fv(state.location.texelSize, state.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // did we write to what we read? hell yes wie did (the image itself)
    state.framebuffer.image.doPingPong();

    /////////////

    // with that mask prepared (i.e. now the previous image),
    // the main step can now write on the sunrays framebuffer itself

    gl.uniform1i(state.location.iPassIndex, PASS.POST_APPLY_SUNRAYS);
    [, readPrevious] = state.framebuffer.image.currentWriteAndRead();
    write = state.framebuffer.post.sunrays.effect;
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.uniform2fv(state.location.texelSize, state.framebuffer.post.sunrays.options.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    /////////////

    // the blurring afterwards writes from sunrays.effect to sunrays.tempForBlur
    // because it does first x, then y, and needs something to stash inbetween.
    // (yeah, that _could_also_ be its own pass, but I couldn't say whether that would be advantageous.)
    const [texelWidth, texelHeight] = state.framebuffer.post.sunrays.options.texelSize;
    gl.uniform1i(state.location.iPassIndex, PASS.POST_BLUR_SUNRAYS);
    readPrevious = state.framebuffer.post.sunrays.effect;
    write = state.framebuffer.post.sunrays.tempForBlur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.uniform2f(state.location.texelSize, texelWidth, 0.);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // ... consider this very similar to the other framebuffer ping pongs ...
    [readPrevious, write] = [write, readPrevious];
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.uniform2f(state.location.texelSize, 0., texelHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // we could iterate this for more blur, but that's fine for now.

    /////////////

    gl.uniform1i(state.location.iPassIndex, PASS.RENDER_TO_SCREEN);
    [, readPrevious] = state.framebuffer.image.currentWriteAndRead();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.activeTexture(gl.TEXTURE3); // see above, we kept that
    gl.bindTexture(gl.TEXTURE_2D, state.framebuffer.post.sunrays.effect.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // need to cleanup this one, we got
    //   "GL_INVALID_OPERATION: glDrawArrays: Feedback loop formed between Framebuffer and active Texture."
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, null);
}
