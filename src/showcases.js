import showcase1 from "./showcases/1_PlainColor.js";
import showcase2 from "./showcases/2_GeometryPlayground.js";
import showcase2b from "./showcases/2_GeometryPlayground_sdBox.js";
import showcase2c from "./showcases/2_GeometryPlayground_grid.js";
import showcase3 from "./showcases/3_Textures.js";
import showcase4 from "./showcases/4_ColorPlayground.js";
import showcase5 from "./showcases/5a_Noise.js";
import showcase5b from "./showcases/5b_NoiseExtended.js";
import showcase6 from "./showcases/6a_RayMarchingPrimitivesSimplified.js";
import showcaseIQ from "./showcases/6b_RayMarchingPrimitives.js";
import showcase7 from "./showcases/7_VariousConceptsFor3D.js";
import showcase8 from "./showcases/8_MultiPassAndExtraData.js";
import showcase9 from "./showcases/9_FramebufferPingPong.js";
import showcase10 from "./showcases/10_RayTracing.js"
import showcase10b from "./showcases/10b_RayTracingPlusVolumetric.js"
import showcase11 from "./showcases/11_FluidSimulation.js";
import showcaseFb210 from "./showcases/11b_MoreFramebufferProcessing.js";
import showcase12 from "./showcases/12_PerformancePlayground.js";
import showcaseRIOW from "./showcases/retired/10_StochasticRayTracing.js";
import showcaseOld8 from "./showcases/retired/8_Multipass.js";
import showcaseOld11 from "./showcases/retired/11_Volumetric.js";
import showcaseX from "./showcases/X_SimulationPlayground.js";
import showcaseZClouds from "./showcases/Z_NR4_Clouds.js";

const defaultShowcase = showcase12;

const BY_PATH = {
    // Zum Anfang ein sehr, sehr langweiliger Anfang.
    "1": showcase1,
    // SDF in 2D, mit "2b" Vertiefung auf die Quadrat-SDF, "2c" zum Kontext der Gitter-Diskussion
    "2": showcase2,
    "2b": showcase2b,
    "2c": showcase2c,
    // Texturen Basics
    "3": showcase3,
    // Farbräume
    "4": showcase4,
    // Prozedurales Rauschen (Perlin Noise, FBM) -- nachgereicht, weil wir Ähnliches besprochen haben (z.B. Voronoi)
    "5": showcase5,
    "5a": showcase5,
    "5b": showcase5b,
    // Ray Marching mit SDF in 3D;
    "6": showcase6,
    "6a": showcase6,
    "6b": showcaseIQ, // s.u., ist zur Referenz der übersetzte Shadertoy-Shader von IQ
    // Aufbauend auf "6" mit _etlichen_ gängigen 3D-Konzepten (Kamerapfade, Texturen, Beleuchtung, Amb. Occlusion)
    "7": showcase7,
    // Einführung von Framebuffern, wobei "8" keine Zeit mehr fand. "9" ist ein einfacher Framebuffer-Showcase.
    // "8": showcase8, // Der wurde nicht fertig. Könnt ihr anschauen, ist aber wenig tiefgängig.
    "9": showcase9,
    // Ray Tracing ("10b" mit Volumetric Ray Marching am Rand)
    "10": showcase10,
    "10a": showcase10,
    "10b": showcase10b,
    // Demonstration eines sehr ausgiebigen Multi Pass / Framebuffer-Setups
    // aber UNVOLLSTÄNDIG -- den müsst ihr also nicht vertiefen.
    "11": showcase11,
    // <-- bis hierhin kamen wir nun bis Mitte November

    // --> Hier machen wir im Dezember weiter - "12": Performance-Somewhat-Deep-Dive.
    "12": showcase12,

    // spezifische Referenzen, die ich mal rangezogen habe, aber nicht zum Durchkauen gedacht.
    "iq": showcaseIQ, // same as "6b"
    "riow": showcaseRIOW,
    // Zwei Shader aus der VL im Frühjahr, die ich auch mal als Beispiel referenziert habe.
    // (Könnt ihr gerne anschauen um rauszukriegen, was ich euch wohl damit demonstriert habe,
    //  aber es wird keine tiefstgreifende Kenntnis vorausgesetzt. Fragt gerne ob der Relevanz nach.)
    "old8": showcaseOld8,
    "old11": showcaseOld11,
    // Einzelne Untersuchungen, die hier nur zur Demonstration liegen. Ggf. unfertig. IRRELEVANT.
    "210": showcaseX,
    "fb210": showcaseFb210,
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
