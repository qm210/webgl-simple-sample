import * as idb from "idb";

const DB = {
    NAME: "qm210.database",
    VERSION: 1
};

const STORE = {
    PRESETS: "presets",
};

export async function initializePresetStore() {
    const db = idb.openDB(
        DB.NAME,
        DB.VERSION,
        {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE.PRESETS)) {
                    db.createObjectStore(STORE.PRESETS, {
                        keyPath: "id",
                        autoIncrement: true,
                    });
                }
            }
    });
    db.presets = [];
    return db;
}

export async function loadPresets(db, showcaseId) {
    return db.getAll(STORE.PRESETS)
        .then(presets =>
            presets.filter(p => p.showcaseId === showcaseId)
        );
}

export async function createPreset(db, bundle, name = undefined) {
    if (name) {
        bundle.name = name;
    }
    return db.add(STORE.PRESETS, bundle);
}

export async function updatePreset(db, bundle) {
    await db.put(STORE.PRESETS, bundle);
}

export async function deletePreset(db, bundleId) {
    await db.delete(STORE.PRESETS, bundleId);
}