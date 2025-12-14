const FLOAT_SIZE = 4;

export function createUboForArray(gl, program, array, opt) {
    if (!opt.blockName) {
        throw Error("createUboForArray needs at least a \"blockName\"!");
    }
    opt.dataSize ??= FLOAT_SIZE;
    opt.memoryUsage ??= gl.STATIC_DRAW;
    // gl.DYNAMIC_DRAW if data is changing often!
    // but... suffice to say I never compared these..?

    const ubo = gl.createBuffer();
    const blockSize = array.length * opt.dataSize;
    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, blockSize, opt.memoryUsage);

    const blockIndex = gl.getUniformBlockIndex(program, opt.blockName);
    if (blockIndex === gl.INVALID_INDEX) {
        console.error("Found no layout(std140) uniform", opt.blockName);
        return null;
    }

    // seems that WebGL2 doesn't allow (std140, binding=0), only (std140)
    const binding = gl.getActiveUniformBlockParameter(
        program, blockIndex, gl.UNIFORM_BLOCK_BINDING
    );
    gl.uniformBlockBinding(program, blockIndex, 0);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo);

    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, array);

    const checkBlockSize = gl.getActiveUniformBlockParameter(
        program, blockIndex, gl.UNIFORM_BLOCK_DATA_SIZE
    );
    console.info("[UBO]", opt.blockName, ubo, opt,
        "Do Block Sizes in Bytes match...", checkBlockSize, blockSize,
        "? Block Index:", blockIndex, "Binding", binding
    );

    /*
    Update Data with:
        gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, array);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo);
     */

    return ubo;
}

export function createUboForStruct(gl, program, opt) {
    if (!opt.blockName) {
        throw Error("createUboForStruct needs at least a \"blockName\"!");
    }
    opt.dataSize ??= 4;
    opt.dataLength ??= 1;
    opt.memoryUsage ??= gl.DYNAMIC_DRAW;
    opt.bindingPoint ??= 0;
    opt.initialData ??= null;

    const result = {
        opt,
        ubo: null,
        block: {
            name: opt.blockName,
            size: null,
            index: null,
            binding: null,
        },
        error: "",
        members: {},
        fields: []
    };

    if (opt.structFields) {
        result.fields = Object.entries(opt.structFields);
        // SIDE QUEST: could read dataSize from the structFields...
        // opt.dataSize = Math.max(opt.dataSize, structSize(result.fields));
    }

    /**
     * Convenience: specify a map like
     *   { member1: 0, member2: 1 }
     * to access these by name (value is index of base alignment each)
     */
    if (opt.memberMap) {
        const keys = Object.keys(opt.memberMap);
        opt.dataLength = Math.max(opt.dataLength, keys.length);
        for (const key of keys) {
            // const offset = opt.dataSize * opt.memberMap[key];
            // constructMember(key, offset);
            constructMember(key);
        }
    }

    const block = result.block;
    block.size = opt.dataLength * opt.dataSize;

    result.ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, result.ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, block.size, opt.memoryUsage);

    block.index = gl.getUniformBlockIndex(program, block.name);
    if (block.index === gl.INVALID_INDEX) {
        result.error = `Found no layout(std140) uniform "${block.name}"`;
        return result;
    }

    block.binding = gl.getActiveUniformBlockParameter(
        program, block.index, gl.UNIFORM_BLOCK_BINDING
    );
    gl.uniformBlockBinding(program, block.index, opt.bindingPoint);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, opt.bindingPoint, result.ubo);

    if (opt.initialData) {
        gl.bindBuffer(gl.UNIFORM_BUFFER, result.ubo);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, opt.data);
    }

    result.updateMemberAt = (baseIndex, memberData) => {
        /** Helper function that does no checks on it's own!
         * (but probably expects memberData as array of <dataSize> length)
         * */
        gl.bindBuffer(gl.UNIFORM_BUFFER, result.ubo);
        const offset = baseIndex * opt.dataSize;
        gl.bufferSubData(gl.UNIFORM_BUFFER, offset, memberData);
    }

    block.actualSize = gl.getActiveUniformBlockParameter(
        program, block.index, gl.UNIFORM_BLOCK_DATA_SIZE
    );
    if (block.actualSize !== block.size) {
        console.warn("[UBO][CUSTOM STRUCTS]",
            "Block Sizes don't match; you said", block.size,
            "WebGL thinks differently:", block.actualSize, "..?", result
        );
    }

    console.info("[UBO]", opt.blockName, result);

    return result;

    function constructMember(key, offset = undefined) {
        const memberIndex = result.opt.memberMap;
        result.members[key] = {
            offset: offset ?? result.opt.dataSize * memberIndex[key],
            set: (data) =>
                result.updateMemberAt(memberIndex[key], data),
            // Does not have to be used, just a float32ing offer:
            workdata: new Float32Array(opt.dataSize / FLOAT_SIZE),
            update: constructMemberUpdater(key)
        };
        return result.members[key];
    }

    function constructMemberUpdater(key) {
        let changed;
        // the update object can contain all the fields, and
        // as an additional info { reset: false } (true by default)
        return (update) => {
            const member = result.members[key];
            console.log(result.members, key, member, update);
            changed = false;
            if (update.reset !== false) {
                member.workdata.fill(0);
                changed = true;
            }
            if (!update.type) {
                update.type = -1;
            }
            for (const [field, [start,]] of result.fields) {
                if (!update.hasOwnProperty(field)) {
                    continue;
                }
                member.workdata.set(update[field], start);
                changed = true;
            }
            if (changed) {
                gl.bindBuffer(gl.UNIFORM_BUFFER, result.ubo);
                gl.bufferSubData(gl.UNIFORM_BUFFER, member.offset, member.workdata);
            }
        };
    }
}
//
// /**
//  * @param fields {Array<[string, [number, number]]>}
//  *               whereas start and size are given in 32bit (i.e. number of floats / ints)
//  */
// function structSize(fields) {
//     const cursor = {
//         baseAlignmentInFours: 1,
//         counter: 0,
//         subcounter: 0,
//     };
//     for (const [, [, sizeInFours]] of fields) {
//         if (sizeInFours > cursor.baseAlignmentInFours) {
//             cursor.baseAlignmentInFours = sizeInFours;
//         }
//     }
//     /*
//     The Rules (GLSL Spec §7.6.2.2)
//      -- Member alignment: offset = roundUp(offset, member.baseAlign)
//      -- Struct baseAlign = max(all member baseAligns)
//      -- Struct size = roundUp(total_offset, baseAlign)
//      -- Next struct offset = roundUp(prev_end, prev.baseAlign) -> vec4 stride
//      */
// }