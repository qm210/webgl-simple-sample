import showcase1 from "./showcases/1_PlainColor.js";
import showcase2 from "./showcases/2_GeometryPlayground.js";
import showcase2b from "./showcases/2_GeometryPlayground_sdBox.js";
import showcase2c from "./showcases/2_GeometryPlayground_grid.js";
import showcase3 from "./showcases/3_Textures.js";
import showcase4 from "./showcases/4_ColorPlayground.js";
import showcase5a from "./showcases/retired/5a_RayTracingCubeBeginning.js";
import showcase5b from "./showcases/retired/5b_RayTracingCubeExtended.js";
import showcase6 from "./showcases/retired/6_TexturesIn3D.js";
import showcase7 from "./showcases/retired/7_ColorMixing.js";
import showcase8 from "./showcases/retired/8_Multipass.js";
import showcase9 from "./showcases/retired/9_FramebufferPingPong.js";
import showcase10 from "./showcases/retired/10_StochasticRayTracing.js";
import showcase11 from "./showcases/retired/11_Volumetric.js";

const defaultShowcase = showcase2;

export function selectShowcase() {

    // Flexibel umschalten z.B. per
    // localhost:5173/5a

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
        case "5a":
            return showcase5a;
        case "5b":
        case "5":
            return showcase5b;
        case "6":
            return showcase6;
        case "7":
            return showcase7;
        case "8":
            return showcase8;
        case "9":
            return showcase9;
        case "10":
            return showcase10;
        case "11":
            return showcase11;
        default:
            return defaultShowcase;
    }
}
