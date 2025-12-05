import {describe, it, expect} from "vitest";

/**
 *  The code under test is here all the showcases ever written,
 * imported once to see where we broke imports some day.
 * */
import showcase1 from "../showcases/1_PlainColor.js";
import showcase2 from "../showcases/2_GeometryPlayground.js";
import showcase2b from "../showcases/2_GeometryPlayground_sdBox.js";
import showcase2c from "../showcases/2_GeometryPlayground_grid.js";
import showcase3 from "../showcases/3_Textures.js";
import showcase4 from "../showcases/4_ColorPlayground.js";
import showcase5 from "../showcases/5a_Noise.js";
import showcase5b from "../showcases/5b_NoiseExtended.js";
import showcase6 from "../showcases/6_RayMarching.js";
import showcaseIQ from "../showcases/6b_RayMarchingPrimitives.js";
import showcase7 from "../showcases/7_VariousConceptsFor3D.js";
import showcase8 from "../showcases/8_RayTracingFirstSteps.js"
import showcase8b from "../showcases/8b_RayTracingPlusVolumetric.js"
import showcase9 from "../showcases/9_FramebufferPingPong.js";
import showcase9bUnfinished from "../showcases/9b_MultiPassAndExtraData.js";
import showcase10 from "../showcases/10_RayTracingWithMultipass.js"
import showcase11Unfinished from "../showcases/11_FluidSimulation.js";
import showcaseFb210 from "../showcases/11b_MoreFramebufferProcessing.js";
import showcase12 from "../showcases/12_PerformancePlayground.js";
import showcaseRIOW from "../showcases/RIOW_StochasticRayTracing.js";
import showcaseX from "../showcases/X_SimulationPlayground.js";
import showcaseZClouds from "../showcases/Z_NR4_Clouds.js";
import showcaseOld2a from "../showcases/retired/old2_HelloShadertoy_broken.js";
import showcaseOld2b from "../showcases/retired/old2_HelloShadertoy_fixed.js";
import showcaseOld2c from "../showcases/retired/old2_HelloShadertoy_fixed_static.js";
import showcaseOld3 from "../showcases/retired/old3_SimpleGeometry.js";
import showcaseOld4 from "../showcases/retired/old4_More2DGeometry.js";
import showcaseOld5a from "../showcases/retired/old5a_RayTracingCubeBeginning.js";
import showcaseOld5b from "../showcases/retired/old5b_RayTracingCubeExtended.js";
import showcaseOld6 from "../showcases/retired/old6_TexturesIn3D.js";
import showcaseOld7 from "../showcases/retired/old7_ColorMixing.js";
import showcaseOld8 from "../showcases/retired/old8_Multipass.js";
import showcaseOld9b from "../showcases/retired/old8_Multipass.js";
import showcaseOld11 from "../showcases/retired/old11_Volumetric.js";


describe('will run', () => {
    it('will really just run', () => {
        const target = {
            showcase1,
            showcase2,
            showcase2b,
            showcase2c,
            showcase3,
            showcase4,
            showcase5,
            showcase5b,
            showcase6,
            showcaseIQ,
            showcase7,
            showcase8,
            showcase8b,
            showcase9,
            showcase9bUnfinished,
            showcase10,
            showcase11Unfinished,
            showcaseFb210,
            showcase12,
            showcaseRIOW,
            showcaseOld8,
            showcaseOld11,
            showcaseX,
            showcaseZClouds,

            showcaseOld2a,
            showcaseOld2b,
            showcaseOld2c,
            showcaseOld3,
            showcaseOld4,
            showcaseOld5a,
            showcaseOld5b,
            showcaseOld6,
            showcaseOld7,
            showcaseOld9b,
        };
        expect(target).toBeDefined();
    });
});
