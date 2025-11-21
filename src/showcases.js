import showcase1 from "./showcases/1_PlainColor.js";
import showcase2 from "./showcases/2_GeometryPlayground.js";
import showcase2b from "./showcases/2_GeometryPlayground_sdBox.js";
import showcase2c from "./showcases/2_GeometryPlayground_grid.js";
import showcase3 from "./showcases/3_Textures.js";
import showcase4 from "./showcases/4_ColorPlayground.js";
import showcase5 from "./showcases/5_Noise.js";
import showcase6 from "./showcases/6a_RayMarchingPrimitivesSimplified.js";
import showcaseIQ from "./showcases/6b_RayMarchingPrimitives.js";
import showcase7 from "./showcases/7_VariousConceptsFor3D.js";
import showcase8 from "./showcases/8_MultiPassAndExtraData.js";
import showcase9 from "./showcases/9_FramebufferPingPong.js";
import showcase10a from "./showcases/10_RayTracing.js"
import showcase10b from "./showcases/10b_RayTracingPlusVolumetric.js"
import showcase11 from "./showcases/11_FluidSimulation.js";
import showcase12 from "./showcases/12_PerformancePlayground.js";
import showcaseRIOW from "./showcases/retired/10_StochasticRayTracing.js";
import showcaseOld8 from "./showcases/retired/8_Multipass.js";
import showcaseOld11 from "./showcases/retired/11_Volumetric.js";
import showcaseX from "./showcases/X_SimulationPlayground.js";
import showcaseZClouds from "./showcases/Z_NR4_Clouds.js";

const defaultShowcase    = showcase12;

const BY_PATH = {
    "1": showcase1,
    "2": showcase2,
    "2b": showcase2b,
    "2c": showcase2c,
    "3": showcase3,
    "4": showcase4,
    "5": showcase5,
    "6": showcase6,
    "6a": showcase6,
    "6b": showcaseIQ,
    "7": showcase7,
    "8": showcase8,
    "9": showcase9,
    "10": showcase10a,
    "10a": showcase10a,
    "10b": showcase10b,
    "11": showcase11,
    "12": showcase12,
    // specific references:
    "iq": showcaseIQ,
    "riow": showcaseRIOW,
    "old8": showcaseOld8,
    "old11": showcaseOld11,
    // some advanced investigations:
    "210": showcaseX,
    "nr4": showcaseZClouds,
};

export function selectShowcase() {
    const path = window.location.pathname.slice(1);
    const showcase = BY_PATH[path]
    if (showcase) {
        showcase.path = path;
        return showcase;
    }
    return defaultShowcase;
}
