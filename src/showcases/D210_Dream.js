import {createGlyphDef, createUbo, initBasicState, startRenderLoop} from "./common.js";
import {
    createTextureFromImage,
    createTextureFromLoadedImage,
    loadImagesByVite
} from "../webgl/helpers/textures.js";

import vertexShaderSource from "../shaders/specific/dream210.vertex.glsl";
import fragmentShaderSource from "../shaders/specific/dream210.fragment.glsl";
import spiceSaleMsdfPng from "../textures/dream210/SpicySale.msdf.png";
import spiceSaleMsdfJson from "../textures/dream210/SpicySale.msdf.json";
import {resolutionScaled, updateResolutionInState} from "../webgl/helpers/resolution.js";
import {
    clearFramebuffers, createFramebufferWithTexture, createFramebufferWithTextureArray,
    createPingPongFramebuffersWithTexture, halfFloatOptions
} from "../webgl/helpers/framebuffers.js";
import ditherImage from "../textures/dither.png";

// This secret move is presented to you by... vite :)
const monaImages =
    import.meta.glob('/src/textures/dream210/mona/*.png', {eager: true});


export default {
    title: "DREAM210 Merged",
    init: async (gl, sources = {}) => {
        sources.vertex ??= vertexShaderSource;
        sources.fragment ??= fragmentShaderSource;
        const state = initBasicState(gl, sources);

        if (!state.program) {
            return state;
        }

        state.monaTextures = await loadImagesByVite(
            monaImages,
            img => createTextureFromLoadedImage(gl, img)
        );
        console.log("Mona-Textures", state.monaTextures);

        state.passIndex = 0;

        const {width, height} = updateResolutionInState(state, gl);
        state.opt = {
            image: {
                width, height,
            },
            floatImage: {
                width, height,
                internalFormat: gl.RGBA32F,
                dataFormat: gl.RGBA,
                dataType: gl.FLOAT,
            },
            fluid: resolutionScaled(128, width, height),
            sunrays: halfFloatOptions(gl,
                resolutionScaled(196, width, height),
                gl.R16F,
                gl.LINEAR
            ),
            bloom: halfFloatOptions(gl,
                resolutionScaled(256, width, height),
                gl.RGBA16F,
                gl.LINEAR
            )
        };

        state.framebuffer = {
            clouds: createPingPongFramebuffersWithTexture(gl, state.opt.floatImage),
            noiseBase: createFramebufferWithTexture(gl, state.opt.image),
            texts: createFramebufferWithTextureArray(gl, 4, state.opt.image),
        };

        state.debugOption = +(sessionStorage.getItem("qm.dream210.debug") ?? 0);
        state.toggleDebugOption = (index) => {
            state.debugOption ^= 1 << index;
            sessionStorage.setItem("qm.drean210.debug", state.debugOption);
        }
        state.hasDebugOption = (index) =>
            (state.debugOption & (1 << index)) !== 0;
        state.accumulate = false;

        const {glyphDef, glyphDebug} = createGlyphDef(spiceSaleMsdfJson);
        const ubo = createUbo(gl, state.program, glyphDef, "Glyphs");
        state.msdf = {
            tex: createTextureFromImage(gl, spiceSaleMsdfPng, {
                wrapS: gl.CLAMP_TO_EDGE,
                wrapT: gl.CLAMP_TO_EDGE,
                minFilter: gl.LINEAR,
                maxFilter: gl.LINEAR,
                internalFormat: gl.RGBA8,
                dataFormat: gl.RGBA,
                dataType: gl.UNSIGNED_BYTE,
            }),
            json: spiceSaleMsdfJson,
            ubo,
            glyphDef,
            debug: glyphDebug,
        }

        state.opt.fluidScalar = {
            width: state.opt.fluid.width,
            height: state.opt.fluid.height,
            internalFormat: gl.R16F,
            dataFormat: gl.RED,
            dataType: gl.HALF_FLOAT,
            minFilter: gl.NEAREST,
            magFilter: gl.NEAREST,
        };
        state.opt.fluidVec2 = {
            width: state.opt.fluid.width,
            height: state.opt.fluid.height,
            internalFormat: gl.RG16F,
            dataFormat: gl.RG,
            dataType: gl.HALF_FLOAT,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR,
        };
        state.framebuffer.fluid = {
            color: createPingPongFramebuffersWithTexture(gl, state.opt.image),
            velocity: createPingPongFramebuffersWithTexture(gl, state.opt.fluidVec2),
            divergence: createFramebufferWithTexture(gl, state.opt.fluidScalar),
            curl: createFramebufferWithTexture(gl, state.opt.fluidScalar),
            pressure: createPingPongFramebuffersWithTexture(gl, state.opt.fluidScalar),
        };

        state.framebuffer.post = {};
        state.framebuffer.post.sunrays = {
            effect: createFramebufferWithTexture(gl, state.opt.sunrays),
            tempForBlur: createFramebufferWithTexture(gl, state.opt.sunrays),
        };
        state.framebuffer.post.bloom = {
            options: state.opt.bloom,
            effect: undefined,
            iterations: [],
            dither: createTextureFromImage(gl, ditherImage, {
                minFilter: gl.LINEAR,
                maxFilter: gl.LINEAR,
                wrapS: gl.REPEAT,
                wrapT: gl.REPEAT,
                internalFormat: gl.RGB,
                dataFormat: gl.RGB,
                dataType: gl.UNSIGNED_BYTE
            })
        };
        state.framebuffer.post.bloom.effect =
            createFramebufferWithTexture(gl, state.opt.bloom);
        const bloomIterations =
            Math.log2(state.opt.bloom.height);
        for (let i = 0; i < bloomIterations; i++) {
            const options = {
                ...state.opt.bloom,
                width: state.opt.bloom.width >> (i + 1),
                height: state.opt.bloom.height >> (i + 1),
            };
            if (options.width < 2 || options.height < 2) {
                break;
            }
            state.framebuffer.post.bloom.iterations.push(
                createFramebufferWithTexture(gl, options)
            );
        }

        gl.useProgram(state.program);

        // initialize the velocity framebuffer texture ([1] = pong = first read) to constant values
        // rg == vec2(0,0) should be default anyway, but why not make sure.
        const [, initialVelocity] = state.framebuffer.fluid.velocity.currentRoles();
        gl.bindFramebuffer(gl.FRAMEBUFFER, initialVelocity.fbo);
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // also initialize the curl framebuffer texture (there is only one), while we're at it
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffer.fluid.curl.fbo);
        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Relic from the Fluid -- random input -- is not what we want!
        state.spawn = {
            seed: 0.,
            last: Number.NEGATIVE_INFINITY,
            age: 0.,
        };

        return state;
    },
    generateControls: (gl, state, elements) => ({
        onRender: () => {
            startRenderLoop(
                state => render(gl, state, elements),
                state,
                elements
            );
        },
        toggles: [
            {
                label: () =>
                    "Using FBM " + (state.hasDebugOption(1) ? "B" : "A"),
                onClick: () =>
                    state.toggleDebugOption(1)
            }, {
                label: () =>
                    state.hasDebugOption(2) ? "Modded fbm" : "Original fbm",
                onClick: () => {
                    state.toggleDebugOption(2)
                }
            }, {
                label: () =>
                    "Accumulate: " + (state.accumulate ? "On" : "Off"),
                onClick: () => {
                    clearFramebuffers(gl, state.framebuffer.fb);
                    state.iFrame = 0;
                    state.toggleDebugOption(0);
                    state.accumulate = state.hasDebugOption(0);
                }
            }, {
                label: () => {
                    if (!state.lastQueryNanos) {
                        return "Query";
                    }
                    const millis = (1e-6 * state.lastQueryNanos).toFixed(2);
                    return `${millis} ms`;
                },
                onClick: async () => {
                    const nanos = await gl.timer.executeWithQuery(() =>
                        render(gl, state)
                    );
                    const comparison = !state.lastQueryNanos ? [] :
                        ["- Ratio to last query:", nanos / state.lastQueryNanos];
                    console.log("Query took", nanos, "ns", ...comparison);
                    state.lastQueryNanos = nanos;
                }
            }, {
                label: () => "Read",
                onClick: () => {
                    state.readNextPixels = true;
                },
                style: { flex: 0 }
            }
        ],
        uniforms: createUniforms(),
    })
};

const PASS = {
    INIT_VELOCITY: 0,
    INIT_COLOR_DENSITY: 1,
    INIT_PRESSURE: 2,
    INIT_CURL_FROM_VELOCITY: 3,
    PROCESS_VELOCITY_VORTICITY: 10,
    PROCESS_DIVERGENCE_FROM_VELOCITY: 11,
    PROCESS_PRESSURE: 12,
    PROCESS_GRADIENT_SUBTRACTION: 13,
    PROCESS_ADVECTION: 14,
    PROCESS_FLUID_COLOR: 19,
    POST_PREFILTER_BLOOM: 20,
    POST_BLOOM_BLUR: 21,
    POST_PREPARE_SUNRAYS_MASK: 30,
    POST_APPLY_SUNRAYS: 31,
    POST_BLUR_SUNRAYS: 32,
    RENDER_COLORS: 40,

    ACCUMULATE_CLOUDS: 60,
    RENDER_CLOUDS: 61,

    // PLACEHOLDERS
    INIT_TEXT0: 80,
    INIT_TEXT1: 81,
    INIT_TEXT2: 82,
    INIT_TEXT3: 83,

    RENDER_NOISE_BASE: 90,
    RENDER_FINALLY_TO_SCREEN: 100
};


// ist nur Auflistung, sollte man beim portieren vllt richtig machen.
// btw -> scheiß-nummerierung -> aber egal -> frag nicht
const TEXTURE_UNITS = {
    // die fürs Fluid KÖNNTE man komprimieren, aber schaumermal
    COLOR_DENSITY: 0, // <-- ist das sichtbare Bild
    VELOCITY: 1,
    CURL: 2, // wird nie zeitgleich 0 verwendet
    POST_SUNRAYS: 3,
    POST_BLOOM: 4,
    PRESSURE: 5,  // wird nie zeitgleich COLOR_DENSITY verwendet
    DIVERGENCE: 6,  // wird nie zeitgleich COLOR_DENSITY verwendet
    POST_BLOOM_DITHER: 7,
    // glyphs
    OHLI_FONT: 8,
    // cloud render result
    PREVIOUS_CLOUD: 9,
    // ... and some mona-graphics please?
}

// sind halt einfach Platzhalter.
// zwar global, aber werden halt einfach nicht scheiße behandelt. yespls?
// -> else hausverbot
let write, read, readPrevious, readVelocity;

function render(gl, state) {
    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform1f(state.location.deltaTime, state.play.dt);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform1i(state.location.iFrame, state.iFrame);

    gl.uniform1f(state.location.iVignetteInner, state.iVignetteInner);
    gl.uniform1f(state.location.iVignetteOuter, state.iVignetteOuter);
    gl.uniform1f(state.location.iVignetteScale, state.iVignetteScale);
    gl.uniform1f(state.location.iGamma, state.iGamma);

    gl.uniform1f(state.location.iFree0, state.iFree0);
    gl.uniform1f(state.location.iFree1, state.iFree1);
    gl.uniform1f(state.location.iFree2, state.iFree2);
    gl.uniform1f(state.location.iFree3, state.iFree3);
    gl.uniform1f(state.location.iFree4, state.iFree4);
    gl.uniform1f(state.location.iFree5, state.iFree5);

    // SOURCE: NOISE BASE -

    gl.uniform1f(state.location.iGridOpacity, state.iGridOpacity);
    gl.uniform2fv(state.location.iOverallNoiseShift, state.iOverallNoiseShift);
    gl.uniform1f(state.location.iOverallScale, state.iOverallScale);
    gl.uniform1f(state.location.iOverallHashOffset, state.iOverallHashOffset);
    gl.uniform1f(state.location.iNoiseLevelA, state.iNoiseLevelA);
    gl.uniform1f(state.location.iNoiseLevelB, state.iNoiseLevelB);
    gl.uniform1f(state.location.iNoiseLevelC, state.iNoiseLevelC);
    gl.uniform1f(state.location.iNoiseScaleA, state.iNoiseScaleA);
    gl.uniform1f(state.location.iNoiseScaleB, state.iNoiseScaleB);
    gl.uniform1f(state.location.iNoiseScaleC, state.iNoiseScaleC);
    gl.uniform1f(state.location.iNoiseMorphingA, state.iNoiseMorphingA);
    gl.uniform1f(state.location.iNoiseMorphingB, state.iNoiseMorphingB);
    gl.uniform1f(state.location.iNoiseMorphingC, state.iNoiseMorphingC);
    gl.uniform1i(state.location.iFractionalOctaves, state.iFractionalOctaves);
    gl.uniform1f(state.location.iFractionalScale, state.iFractionalScale);
    gl.uniform1f(state.location.iFractionalDecay, state.iFractionalDecay);
    gl.uniform1f(state.location.iTurbulenceNormFactor, state.iTurbulenceNormFactor);
    gl.uniform1f(state.location.iTurbulenceMeanOffset, state.iTurbulenceMeanOffset);
    gl.uniform2fv(state.location.iMarbleSqueeze, state.iMarbleSqueeze);
    gl.uniform1f(state.location.iMarbleGranularity, state.iMarbleGranularity);
    gl.uniform1f(state.location.iMarbleGradingExponent, state.iMarbleGradingExponent);
    gl.uniform1f(state.location.iMarbleRange, state.iMarbleRange);
    gl.uniform1f(state.location.iColorStrength, state.iColorStrength);
    gl.uniform3fv(state.location.iColorCosineFreq, state.iColorCosineFreq);
    gl.uniform3fv(state.location.iColorCosinePhase, state.iColorCosinePhase);

    // SOURCE: FONTS -- TEXTURE8 für MSDF-Png

    gl.uniform3fv(state.location.iTextColor, state.iTextColor);

    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, state.msdf.tex);
    gl.uniform1i(state.location.glyphTex, 8);
    gl.uniform4fv(state.location.glyphDefM, state.msdf.glyphDef.slice(4 * 44, 4*45));

    // SOURCE: CLOUDS -- TEXTURE9 für Feedback / Akkumulation

    gl.uniform1f(state.location.iCloudYDisplacement, state.iCloudYDisplacement);
    gl.uniform1f(state.location.iCloudLayerDistance, state.iCloudLayerDistance);
    gl.uniform1f(state.location.iLightLayerDistance, state.iLightLayerDistance);
    gl.uniform1f(state.location.iCloudSeed, state.iCloudSeed);
    gl.uniform1f(state.location.iSkyQuetschung, state.iSkyQuetschung);
    gl.uniform1i(state.location.iSampleCount, state.iSampleCount);
    gl.uniform1i(state.location.iCloudLayerCount, state.iCloudLayerCount);
    gl.uniform1i(state.location.iLightLayerCount, state.iLightLayerCount);
    gl.uniform1i(state.location.iCloudNoiseCount, state.iCloudNoiseCount);
    gl.uniform1i(state.location.iLightNoiseCount, state.iLightNoiseCount);
    gl.uniform3fv(state.location.iNoiseScale, state.iNoiseScale);
    gl.uniform1f(state.location.iCloudAbsorptionCoeff, state.iCloudAbsorptionCoeff);
    gl.uniform1f(state.location.iCloudAnisoScattering, state.iCloudAnisoScattering);
    gl.uniform3fv(state.location.vecSunPosition, state.vecSunPosition);
    gl.uniform3fv(state.location.vecSunColorYCH, state.vecSunColorYCH);
    gl.uniform1f(state.location.iSunExponent, state.iSunExponent);
    gl.uniform3fv(state.location.vecTone1, state.vecTone1);
    gl.uniform3fv(state.location.vecTone2, state.vecTone2);
    gl.uniform1f(state.location.iAccumulateMix, state.iAccumulateMix);

    gl.uniform1f(state.location.iNoiseLevel, state.iNoiseLevel);
    gl.uniform1f(state.location.iNoiseFreq, state.iNoiseFreq);
    gl.uniform1f(state.location.iNoiseOffset, state.iNoiseOffset);
    gl.uniform1i(state.location.iFractionalOctaves, Math.floor(state.iFractionalOctaves));
    gl.uniform1f(state.location.iFractionalScale, state.iFractionalScale);
    gl.uniform1f(state.location.iFractionalDecay, state.iFractionalDecay);
    gl.uniform1f(state.location.iCloudMorph, state.iCloudMorph);

    gl.uniform1i(state.location.debugOption, state.debugOption);

    gl.activeTexture(gl.TEXTURE9);
    gl.uniform1i(state.location.prevImage, 9);

    ///// INIT_TEXTi...

    gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffer.texts.fbo);
    gl.uniform1i(state.location.texTexts, 15);
    gl.activeTexture(gl.TEXTURE15);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);

    for (let layer = 0; layer < 2; layer++) {
        gl.uniform1i(state.location.passIndex, PASS.INIT_TEXT0 + layer);
        gl.framebufferTextureLayer(
            gl.FRAMEBUFFER,
            state.framebuffer.texts.opt.attachment,
            state.framebuffer.texts.texArray,
            0,
            layer
        );
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, state.framebuffer.texts.texArray);

    /////

    gl.uniform1i(state.location.passIndex, PASS.RENDER_NOISE_BASE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffer.noiseBase.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    /////

    [write, read] = state.framebuffer.clouds.currentRoles();
    gl.uniform1i(state.location.passIndex, PASS.RENDER_CLOUDS);
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.clouds.doPingPong();

    gl.uniform1i(state.location.passIndex, PASS.ACCUMULATE_CLOUDS);
    [, read] = state.framebuffer.clouds.currentRoles();

    // ganz offenbar sind wir noch nicht fertig.
    /*
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
     */

    // SOURCE: FLUID-ESCALATION

    gl.uniform3fv(state.location.iSpawnColorHSV, state.iSpawnColorHSV);
    gl.uniform1f(state.location.iSpawnHueGradient, state.iSpawnHueGradient);
    gl.uniform1f(state.location.iSpawnRandomizeHue, state.iSpawnRandomizeHue);
    gl.uniform1f(state.location.iColorDissipation, state.iColorDissipation);
    gl.uniform1f(state.location.iVelocityDissipation, state.iVelocityDissipation);
    gl.uniform1f(state.location.iMaxInitialVelocity, state.iMaxInitialVelocity);
    gl.uniform1f(state.location.iCurlStrength, state.iCurlStrength);
    gl.uniform1f(state.location.iPressure, state.iPressure);
    gl.uniform1f(state.location.iSunraysWeight, state.iSunraysWeight);
    gl.uniform1f(state.location.iSunraysDensity, state.iSunraysDensity);
    gl.uniform1f(state.location.iSunraysDecay, state.iSunraysDecay);
    gl.uniform1f(state.location.iSunraysExposure, state.iSunraysExposure);
    gl.uniform1f(state.location.iSunraysIterations, state.iSunraysIterations);

    // das ist massiv. erstmal auslagern
    renderFluidPasses(gl, state);

    // !! Finale Komposition auf Back Buffer !!

    gl.uniform1i(state.location.passIndex, PASS.RENDER_FINALLY_TO_SCREEN);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    let unit = 9;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, state.framebuffer.noiseBase.texture);
    gl.uniform1i(state.location.texNoiseBase, unit++);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, state.monaTextures["210_schnoerkel"]);
    gl.uniform1i(state.location.texMonaSchnoergel, unit++);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, state.monaTextures["regenbogen"]);
    gl.uniform1i(state.location.texMonaRainbow, unit++);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, state.monaTextures["dream210_visual_quadratisch_transparent"]);
    gl.uniform1i(state.location.texMonaCity, unit++);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, state.monaTextures["schnoerkelsterne"]);
    gl.uniform1i(state.location.texMonaStars, unit++);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    for (; unit >= 9; unit--) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
}

const SPAWN_EVERY_SECONDS = 2;

function renderFluidPasses(gl, state) {

    // TODO: NICHT ZUFÄLLIG SPAWNEN!! -->
    state.spawn.seed = -1.;
    if (state.time - state.spawn.last > SPAWN_EVERY_SECONDS) {
        state.spawn.seed = Math.floor(state.time / SPAWN_EVERY_SECONDS);
        state.spawn.last = state.time;
    }
    state.spawn.age = Math.max(state.time - state.spawn.last, 0.);
    gl.uniform1f(state.location.iSpawnSeed, state.spawn.seed);
    gl.uniform1f(state.location.iSpawnAge, state.spawn.age);
    // <-- TODO: NICHT ZUFÄLLIG SPAWNEN! RELIKT.

    // NOTE: man KÖNNTE die komprimieren, aber vllt muss man gar nicht
    gl.uniform1i(state.location.texColor, 0);
    gl.uniform1i(state.location.texVelocity, 1);
    gl.uniform1i(state.location.texCurl, 2); // could also use 0 here because we will not conflict, but this is needless.
    gl.uniform1i(state.location.texPressure, 5); // could also use 0 here because we will not conflict, but this is needless.
    gl.uniform1i(state.location.texDivergence, 6); // could also use 0 here because we will not conflict, but this is needless.
    gl.uniform1i(state.location.texPostSunrays, 3);
    gl.uniform1i(state.location.texPostBloom, 4);
    gl.uniform1i(state.location.texPostBloomDither, 7);

    /////////////

    gl.uniform1i(state.location.passIndex, PASS.INIT_VELOCITY);

    [write, readPrevious] = state.framebuffer.fluid.velocity.currentRoles();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);

    gl.viewport(0, 0, write.width, write.height);
    gl.uniform2fv(state.location.texelSize, state.opt.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.fluid.velocity.doPingPong();

    /////////////

    gl.uniform1i(state.location.passIndex, PASS.INIT_COLOR_DENSITY);

    [write, readPrevious] = state.framebuffer.fluid.color.currentRoles();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);

    gl.viewport(0, 0, write.width, write.height);
    gl.uniform2fv(state.location.texelSize, state.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.fluid.color.doPingPong();

    /////////////

    // Use Velocity to calculate a fresh Scalar: Curl

    gl.uniform1i(state.location.passIndex, PASS.INIT_CURL_FROM_VELOCITY);

        // Note: need to unbind the curl texture itself when we want to write to its framebuffer.
        //       we _could_ clean this up right after the next step (or avoid a third texture unit altogether)
        //       but it _is_ convenient that we can just render the texture for debugging in the last pass.

    write = state.framebuffer.fluid.curl;
    [, readVelocity] = state.framebuffer.fluid.velocity.currentRoles();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readVelocity.texture);

    gl.viewport(0, 0, write.width, write.height);
    gl.uniform2fv(state.location.texelSize, state.opt.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    /////////////

    // Use Curl and Velocity to calculate new Velocity
    gl.uniform1i(state.location.passIndex, PASS.PROCESS_VELOCITY_VORTICITY);

    [write, readVelocity] = state.framebuffer.fluid.velocity.currentRoles();
    const readCurl = state.framebuffer.fluid.curl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readVelocity.texture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, readCurl.texture);
    gl.uniform2fv(state.location.texelSize, state.opt.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // ! ... we did use Velocity to write Velocity, so do the ping-pong:
    state.framebuffer.fluid.velocity.doPingPong();

    /////////////

    // Use Velocity to calculate a fresh Scalar: Divergence
    gl.uniform1i(state.location.passIndex, PASS.PROCESS_DIVERGENCE_FROM_VELOCITY);

    write = state.framebuffer.fluid.divergence;
    [, readVelocity] = state.framebuffer.fluid.velocity.currentRoles();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readVelocity.texture);
    gl.uniform2fv(state.location.texelSize, state.opt.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // ! ... we did not write to anything we've read from, i.e. no swap here

    /////////////

    gl.uniform1i(state.location.passIndex, PASS.INIT_PRESSURE);

    [write, readPrevious] = state.framebuffer.fluid.pressure.currentRoles();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.uniform2fv(state.location.texelSize, state.opt.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.fluid.pressure.doPingPong();

    /////////////

    // Use Divergence and Pressure to Iterate a while on Pressure
    gl.uniform1i(state.location.passIndex, PASS.PROCESS_PRESSURE);

    gl.uniform2fv(state.location.texelSize, state.opt.fluid.texelSize);
    for (let p = 0; p < state.pressureIterations; p++) {
        [write, readPrevious] = state.framebuffer.fluid.pressure.currentRoles();
        gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
        gl.viewport(0, 0, write.width, write.height);
        gl.activeTexture(gl.TEXTURE5);
        gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
        gl.activeTexture(gl.TEXTURE6);
        gl.bindTexture(gl.TEXTURE_2D, state.framebuffer.fluid.divergence.texture);
        gl.uniform2fv(state.location.texelSize, state.opt.fluid.texelSize);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        state.framebuffer.fluid.pressure.doPingPong();
    }
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, null);

    /////////////

    // Use Pressure and Velocity to Subtract Gradients on Velocity - it seems.
    gl.uniform1i(state.location.passIndex, PASS.PROCESS_GRADIENT_SUBTRACTION);

    const [, readPressure] = state.framebuffer.fluid.pressure.currentRoles();
    [write, readVelocity] = state.framebuffer.fluid.velocity.currentRoles();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, readPressure.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readVelocity.texture);
    gl.uniform2fv(state.location.texelSize, state.opt.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.fluid.velocity.doPingPong();

    /////////////

    // Use Velocity as velocity AND as previous value to advect / dissipate Velocity
    gl.uniform1i(state.location.passIndex, PASS.PROCESS_ADVECTION);

    [write, readPrevious] = state.framebuffer.fluid.velocity.currentRoles();
    readVelocity = readPrevious;
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readVelocity.texture);
    gl.uniform2fv(state.location.texelSize, state.opt.fluid.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.fluid.velocity.doPingPong();

    /////////////

    // Use Velocity as velocity and last image color as previous value to advect / dissipate Density
    // (Density, together with the somehow chosen start color, is what we actually see as colored cloud image)
    gl.uniform1i(state.location.passIndex, PASS.PROCESS_FLUID_COLOR);

    [write, readPrevious] = state.framebuffer.fluid.color.currentRoles();
    [, readVelocity] = state.framebuffer.fluid.velocity.currentRoles();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readVelocity.texture);
    gl.uniform2fv(state.location.texelSize, state.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.framebuffer.fluid.color.doPingPong();

    /// END OF FLUID DYNAMICS ///////////////////

    /// POST: BLOOM /////////////////////////////

    gl.uniform1i(state.location.passIndex, PASS.POST_PREFILTER_BLOOM);
    gl.disable(gl.BLEND);

    [, readPrevious] = state.framebuffer.fluid.color.currentRoles();
    write = state.framebuffer.post.bloom.effect;
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.uniform1f(state.location.iBloomSoftKnee, state.iBloomSoftKnee);
    gl.uniform1f(state.location.iBloomThreshold, state.iBloomThreshold);
    gl.uniform2fv(state.location.texelSize, write.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    let lastWrite = write;

    gl.uniform1i(state.location.passIndex, PASS.POST_BLOOM_BLUR);

    for (const iteration of state.framebuffer.post.bloom.iterations) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, iteration.fbo);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, lastWrite.texture);
        gl.uniform2fv(state.location.texelSize, lastWrite.texelSize);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        lastWrite = iteration;
    }

    gl.blendFunc(gl.ONE, gl.ONE);
    gl.enable(gl.BLEND);

    for (let i = state.framebuffer.post.bloom.iterations.length - 2; i >= 0; i--) {
        const base = state.framebuffer.post.bloom.iterations[i];
        gl.bindFramebuffer(gl.FRAMEBUFFER, base.fbo);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, lastWrite.texture);
        gl.uniform2fv(state.location.texelSize, lastWrite.texelSize);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        lastWrite = base;
    }

    gl.disable(gl.BLEND);

    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, lastWrite.texture);
    gl.uniform1f(state.location.iBloomIntensity, state.iBloomIntensity);
    gl.uniform2fv(state.location.texelSize, lastWrite.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    /// POST: SUNRAYS ///////////////////////////

    // the prepare step takes the previous image and writes to the next _image_

    gl.uniform1i(state.location.passIndex, PASS.POST_PREPARE_SUNRAYS_MASK);

    [write, readPrevious] = state.framebuffer.fluid.color.currentRoles();
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.uniform2fv(state.location.texelSize, state.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // did we write to what we read? hell yes wie did (the image itself)
    state.framebuffer.fluid.color.doPingPong();

    /////////////

    // with that mask prepared (i.e. now the previous image),
    // the main step can now write on the sunrays framebuffer itself

    gl.uniform1i(state.location.passIndex, PASS.POST_APPLY_SUNRAYS);
    [, readPrevious] = state.framebuffer.fluid.color.currentRoles();
    write = state.framebuffer.post.sunrays.effect;
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    gl.uniform2fv(state.location.texelSize, state.opt.sunrays.texelSize);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    /////////////

    // the blurring afterwards writes from sunrays.effect to sunrays.tempForBlur
    // because it does first x, then y, and needs something to stash inbetween.
    // (yeah, that _could_also_ be its own pass, but I couldn't say whether that would be advantageous.)
    const [texelWidth, texelHeight] = state.opt.sunrays.texelSize;
    gl.uniform1i(state.location.passIndex, PASS.POST_BLUR_SUNRAYS);
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

    // RENDER COLORS

    gl.uniform1i(state.location.passIndex, PASS.RENDER_COLORS);

    [, readPrevious] = state.framebuffer.fluid.color.currentRoles();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readPrevious.texture);
    // <-- gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
    // --> bloom
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, state.framebuffer.post.bloom.effect.texture);
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, state.framebuffer.post.bloom.dither.texture);
    const scale = [
        gl.drawingBufferWidth / state.framebuffer.post.bloom.dither.width,
        gl.drawingBufferHeight / state.framebuffer.post.bloom.dither.height,
    ];
    gl.uniform2fv(state.location.iBloomDitherScale, scale);
    // --> sunrays
    gl.activeTexture(gl.TEXTURE3); // see above, we kept that
    gl.bindTexture(gl.TEXTURE_2D, state.framebuffer.post.sunrays.effect.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // need to cleanup this one, we got
    //   "GL_INVALID_OPERATION: glDrawArrays: Feedback loop formed between Framebuffer and active Texture."
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, null);

}

function createUniforms() {
    return [
        // type: "button",
        // name: "executeQueries",
        // label: "Query Rendering",
        // onClick: () => {
        //     state.query.doExecute = true;
        // }
        // }, {
        {
            separator: "Fragment Shader Uniforms"
        }, {
            type: "vec3",
            name: "iTextColor",
            defaultValue: [1, 0.3, 0.5],
            min: 0,
            max: 1
        }, {
            ////////////////////////////////////////
            separator: "NR4s Wolkenquest",
            ////////////////////////////////////////
        }, {
            type: "float",
            name: "iCloudYDisplacement",
            defaultValue: -12.43,
            min: -50,
            max: 10,
        }, {
            type: "float",
            name: "iCloudLayerDistance",
            defaultValue: 4.46,
            min: 0.01,
            max: 10,
        }, {
            type: "float",
            name: "iLightLayerDistance",
            defaultValue: 3.00,
            min: 0.01,
            max: 10,
        }, {
            type: "float",
            name: "iCloudSeed",
            defaultValue: 11.07,
            min: 0,
            max: 100,
        }, {
            type: "float",
            name: "iSkyQuetschung",
            defaultValue: 0.72,
            min: 0,
            max: 10,
        }, {
            type: "float",
            name: "iSampleCount",
            defaultValue: 1,
            min: 1,
            max: 20,
            step: 1,
        }, {
            type: "int",
            name: "iCloudLayerCount",
            defaultValue: 60,
            min: 1,
            max: 200,
        }, {
            type: "int",
            name: "iLightLayerCount",
            defaultValue: 6,
            min: 1,
            max: 100,
        }, {
            type: "int",
            name: "iCloudNoiseCount",
            defaultValue: 6,
            min: 1,
            max: 10,
        }, {
            type: "int",
            name: "iLightNoiseCount",
            defaultValue: 3,
            min: 1,
            max: 10,
        }, {
            type: "vec3",
            name: "iNoiseScale",
            defaultValue: [1, 1, 1],
            min: 0.01,
            max: 3,
            step: 0.01,
        }, {
            type: "float",
            name: "iCloudAbsorptionCoeff",
            defaultValue: 0.9,
            min: 0.001,
            max: 3,
        }, {
            type: "float",
            name: "iCloudAnisoScattering",
            defaultValue: 0.3,
            min: 0,
            max: 2,
        }, {
            type: "vec3",
            name: "vecSunPosition",
            defaultValue: [1, 0, 0],
            min: -1,
            max: 1,
            normalize: true,
        }, {
            type: "vec3",
            name: "vecSunColorYCH",
            defaultValue: [0.6267, 0.5051, 0.1466], // YIQ [0.6267, 0.3622, 0.0535], RGB [1, 0.5, 0.3]
            min: [0, 0.00, -3.142],
            max: [1, 0.78, +3.142],
        }, {
            type: "float",
            name: "iSunExponent",
            defaultValue: 10,
            min: 0.01,
            max: 100,
        }, {
            type: "vec3",
            name: "vecTone1",
            defaultValue: [2.51, 0.03, 2.43],
            min: 0,
            max: 5,
        }, {
            type: "vec3",
            name: "vecTone2",
            defaultValue: [0.59, 0.14, 1.],
            min: 0,
            max: 5,
        }, {
            type: "float",
            name: "iAccumulateMix",
            defaultValue: 1.,
            min: 0.,
            max: 1,
        }, {
            /////////////////////////////////////
            separator: "Spawn Colors & Velocity"
            /////////////////////////////////////
        }, {
            type: "vec3",
            name: "iSpawnColorHSV",
            defaultValue: [240, 1, 1],
            min: [0, 0, 0],
            max: [360, 1, 1],
        }, {
            type: "float",
            name: "iSpawnHueGradient",
            defaultValue: 100,
            min: -999,
            max: 999,
            step: 1
        }, {
            type: "float",
            name: "iSpawnRandomizeHue",
            defaultValue: 0.2,
            min: 0.,
            max: 1,
        }, {
            type: "float",
            name: "iMaxInitialVelocity",
            defaultValue: 100,
            min: -500,
            max: 500,
        }, {
            separator: "Fluid Dynamics"
        }, {
            type: "float",
            name: "iColorDissipation",
            defaultValue: 0.3,
            min: 0.,
            max: 2.,
        }, {
            type: "float",
            name: "iVelocityDissipation",
            defaultValue: 0.2,
            min: 0.,
            max: 2.,
        }, {
            type: "float",
            name: "iCurlStrength",
            defaultValue: 0,
            min: -100,
            max: 100,
        }, {
            type: "float",
            name: "iPressure",
            defaultValue: 0.8,
            min: -10,
            max: 50,
        }, {
            type: "int",
            name: "pressureIterations",
            defaultValue: 20,
            min: 0,
            max: 100,
            notAnUniform: true,
        }, {
            separator: "Bloom-Effekt"
        }, {
            type: "float",
            name: "iBloomIntensity",
            defaultValue: 0,
            min: 0,
            max: 10,
        }, {
            type: "float",
            name: "iBloomThreshold",
            defaultValue: 0.6,
            min: 0,
            max: 1,
        }, {
            type: "float",
            name: "iBloomSoftKnee",
            defaultValue: 0.7,
            min: 0,
            max: 1,
        }, {
            separator: "Sunrays-Effekt"
        }, {
            type: "float",
            name: "iSunraysWeight",
            defaultValue: 1.,
            min: 0,
            max: 20,
        }, {
            type: "float",
            name: "iSunraysDensity",
            defaultValue: 0.3,
            min: 0,
            max: 10,
        }, {
            type: "float",
            name: "iSunraysDecay",
            defaultValue: 0.95,
            min: 0,
            max: 1,
        }, {
            type: "float",
            name: "iSunraysExposure",
            defaultValue: 0.5,
            min: 0,
            max: 2,
        }, {
            type: "int",
            name: "iSunraysIterations",
            defaultValue: 5,
            min: 1,
            max: 30,
        }, {
            separator: "Pseudo-Random - Allgemeine Parameter"
        }, {
            type: "float",
            name: "iNoiseLevel",
            defaultValue: 1,
            min: 0.,
            max: 2.,
        }, {
            type: "float",
            name: "iNoiseFreq",
            defaultValue: 1,
            min: 0.01,
            max: 10.,
        }, {
            type: "float",
            name: "iNoiseOffset",
            defaultValue: 0,
            min: -1,
            max: 1,
        }, {
            type: "float",
            name: "iFractionalOctaves",
            defaultValue: 1,
            min: 1,
            max: 10.,
            step: 1,
        }, {
            type: "float",
            name: "iFractionalScale",
            defaultValue: 2.,
            min: 0.01,
            max: 10.,
        }, {
            type: "float",
            name: "iFractionalDecay",
            defaultValue: 0.5,
            min: 0.01,
            max: 2.,
        }, {
            type: "float",
            name: "iCloudMorph",
            defaultValue: 0,
            min: 0,
            max: 2,
            // }, {
            //     type: "float",
            //     name: "iCloudVelX",
            //     defaultValue: 0,
            //     min: -2.,
            //     max: 2,
        }, {
            separator: "Noch allgemeiner..."
        }, {
            type: "float",
            name: "iGamma",
            defaultValue: 2.2,
            min: 0.01,
            max: 10.,
        }, {
            type: "float",
            name: "iVignetteInner",
            defaultValue: 1.,
            min: 0,
            max: 1,
        }, {
            type: "float",
            name: "iVignetteOuter",
            defaultValue:0.17,
            min: 0,
            max: 1,
        }, {
            type: "float",
            name: "iVignetteScale",
            defaultValue: 1.39,
            min: 0.1,
            max: 10,
        }, {
            separator: "Noise Base",
        }, {
            type: "float",
            name: "iNoiseLevelA",
            defaultValue: 0.6,
            min: -1,
            max: 1,
        }, {
            type: "float",
            name: "iNoiseLevelB",
            defaultValue: 0.6,
            min: -1,
            max: 1,
        }, {
            type: "float",
            name: "iNoiseLevelC",
            defaultValue: 0,
            min: -1,
            max: 1,
        }, {
            type: "float",
            name: "iNoiseScaleA",
            defaultValue: 1,
            min: 0.01,
            max: 10,
        }, {
            type: "float",
            name: "iNoiseScaleB",
            defaultValue: 1,
            min: 0.01,
            max: 10,
        }, {
            type: "float",
            name: "iNoiseScaleC",
            defaultValue: 1,
            min: 0.01,
            max: 10,
        }, {
            type: "vec2",
            name: "iOverallNoiseShift",
            defaultValue: [1, 1],
            min: 0,
            max: 10,
        }, {
            type: "float",
            name: "iOverallScale",
            defaultValue: 2,
            min: 0.01,
            max: 10.,
        }, {
            type: "float",
            name: "iNoiseMorphingA",
            defaultValue: 0,
            min: 0,
            max: 6.28,
        }, {
            type: "float",
            name: "iNoiseMorphingB",
            defaultValue: 1.,
            min: 0,
            max: 6.28,
        }, {
            type: "float",
            name: "iNoiseMorphingC",
            defaultValue: 2.,
            min: 0,
            max: 6.28,
        }, {
            type: "float",
            name: "iOverallHashOffset",
            defaultValue: 0,
            min: -1,
            max: 1,
            step: 0.01
        }, {
            type: "float",
            name: "iTurbulenceNormFactor",
            defaultValue: 0.33,
            min: 0.001,
            max: 1.,
        }, {
            type: "float",
            name: "iTurbulenceMeanOffset",
            defaultValue: 0.18,
            min: 0.,
            max: 0.5,
        }, {
            type: "vec2",
            name: "iMarbleSqueeze",
            defaultValue: [0, 0],
            min: 0.0,
            max: 20.,
            step: 0.01
        }, {
            type: "float",
            name: "iMarbleGranularity",
            defaultValue: 7.5,
            min: 0.01,
            max: 50,
        }, {
            type: "float",
            name: "iMarbleGradingExponent",
            defaultValue: 1,
            min: 0.01,
            max: 5.,
        }, {
            type: "float",
            name: "iMarbleRange",
            defaultValue: 0.5,
            min: 0.01,
            max: 1.,
        }, {
            type: "float",
            name: "iColorStrength",
            defaultValue: 0.,
            min: 0,
            max: 1,
        }, {
            type: "vec3",
            name: "iColorCosineFreq",
            defaultValue: [11, 20, 30],
            min: 0,
            max: 31.42,
            step: 0.01,
        }, {
            type: "vec3",
            name: "iColorCosinePhase",
            defaultValue: [0, 1, 0.5],
            min: 0,
            max: 6.283,
            step: 0.01,
        }, {
            separator: "Zur freien Verwendung..."
        }, {
            type: "float",
            name: "iFree0",
            defaultValue: 0,
            min: 0.01,
            max: 100,
            log: true
        }, {
            type: "float",
            name: "iFree1",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree2",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree3",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree4",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree5",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }
    ];
}
