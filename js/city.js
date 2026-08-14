// js/city.js
// Δημιουργεί την πόλη πάνω σε grid 12x12: κάθε block ανήκει σε μια από τις
// 8 συνοικίες (district.js) και παίρνει το αντίστοιχο στυλ κτιρίου. Τα
// κτίρια έχουν παράθυρα/λεπτομέρειες αντί να είναι απλοί κύβοι. Επιστρέφει
// buildings (για collision), lots (για minimap), districtLabels και landmarks.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { DISTRICTS, getDistrictKey } from './district.js';
import { makeWindowMaterial, getSignTexture } from './textures.js';
import { createVehicleMesh } from './vehicle.js';

const BUSINESS_NAMES = [
    '24/7 STORE', 'CAFÉ', 'RESTAURANT', 'PHARMACY', 'ELECTRONICS',
    'GYM', 'CLOTHING', 'HOTEL', 'GARAGE',
];
let businessIndex = 0;
let placedPolice = false;
let placedHospital = false;
let placedBank = false;

export function createCity(scene) {
    const buildings = [];
    const lots = [];
    const landmarks = [];
    const districtSum = {}; // id -> { x, z, count }

    const half = CONFIG.CITY_SIZE / 2;
    const lotSize = CONFIG.CELL_SIZE - CONFIG.ROAD_WIDTH;

    for (let gx = 0; gx < CONFIG.GRID_COUNT; gx++) {
        for (let gz = 0; gz < CONFIG.GRID_COUNT; gz++) {
            const cx = -half + CONFIG.CELL_SIZE * gx + CONFIG.CELL_SIZE / 2;
            const cz = -half + CONFIG.CELL_SIZE * gz + CONFIG.CELL_SIZE / 2;

            const key = getDistrictKey(gx, gz);
            const district = DISTRICTS[key];

            if (!districtSum[key]) districtSum[key] = { x: 0, z: 0, count: 0 };
            districtSum[key].x += cx;
            districtSum[key].z += cz;
            districtSum[key].count += 1;

            if (district.special) {
                handleSpecialBlock(scene, key, cx, cz, lotSize, buildings, landmarks);
                lots.push({ x: cx, z: cz, size: lotSize, type: 'special', district: key });
                continue;
            }

            const isPark = Math.random() < district.parkChance;

            const lotGeo = new THREE.BoxGeometry(lotSize, 0.2, lotSize);
            const lotMat = new THREE.MeshStandardMaterial({ color: isPark ? 0x4c8c4a : district.ground });
            const lotMesh = new THREE.Mesh(lotGeo, lotMat);
            lotMesh.position.set(cx, 0.1, cz);
            lotMesh.receiveShadow = true;
            scene.add(lotMesh);

            lots.push({ x: cx, z: cz, size: lotSize, type: isPark ? 'park' : 'building', district: key });

            if (isPark) {
                addParkDetails(scene, cx, cz, lotSize);
            } else {
                const built = buildOnLot(scene, district, cx, cz, lotSize);
                if (built.box) buildings.push({ mesh: built.mesh, box: built.box });
                if (built.landmark) landmarks.push(built.landmark);
            }
        }
    }

    // --- Φανάρια δρόμου (visual, στις μισές διασταυρώσεις) ---
    const streetLightMats = [];
    for (let gx = 0; gx <= CONFIG.GRID_COUNT; gx++) {
        for (let gz = 0; gz <= CONFIG.GRID_COUNT; gz++) {
            if ((gx + gz) % 2 !== 0) continue;
            const x = -half + CONFIG.CELL_SIZE * gx;
            const z = -half + CONFIG.CELL_SIZE * gz;
            const withPointLight = (gx + gz) % 4 === 0;
            const { group, bulbMat } = createStreetLight(x, z, withPointLight);
            scene.add(group);
            streetLightMats.push(bulbMat);
        }
    }

    // --- Πινακίδες με το όνομα κάθε συνοικίας, στα σύνορά της ---
    const districtLabels = [];
    for (const key in districtSum) {
        const s = districtSum[key];
        const cx = s.x / s.count;
        const cz = s.z / s.count;
        districtLabels.push({ name: DISTRICTS[key].name, x: cx, z: cz });
        scene.add(createDistrictSign(DISTRICTS[key].name, cx, cz));
    }

    // --- Νερό δίπλα στην παραλία ---
    addOceanWater(scene, districtLabels);

    return { buildings, lots, districtLabels, landmarks, streetLightMats };
}

// ---------------------------------------------------------------------
// Ειδικά blocks: AIRPORT / OCEAN BEACH
// ---------------------------------------------------------------------

function handleSpecialBlock(scene, key, cx, cz, lotSize, buildings, landmarks) {
    const district = DISTRICTS[key];

    const groundGeo = new THREE.BoxGeometry(lotSize, 0.2, lotSize);
    const groundMat = new THREE.MeshStandardMaterial({ color: district.ground });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(cx, 0.1, cz);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    if (key === 'airport') {
        if (Math.random() < 0.22) {
            // Υπόστεγο (hangar)
            const w = lotSize * 0.6, d = lotSize * 0.5, h = 10;
            const geo = new THREE.BoxGeometry(w, h, d);
            const mat = new THREE.MeshStandardMaterial({ color: 0xb8bcc0 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(cx, h / 2 + 0.2, cz);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            mesh.updateMatrixWorld(true);
            buildings.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
            if (!landmarks.some((l) => l.name === 'AIRPORT HANGAR')) {
                landmarks.push({ name: 'AIRPORT HANGAR', x: cx, z: cz });
            }
        } else {
            // Ανοιχτό διάδρομο/apron — απλή λευκή γραμμή στο κέντρο
            const stripeGeo = new THREE.PlaneGeometry(lotSize * 0.15, lotSize * 0.9);
            const stripeMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.rotation.x = -Math.PI / 2;
            stripe.position.set(cx, 0.21, cz);
            scene.add(stripe);
        }
    } else if (key === 'beach') {
        const treeCount = Math.random() < 0.4 ? 1 : 0;
        for (let i = 0; i < treeCount; i++) {
            const tx = cx + (Math.random() * 2 - 1) * (lotSize / 2 - 4);
            const tz = cz + (Math.random() * 2 - 1) * (lotSize / 2 - 4);
            scene.add(createPalmTree(tx, tz));
        }
    }
}

function addOceanWater(scene, districtLabels) {
    const beachLabel = districtLabels.find((d) => d.name === 'OCEAN BEACH');
    if (!beachLabel) return;
    const half = CONFIG.CITY_SIZE / 2;
    const waterGeo = new THREE.PlaneGeometry(CONFIG.CELL_SIZE * 3, CONFIG.CITY_SIZE);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2f6fa8, transparent: true, opacity: 0.85, roughness: 0.3 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    // Η παραλία είναι στη ζώνη low,high -> βάζουμε το νερό ακριβώς έξω από το άκρο x
    const edgeX = beachLabel.x < 0 ? -half - CONFIG.CELL_SIZE : half + CONFIG.CELL_SIZE;
    water.position.set(edgeX, -0.3, beachLabel.z);
    scene.add(water);
}

// ---------------------------------------------------------------------
// Κτίρια ανά στυλ συνοικίας
// ---------------------------------------------------------------------

function buildOnLot(scene, district, cx, cz, lotSize) {
    switch (district.style) {
        case 'skyscraper': return buildSkyscraper(scene, district, cx, cz, lotSize);
        case 'house': return buildHouse(scene, district, cx, cz, lotSize);
        case 'warehouse': return buildWarehouse(scene, district, cx, cz, lotSize);
        case 'oldtown': return buildOldTown(scene, district, cx, cz, lotSize);
        case 'shop': return buildShop(scene, district, cx, cz, lotSize);
        default: return buildHouse(scene, district, cx, cz, lotSize);
    }
}

function pickColor(district) {
    return district.colors[Math.floor(Math.random() * district.colors.length)];
}

function buildSkyscraper(scene, district, cx, cz, lotSize) {
    const margin = 4;
    const footprint = lotSize - margin * 2;
    const w = footprint * (0.45 + Math.random() * 0.4);
    const d = footprint * (0.45 + Math.random() * 0.4);
    const [minH, maxH] = district.heightRange;
    const height = minH + Math.random() * (maxH - minH);
    const color = pickColor(district);

    const mat = makeWindowMaterial(color, w / 2.2, height / 3);
    const geo = new THREE.BoxGeometry(w, height, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, height / 2 + 0.2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Cap στην κορυφή
    const capGeo = new THREE.BoxGeometry(w * 0.55, height * 0.06, d * 0.55);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(cx, height + 0.2 + (height * 0.06) / 2, cz);
    cap.castShadow = true;
    scene.add(cap);

    // Μονάδες κλιματισμού στην ταράτσα
    addRoofUnits(scene, cx, cz, w, d, height + 0.2);

    mesh.updateMatrixWorld(true);
    return { mesh, box: new THREE.Box3().setFromObject(mesh) };
}

function buildHouse(scene, district, cx, cz, lotSize) {
    const margin = 6;
    const footprint = lotSize - margin * 2;
    const w = footprint * (0.55 + Math.random() * 0.3);
    const d = footprint * (0.55 + Math.random() * 0.3);
    const [minH, maxH] = district.heightRange;
    const height = minH + Math.random() * (maxH - minH);
    const color = pickColor(district);

    const bodyMat = new THREE.MeshStandardMaterial({ color });
    const bodyGeo = new THREE.BoxGeometry(w, height, d);
    const mesh = new THREE.Mesh(bodyGeo, bodyMat);
    mesh.position.set(cx, height / 2 + 0.2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Πυραμιδοειδής (hip) στέγη
    const roofRadius = Math.max(w, d) * 0.75;
    const roofGeo = new THREE.ConeGeometry(roofRadius, height * 0.45, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b3b2a });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(cx, height + 0.2 + (height * 0.45) / 2, cz);
    roof.castShadow = true;
    scene.add(roof);

    // Πόρτα
    const doorGeo = new THREE.PlaneGeometry(w * 0.22, height * 0.5);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1e });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(cx, height * 0.25 + 0.21, cz + d / 2 + 0.01);
    scene.add(door);

    // Παράθυρα (μερικά, όχι texture — τα σπίτια είναι μικρά)
    for (const side of [-1, 1]) {
        const winGeo = new THREE.PlaneGeometry(w * 0.18, height * 0.22);
        const winMat = new THREE.MeshStandardMaterial({ color: 0xbfe0f2, emissive: 0x88c4e0, emissiveIntensity: 0.3 });
        const win = new THREE.Mesh(winGeo, winMat);
        win.position.set(cx + side * w * 0.28, height * 0.55 + 0.21, cz + d / 2 + 0.01);
        scene.add(win);
    }

    mesh.updateMatrixWorld(true);
    return { mesh, box: new THREE.Box3().setFromObject(mesh) };
}

function buildWarehouse(scene, district, cx, cz, lotSize) {
    const margin = 3;
    const w = lotSize - margin * 2;
    const d = (lotSize - margin * 2) * (0.7 + Math.random() * 0.25);
    const [minH, maxH] = district.heightRange;
    const height = minH + Math.random() * (maxH - minH);
    const color = pickColor(district);

    const mat = new THREE.MeshStandardMaterial({ color });
    const geo = new THREE.BoxGeometry(w, height, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, height / 2 + 0.2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Μεγάλη πόρτα φόρτωσης
    const doorGeo = new THREE.PlaneGeometry(w * 0.4, height * 0.55);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(cx, height * 0.3 + 0.21, cz + d / 2 + 0.01);
    scene.add(door);

    // Λωρίδα φωταγωγών στην οροφή
    const skylightGeo = new THREE.BoxGeometry(w * 0.9, 0.3, d * 0.15);
    const skylightMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const skylight = new THREE.Mesh(skylightGeo, skylightMat);
    skylight.position.set(cx, height + 0.35, cz);
    scene.add(skylight);

    mesh.updateMatrixWorld(true);
    return { mesh, box: new THREE.Box3().setFromObject(mesh) };
}

function buildOldTown(scene, district, cx, cz, lotSize) {
    const margin = 3;
    const w = (lotSize - margin * 2) * (0.4 + Math.random() * 0.25);
    const d = (lotSize - margin * 2) * (0.4 + Math.random() * 0.25);
    const [minH, maxH] = district.heightRange;
    const height = minH + Math.random() * (maxH - minH);
    const color = pickColor(district);

    const mat = makeWindowMaterial(color, w / 1.6, height / 2.4);
    const geo = new THREE.BoxGeometry(w, height, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, height / 2 + 0.2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Μπαλκόνια (προεξέχουσες λεπτές πλάκες)
    const balconyLevels = Math.floor(height / 4);
    for (let i = 1; i <= balconyLevels; i++) {
        const balGeo = new THREE.BoxGeometry(w * 0.7, 0.12, 0.4);
        const balMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a });
        const balcony = new THREE.Mesh(balGeo, balMat);
        balcony.position.set(cx, i * 4, cz + d / 2 + 0.2);
        balcony.castShadow = true;
        scene.add(balcony);
    }

    mesh.updateMatrixWorld(true);
    return { mesh, box: new THREE.Box3().setFromObject(mesh) };
}

function buildShop(scene, district, cx, cz, lotSize) {
    // Μικρή πιθανότητα για ειδικά σημεία ενδιαφέροντος αντί για απλό μαγαζί
    const roll = Math.random();
    if (roll < 0.08) return buildGasStation(scene, cx, cz, lotSize);
    if (roll < 0.16) return buildDealership(scene, cx, cz, lotSize);

    const margin = 4;
    const w = (lotSize - margin * 2) * (0.6 + Math.random() * 0.3);
    const d = (lotSize - margin * 2) * (0.6 + Math.random() * 0.3);
    const [minH, maxH] = district.heightRange;
    const height = minH + Math.random() * (maxH - minH);
    const color = pickColor(district);

    const mat = makeWindowMaterial(color, w / 2, height / 2.5);
    const geo = new THREE.BoxGeometry(w, height, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, height / 2 + 0.2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Τέντα ισογείου
    const awningGeo = new THREE.BoxGeometry(w * 1.05, 0.3, 1.2);
    const awningMat = new THREE.MeshStandardMaterial({ color: 0xb03030 });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.set(cx, height * 0.22 + 0.2, cz + d / 2 + 0.5);
    awning.castShadow = true;
    scene.add(awning);

    // Επιλογή ονόματος επιχείρησης — τα πρώτα ειδικά κτίρια γίνονται
    // αστυνομικό τμήμα / νοσοκομείο / τράπεζα, τα υπόλοιπα τυχαία μαγαζιά.
    let label, bg;
    let landmark = null;
    if (!placedPolice && Math.random() < 0.15) {
        label = 'POLICE STATION'; bg = '#1a3a8f'; placedPolice = true;
        landmark = { name: label, x: cx, z: cz };
    } else if (!placedHospital && Math.random() < 0.15) {
        label = 'HOSPITAL'; bg = '#c81e1e'; placedHospital = true;
        landmark = { name: label, x: cx, z: cz };
    } else if (!placedBank && Math.random() < 0.15) {
        label = 'BANK'; bg = '#4a4a2c'; placedBank = true;
        landmark = { name: label, x: cx, z: cz };
    } else {
        label = BUSINESS_NAMES[businessIndex % BUSINESS_NAMES.length];
        businessIndex++;
        bg = '#2c2c2c';
    }

    const signGeo = new THREE.PlaneGeometry(w * 0.8, 1.1);
    const signMat = new THREE.MeshBasicMaterial({ map: getSignTexture(label, bg), transparent: true });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(cx, height * 0.32 + 0.2, cz + d / 2 + 0.55);
    scene.add(sign);

    mesh.updateMatrixWorld(true);
    return { mesh, box: new THREE.Box3().setFromObject(mesh), landmark };
}

function buildGasStation(scene, cx, cz, lotSize) {
    const canopyGeo = new THREE.BoxGeometry(lotSize * 0.6, 0.4, lotSize * 0.35);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8 });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(cx, 4.2, cz);
    canopy.castShadow = true;
    scene.add(canopy);

    const postGeo = new THREE.CylinderGeometry(0.15, 0.15, 4, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(cx + dx * lotSize * 0.25, 2, cz + dz * lotSize * 0.13);
        scene.add(post);
    }

    for (const dx of [-1, 1]) {
        const pumpGeo = new THREE.BoxGeometry(0.5, 1.3, 0.4);
        const pumpMat = new THREE.MeshStandardMaterial({ color: 0xdd2222 });
        const pump = new THREE.Mesh(pumpGeo, pumpMat);
        pump.position.set(cx + dx * 1.5, 0.85, cz);
        pump.castShadow = true;
        scene.add(pump);
    }

    const signGeo = new THREE.PlaneGeometry(3, 1);
    const signMat = new THREE.MeshBasicMaterial({ map: getSignTexture('GAS STATION', '#dd2222'), transparent: true });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(cx, 5.2, cz - lotSize * 0.2);
    scene.add(sign);

    const box = new THREE.Box3(
        new THREE.Vector3(cx - lotSize * 0.32, 0, cz - lotSize * 0.2),
        new THREE.Vector3(cx + lotSize * 0.32, 4.4, cz + lotSize * 0.2)
    );
    return { mesh: canopy, box, landmark: { name: 'GAS STATION', x: cx, z: cz } };
}

function buildDealership(scene, cx, cz, lotSize) {
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x999999 });
    const fenceGeo = new THREE.BoxGeometry(0.1, 1.1, lotSize * 0.85);
    for (const dx of [-1, 1]) {
        const fence = new THREE.Mesh(fenceGeo, fenceMat);
        fence.position.set(cx + dx * lotSize * 0.42, 0.55, cz);
        scene.add(fence);
    }

    const types = ['sedan', 'sports', 'suv'];
    for (let i = 0; i < 3; i++) {
        const car = createVehicleMesh(types[i % types.length]);
        car.position.set(cx + (i - 1) * 3.2, 0, cz);
        car.rotation.y = Math.PI / 2;
        scene.add(car);
    }

    const signGeo = new THREE.PlaneGeometry(3.4, 1);
    const signMat = new THREE.MeshBasicMaterial({ map: getSignTexture('CAR DEALERSHIP', '#1a1a1a'), transparent: true });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(cx, 2.6, cz - lotSize * 0.35);
    scene.add(sign);

    const box = new THREE.Box3(
        new THREE.Vector3(cx - lotSize * 0.4, 0, cz - lotSize * 0.4),
        new THREE.Vector3(cx + lotSize * 0.4, 1.5, cz + lotSize * 0.4)
    );
    return { mesh: sign, box, landmark: { name: 'CAR DEALERSHIP', x: cx, z: cz } };
}

function addRoofUnits(scene, cx, cz, w, d, roofY) {
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
        const geo = new THREE.BoxGeometry(0.8, 0.5, 0.8);
        const mat = new THREE.MeshStandardMaterial({ color: 0x777777 });
        const unit = new THREE.Mesh(geo, mat);
        unit.position.set(
            cx + (Math.random() * 2 - 1) * (w / 2 - 1),
            roofY + 0.25,
            cz + (Math.random() * 2 - 1) * (d / 2 - 1)
        );
        unit.castShadow = true;
        scene.add(unit);
    }
}

// ---------------------------------------------------------------------
// Δέντρα, φανάρια, πινακίδες συνοικιών
// ---------------------------------------------------------------------

function addParkDetails(scene, cx, cz, lotSize) {
    const treeCount = 3 + Math.floor(Math.random() * 4);
    for (let t = 0; t < treeCount; t++) {
        const tx = cx + (Math.random() * 2 - 1) * (lotSize / 2 - 3);
        const tz = cz + (Math.random() * 2 - 1) * (lotSize / 2 - 3);
        scene.add(createTree(tx, tz));
    }

    // Πάγκοι γύρω-γύρω
    const benchCount = 2 + Math.floor(Math.random() * 3);
    for (let b = 0; b < benchCount; b++) {
        const angle = (b / benchCount) * Math.PI * 2 + Math.random() * 0.5;
        const r = lotSize / 2 - 2;
        const bx = cx + Math.cos(angle) * r;
        const bz = cz + Math.sin(angle) * r;
        const bench = createBench();
        bench.position.set(bx, 0.2, bz);
        bench.rotation.y = angle;
        scene.add(bench);
    }

    // Σιντριβάνι στο κέντρο (μόνο σε αρκετά μεγάλα lots)
    if (lotSize > 25 && Math.random() < 0.5) {
        scene.add(createFountain(cx, cz));
    }

    // Φανάρι πάρκου
    scene.add(createParkLamp(cx + (Math.random() * 2 - 1) * (lotSize / 4), cz + (Math.random() * 2 - 1) * (lotSize / 4)));
}

function createBench() {
    const group = new THREE.Group();
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x6b4423 });
    const seatGeo = new THREE.BoxGeometry(1.4, 0.1, 0.45);
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.y = 0.45;
    seat.castShadow = true;
    group.add(seat);

    const backGeo = new THREE.BoxGeometry(1.4, 0.4, 0.08);
    const back = new THREE.Mesh(backGeo, seatMat);
    back.position.set(0, 0.68, -0.19);
    group.add(back);

    const legMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const legGeo = new THREE.BoxGeometry(0.08, 0.45, 0.4);
    for (const dx of [-0.6, 0.6]) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(dx, 0.22, 0);
        group.add(leg);
    }
    return group;
}

function createFountain(cx, cz) {
    const group = new THREE.Group();
    const baseGeo = new THREE.CylinderGeometry(2.2, 2.4, 0.5, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.25;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const waterGeo = new THREE.CylinderGeometry(1.9, 1.9, 0.15, 16);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x4a9fd8, transparent: true, opacity: 0.85 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = 0.55;
    group.add(water);

    const spoutGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.4, 8);
    const spoutMat = new THREE.MeshStandardMaterial({ color: 0x999999 });
    const spout = new THREE.Mesh(spoutGeo, spoutMat);
    spout.position.y = 1.1;
    group.add(spout);

    group.position.set(cx, 0.2, cz);
    return group;
}

function createParkLamp(x, z) {
    const group = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.3;
    pole.castShadow = true;
    group.add(pole);

    const bulbGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff2a8, emissive: 0xfff2a8, emissiveIntensity: 0.7 });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.y = 2.6;
    group.add(bulb);

    group.position.set(x, 0.2, z);
    return group;
}

function createTree(x, z) {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.4, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.7;
    trunk.castShadow = true;
    group.add(trunk);

    const leavesGeo = new THREE.ConeGeometry(1.1, 2.2, 8);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2f7d32 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 2.2;
    leaves.castShadow = true;
    group.add(leaves);

    group.position.set(x, 0.2, z);
    return group;
}

function createPalmTree(x, z) {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 3.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.6;
    trunk.rotation.z = 0.08;
    trunk.castShadow = true;
    group.add(trunk);

    for (let i = 0; i < 5; i++) {
        const leafGeo = new THREE.ConeGeometry(0.25, 1.8, 4);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x3d8f4a });
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.y = 3.2;
        leaf.rotation.z = Math.PI / 2.2;
        leaf.rotation.y = (i / 5) * Math.PI * 2;
        leaf.castShadow = true;
        group.add(leaf);
    }

    group.position.set(x, 0.2, z);
    return group;
}

function createStreetLight(x, z, withPointLight) {
    const group = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 4, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 2;
    pole.castShadow = true;
    group.add(pole);

    const bulbGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff2a8, emissive: 0xfff2a8, emissiveIntensity: 0.9 });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.y = 4;
    group.add(bulb);

    if (withPointLight) {
        const pl = new THREE.PointLight(0xfff2a8, 0.7, 16);
        pl.position.y = 4;
        group.add(pl);
    }

    group.position.set(x, 0.2, z);
    return { group, bulbMat };
}

function createDistrictSign(name, x, z) {
    const group = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.75;
    group.add(pole);

    const signGeo = new THREE.PlaneGeometry(4.2, 0.9);
    const signMat = new THREE.MeshBasicMaterial({ map: getSignTexture(name, '#0e3b5c'), transparent: true });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.y = 3.6;
    group.add(sign);
    const signBack = new THREE.Mesh(signGeo, signMat);
    signBack.position.y = 3.6;
    signBack.rotation.y = Math.PI;
    group.add(signBack);

    group.position.set(x, 0, z);
    return group;
}
