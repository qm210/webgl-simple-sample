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
    const blockBytes = array.length * opt.dataSize;
    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, blockBytes, opt.memoryUsage);

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
        "Block Sizes equal... ", checkBlockSize, blockBytes,
        "? Block Name/Index:", blockIndex, "Binding", binding,
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
    opt.data ??= null;

    const result = {
        opt,
        ubo: null,
        block: {
            name: opt.blockName,
            bytes: null,
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

    result.block.bytes = opt.dataLength * opt.dataSize;

    result.ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, result.ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, result.block.bytes, opt.memoryUsage);

    result.block.index = gl.getUniformBlockIndex(program, result.block.name);
    if (result.block.index === gl.INVALID_INDEX) {
        result.error = `Found no layout(std140) uniform "${result.block.name}"`;
        return result;
    }

    result.block.binding = gl.getActiveUniformBlockParameter(
        program, result.block.index, gl.UNIFORM_BLOCK_BINDING
    );
    gl.uniformBlockBinding(program, result.block.index, opt.bindingPoint);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, opt.bindingPoint, result.ubo);

    if (opt.data) {
        gl.bindBuffer(gl.UNIFORM_BUFFER, result.ubo);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, opt.data);
    }

    // update like:
    // gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
    // gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
    // (or 0 -> offset in bytes, if you update specific elements)

    result.updateMemberAt = (baseIndex, memberData) => {
        /** Helper function that does no checks on it's own!
         * (but probably expects memberData as array of <dataSize> length)
         * */
        gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
        const offset = baseIndex * opt.dataSize;
        gl.bufferSubData(gl.UNIFORM_BUFFER, offset, memberData);
    }

    /**
     * More Convenience: If the options define a memberMap, can update via
     * updateMembers({
     *     member1: [...],
     *     member2: [...]
     *     ... all members optional ...
     * }
     * if not defined in the memberMap, it will take their position
     * but take caution, as JS' maps don't have a reliable order =P
     */
    // Works, but maybe unnecessary and/or questionable in performance (??)
    /*
    result.updateMembers = (dataByMember) => {
        gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
        let index = 0;
        for (const key in dataByMember) {
            const offset = result.members[key]?.offset
                ?? constructMember(
                    key, index * opt.dataSize, opt
                );
            gl.bufferSubData(gl.UNIFORM_BUFFER, offset, dataByMember[key]);
            index++;
        }
    }
     */

    console.log("[UBO FOR CUSTOM STRUCTS]", opt.blockName, result);

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
        const member = result.members[key];
        let changed;
        // the update object can contain all the fields, and
        // as an additional info { reset: false } (true by default)
        return (update) => {
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
//  * @param structFields as a record {
//  *     field: [start, size],
//  *     ...
//  * } whereas start and size are given in 32bit (i.e. number of floats / ints)
//  */
// function structSize(fields) {
//     let baseAlignmentInFours = 1;
//     for (const [field, [startInFours, sizeInFours]] of fields) {
//         if (sizeInFours > baseAlignmentInFours) {
//             baseAlignmentInFours = sizeInFours;
//         }
//
//     }
// }