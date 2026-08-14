// js/config.js
// Κεντρικές σταθερές που μοιράζονται όλα τα modules.

export const CONFIG = {
    // --- Πόλη / grid ---
    CITY_SIZE: 480,       // συνολικό πλάτος/βάθος της πόλης (-240 έως 240)
    GRID_COUNT: 12,        // 12x12 = 144 blocks
    CELL_SIZE: 40,         // μέγεθος block + δρόμος γύρω του
    ROAD_WIDTH: 10,

    // --- Παίκτης (πεζός) ---
    PLAYER_HEIGHT: 1.8,
    PLAYER_RADIUS: 0.4,
    WALK_SPEED: 5,
    SPRINT_SPEED: 9.5,
    JUMP_FORCE: 8,
    GRAVITY: 20,

    // --- Πεζοί (NPCs) ---
    NPC_COUNT: 40,
    PED_IDLE_MIN: 1.0,
    PED_IDLE_MAX: 3.5,
    PED_CROSS_CHANCE: 0.3, // πιθανότητα να διασχίσει δρόμο προς γειτονικό block

    // --- Οχήματα ---
    VEHICLE_ENTER_DISTANCE: 3.2,
    TRAFFIC_CAR_COUNT: 22,
    PARKED_CAR_COUNT: 16,

    // --- Φανάρια ---
    TRAFFIC_LIGHT_TIMES: { green: 6, yellow: 1.5, red: 6 },

    // --- Ημέρα/νύχτα ---
    DAY_LENGTH_SECONDS: 240, // πόσα δευτερόλεπτα πραγματικού χρόνου = 1 πλήρες 24ωρο

    // --- Αστυνομία / wanted ---
    POLICE_CAR_COUNT: 8,
    MAX_WANTED: 5,
    WANTED_DECAY_TIME: 15,      // δευτ. χωρίς κοντινή καταδίωξη πριν πέσει 1 αστέρι
    WANTED_LOSE_RADIUS: 45,     // απόσταση πάνω από την οποία θεωρείται ότι σε "έχασαν"
    POLICE_RAM_COOLDOWN: 2,     // δευτ. cooldown ανάμεσα σε "χτυπήματα" περιπολικού
};
