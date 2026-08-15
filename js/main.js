// js/main.js
// Entry point. Στήνει σκηνή/renderer, φτιάχνει κόσμο/πόλη/δρόμους/φανάρια/
// traffic/οχήματα/παίκτη/κάμερα/πεζούς/minimap (Part 1-2), και προσθέτει
// day/night, καιρό, αστυνομία/wanted, missions και ήχο (Part 3).

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createWorld } from './world.js';
import { createCity } from './city.js';
import { createRoadMarkings, TrafficLightSystem } from './roads.js';
import { Player } from './player.js';
import { ThirdPersonCamera } from './camera.js';
import { NPCManager } from './npc.js';
import { Minimap } from './minimap.js';
import { spawnParkedVehicles } from './vehicle.js';
import { TrafficManager } from './traffic.js';
import { getDistrictAtWorld } from './district.js';
import { DayNightCycle } from './sun.js';
import { WeatherSystem } from './weather.js';
import { PoliceManager } from './police.js';
import { MissionSystem } from './missions.js';
import { AudioSystem } from './audio.js';
import { SaveSystem } from './save.js';
import { showMainMenu } from './menu.js';

// --- Scene / camera / renderer ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game-container').appendChild(renderer.domElement);

// --- Κόσμος (Part 1-2, αμετάβλητο) ---
const worldRefs = createWorld(scene);
const city = createCity(scene);
createRoadMarkings(scene);
const trafficLights = new TrafficLightSystem(scene);

const player = new Player(scene, city.buildings);
const thirdPersonCamera = new ThirdPersonCamera(camera, player, city.buildings, renderer.domElement);
const npcManager = new NPCManager(scene, city.buildings, city.lots);
const parkedVehicles = spawnParkedVehicles(scene, city.buildings, CONFIG.PARKED_CAR_COUNT);
const trafficManager = new TrafficManager(scene, city.buildings, trafficLights.lights);
const minimap = new Minimap(document.getElementById('minimap-canvas'), city);

// --- Νέα συστήματα (Part 3) ---
const dayNight = new DayNightCycle(scene, worldRefs.sun, worldRefs.ambient, city.streetLightMats);
const weather = new WeatherSystem(scene, worldRefs.ground);
const policeManager = new PoliceManager(scene, city.buildings);
const missionSystem = new MissionSystem(scene);
const audio = new AudioSystem();

let drivingVehicle = null;
let wantedLevel = 0;
let wantedDecayTimer = 0;
let lastRamTime = -999;
let elapsedTime = 0;

// --- Input ---
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyE') tryEnterExitVehicle();
    if (e.code === 'KeyV') weather.cycleNext();
    if (e.code === 'KeyQ') wantedLevel = Math.min(CONFIG.MAX_WANTED, wantedLevel + 1); // debug: δεν υπάρχει ακόμα σύστημα εγκλήματος
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
    audio.init();
});
document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === renderer.domElement;
    const hint = document.getElementById('pointer-lock-hint');
    if (hint) hint.style.display = locked ? 'none' : 'flex';
});

function findNearbyVehicle() {
    const all = [...parkedVehicles, ...trafficManager.cars.map((c) => c.vehicle)];
    let closest = null;
    let closestDist = CONFIG.VEHICLE_ENTER_DISTANCE;
    for (const v of all) {
        if (v.isPlayerControlled) continue;
        const dx = v.mesh.position.x - player.mesh.position.x;
        const dz = v.mesh.position.z - player.mesh.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < closestDist) { closestDist = d; closest = v; }
    }
    return closest;
}

function tryEnterExitVehicle() {
    if (drivingVehicle) {
        drivingVehicle.isPlayerControlled = false;
        drivingVehicle.throttleInput = 0;
        drivingVehicle.steerInput = 0;
        drivingVehicle.handbrake = false;

        const exitOffset = new THREE.Vector3(2.2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), drivingVehicle.heading);
        player.mesh.position.copy(drivingVehicle.mesh.position).add(exitOffset);
        player.mesh.visible = true;

        drivingVehicle = null;
        thirdPersonCamera.setTarget(player, 7);
    } else {
        const v = findNearbyVehicle();
        if (v) {
            drivingVehicle = v;
            v.isPlayerControlled = true;
            v.isParked = false;
            player.mesh.visible = false;
            thirdPersonCamera.setTarget(v, 9);
        }
    }
}

// --- Wanted level: αυξάνεται αν χτυπήσεις περιπολικό οδηγώντας, μειώνεται
// αυτόματα αν δεν υπάρχει κοντά σου αστυνομικός που να σε καταδιώκει. Δεν
// υπάρχει ακόμα σύστημα εγκλήματος/όπλων, οπότε αυτό το "ram" είναι προς το
// παρόν ο μόνος φυσικός τρόπος να ανέβει το wanted level (πέρα από το debug
// πλήκτρο Q). ---
function updateWanted(delta, refPos) {
    if (drivingVehicle) {
        const closestAny = policeManager.closestAnyDistance(refPos);
        if (closestAny < 3.5 && elapsedTime - lastRamTime > CONFIG.POLICE_RAM_COOLDOWN) {
            wantedLevel = Math.min(CONFIG.MAX_WANTED, wantedLevel + 1);
            lastRamTime = elapsedTime;
            wantedDecayTimer = 0;
        }
    }

    if (wantedLevel > 0) {
        const closestChaser = policeManager.closestChaserDistance(refPos);
        if (closestChaser < CONFIG.WANTED_LOSE_RADIUS) {
            wantedDecayTimer = 0;
        } else {
            wantedDecayTimer += delta;
            if (wantedDecayTimer > CONFIG.WANTED_DECAY_TIME) {
                wantedLevel -= 1;
                wantedDecayTimer = 0;
            }
        }
    }
}

// --- UI refs ---
const moneyValue = document.getElementById('money-value');
const wantedValue = document.getElementById('wanted-value');
const speedHud = document.getElementById('speed-hud');
const interactPrompt = document.getElementById('interact-prompt');
const districtLabelEl = document.getElementById('district-label');
const clockEl = document.getElementById('clock-hud');
const missionPanel = document.getElementById('mission-panel');
const missionTitleEl = document.getElementById('mission-title');
const missionDescEl = document.getElementById('mission-desc');
const missionTimerEl = document.getElementById('mission-timer');

document.getElementById('health-bar').style.width = '100%';

let lastDistrictName = '';
let missionMessageTimer = 0;

function updateUI(delta) {
    moneyValue.textContent = '$' + missionSystem.money;
    wantedValue.textContent = '★'.repeat(wantedLevel) + '☆'.repeat(CONFIG.MAX_WANTED - wantedLevel);
    wantedValue.style.color = wantedLevel > 0 ? '#ff4d4d' : '#ffffff';

    if (drivingVehicle) {
        speedHud.style.display = 'block';
        speedHud.textContent = Math.abs(Math.round(drivingVehicle.speed * 3.6)) + ' km/h';
        interactPrompt.textContent = 'E — Έξοδος από όχημα';
        interactPrompt.style.display = 'block';
    } else {
        speedHud.style.display = 'none';
        interactPrompt.style.display = findNearbyVehicle() ? 'block' : 'none';
        if (interactPrompt.style.display === 'block') interactPrompt.textContent = 'E — Είσοδος στο όχημα';
    }

    const pos = (drivingVehicle || player).mesh.position;
    const district = getDistrictAtWorld(pos.x, pos.z);
    if (district && district.name !== lastDistrictName) {
        lastDistrictName = district.name;
        districtLabelEl.textContent = district.name;
        districtLabelEl.style.opacity = '1';
        clearTimeout(updateUI._fadeTimer);
        updateUI._fadeTimer = setTimeout(() => { districtLabelEl.style.opacity = '0'; }, 3000);
    }

    clockEl.textContent = dayNight.getClockString() + (dayNight.isNight ? ' 🌙' : ' ☀') + ' — ' + weather.mode.toUpperCase();

    // --- Mission panel ---
    if (missionSystem.status === 'active' && missionSystem.def) {
        missionPanel.style.display = 'block';
        missionTitleEl.textContent = missionSystem.def.title;
        missionDescEl.textContent = missionSystem.def.description;
        missionTimerEl.textContent = missionSystem.def.timeLimit
            ? Math.max(0, Math.ceil(missionSystem.timeRemaining)) + 's'
            : '';
    } else if (missionSystem.status === 'success' || missionSystem.status === 'failed') {
        missionPanel.style.display = 'block';
        missionTitleEl.textContent = missionSystem.status === 'success' ? 'MISSION COMPLETE' : 'MISSION FAILED';
        missionDescEl.textContent = missionSystem.status === 'success'
            ? `+$${missionSystem.def.reward}`
            : 'Better luck next time.';
        missionTimerEl.textContent = '';

        missionMessageTimer += delta;
        if (missionMessageTimer > 3) {
            missionMessageTimer = 0;
            missionSystem.startNext();
        }
    } else if (missionSystem.status === 'done') {
        missionPanel.style.display = 'none';
    }
}

// --- Save / Load ---
let saveIndicatorTimer = 0;
const saveIndicatorEl = document.createElement('div');
saveIndicatorEl.id = 'save-indicator';
saveIndicatorEl.textContent = 'GAME SAVED';
document.body.appendChild(saveIndicatorEl);

function collectSaveData() {
    const pos = player.mesh.position;
    return {
        x: pos.x,
        z: pos.z,
        money: missionSystem.money,
        wantedLevel: 0, // δεν αποθηκεύουμε ενεργή καταδίωξη — ξεκινάς καθαρός
        missionIndex: missionSystem.activeIndex,
    };
}

function doSave() {
    SaveSystem.save(collectSaveData());
    saveIndicatorEl.classList.add('visible');
    saveIndicatorTimer = 2.5;
}

function applySaveData(data) {
    player.mesh.position.set(data.x || 0, 0, data.z || 0);
    missionSystem.restore(data.money, data.missionIndex);
}

window.addEventListener('beforeunload', () => {
    SaveSystem.save(collectSaveData());
});

// --- Animation loop ---
const clock = new THREE.Clock();
let gameStarted = false;
let autosaveTimer = 0;

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    if (!gameStarted) { renderer.render(scene, camera); return; }
    elapsedTime += delta;

    if (drivingVehicle) {
        drivingVehicle.throttleInput = keys['KeyW'] ? 1 : keys['KeyS'] ? -1 : 0;
        drivingVehicle.steerInput = keys['KeyA'] ? 1 : keys['KeyD'] ? -1 : 0;
        drivingVehicle.handbrake = !!keys['Space'];
        drivingVehicle.update(delta);
    } else {
        player.update(delta, keys, thirdPersonCamera.yaw);
    }

    thirdPersonCamera.update(delta);
    npcManager.update(delta);
    trafficManager.update(delta);
    trafficLights.update(delta);
    dayNight.update(delta);

    const refPos = (drivingVehicle || player).mesh.position;
    weather.update(delta, refPos);

    policeManager.update(delta, refPos, wantedLevel, elapsedTime);
    updateWanted(delta, refPos);

    missionSystem.update(delta, player.mesh.position, drivingVehicle ? drivingVehicle.mesh.position : null);

    audio.updateEngine(!!drivingVehicle, drivingVehicle ? Math.abs(drivingVehicle.speed) / drivingVehicle.stats.maxSpeed : 0);
    audio.updateSiren(wantedLevel > 0 && policeManager.closestChaserDistance(refPos) < 55, elapsedTime);

    minimap.update(drivingVehicle || player, npcManager.npcs, trafficManager.cars, policeManager.cars, missionSystem.marker ? missionSystem.currentTarget : null);
    updateUI(delta);

    autosaveTimer += delta;
    if (autosaveTimer > 20) {
        autosaveTimer = 0;
        doSave();
    }
    if (saveIndicatorTimer > 0) {
        saveIndicatorTimer -= delta;
        if (saveIndicatorTimer <= 0) saveIndicatorEl.classList.remove('visible');
    }

    renderer.render(scene, camera);
}
animate();

showMainMenu({
    hasSave: SaveSystem.hasSave(),
    onPlay: () => {
        SaveSystem.clear();
        gameStarted = true;
        clock.getDelta(); // μηδενισμός ώστε το πρώτο frame να μην έχει τεράστιο delta
    },
    onContinue: () => {
        const data = SaveSystem.load();
        if (data) applySaveData(data);
        gameStarted = true;
        clock.getDelta();
    },
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
