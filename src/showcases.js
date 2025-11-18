import showcase1 from "./showcases/1_PlainColor.js";
import showcase2 from "./showcases/2_GeometryPlayground.js";
import showcase2b from "./showcases/2_GeometryPlayground_sdBox.js";
import showcase2c from "./showcases/2_GeometryPlayground_grid.js";
import showcase3 from "./showcases/3_Textures.js";
import showcase4 from "./showcases/4_ColorPlayground.js";
import showcase5 from "./showcases/5_Noise.js";
import showcase6a from "./showcases/6a_RayMarchingPrimitivesSimplified.js";
import showcase6b from "./showcases/6b_RayMarchingPrimitives.js";
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

const defaultShowcase = showcase12;

export function selectShowcase() {

    // Flexibel umschalten, per URL z.B. für 5a: http://localhost:5173/5a
    const showcaseId = window.location.pathname.slice(1);

    switch(showcaseId) {
        case "1":
            return showcase1;
        case "2":
            return showcase2;
        case "2b":
            return showcase2b;
        case "2c":
            return showcase2c;
        case "3":
            return showcase3;
        case "4":
            return showcase4;
        case "5":
            return showcase5;
        case "6":
        case "6a":
            return showcase6a;
        case "iq":
        case "6b":
            return showcase6b;
        case "7":
            return showcase7;
        case "8":
            return showcase8;
        case "9":
            return showcase9;
        case "10":
        case "10a":
            return showcase10a;
        case "10b":
            return showcase10b;
        case "11":
            return showcase11;
        case "12":
            return showcase11;
        case "riow":
            return showcaseRIOW;
        case "old8":
            return showcaseOld8;
        case "old11":
            return showcaseOld11;
        case "210":
            return showcaseX;
        case "nr4":
            return showcaseZClouds;
        default:
            return defaultShowcase;
    }
}
