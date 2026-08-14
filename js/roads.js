// js/roads.js
// Οδική σηματοδότηση πάνω στο υπάρχον grid δρόμων: διακεκομμένες κεντρικές
// γραμμές, διαβάσεις πεζών στις διασταυρώσεις, και φανάρια σε επιλεγμένα
// σημεία με πραγματικό κύκλο red -> yellow -> green.

import * as THREE from 'three';
import { CONFIG } from './config.js';

function createDashedLineTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 8);
    ctx.fillStyle = '#f2d94e';
    ctx.fillRect(0, 2, 32, 4);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function createCrosswalkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#e8e8e8';
    for (let i = 0; i < 6; i++) ctx.fillRect(i * 11, 4, 7, 56);
    return new THREE.CanvasTexture(canvas);
}

export function createRoadMarkings(scene) {
    const half = CONFIG.CITY_SIZE / 2;
    const dashTexBase = createDashedLineTexture();
    const crossTex = createCrosswalkTexture();
    const crossMat = new THREE.MeshBasicMaterial({ map: crossTex });

    for (let i = 0; i <= CONFIG.GRID_COUNT; i++) {
        const pos = -half + i * CONFIG.CELL_SIZE;

        const hTex = dashTexBase.clone();
        hTex.needsUpdate = true;
        hTex.repeat.set(CONFIG.CITY_SIZE / 4, 1);
        const hGeo = new THREE.PlaneGeometry(CONFIG.CITY_SIZE, 0.3);
        const hLine = new THREE.Mesh(hGeo, new THREE.MeshBasicMaterial({ map: hTex, transparent: true }));
        hLine.rotation.x = -Math.PI / 2;
        hLine.position.set(0, 0.11, pos);
        scene.add(hLine);

        const vTex = dashTexBase.clone();
        vTex.needsUpdate = true;
        vTex.repeat.set(CONFIG.CITY_SIZE / 4, 1);
        const vGeo = new THREE.PlaneGeometry(CONFIG.CITY_SIZE, 0.3);
        const vLine = new THREE.Mesh(vGeo, new THREE.MeshBasicMaterial({ map: vTex, transparent: true }));
        vLine.rotation.x = -Math.PI / 2;
        vLine.rotation.z = Math.PI / 2;
        vLine.position.set(pos, 0.11, 0);
        scene.add(vLine);
    }

    for (let gx = 0; gx <= CONFIG.GRID_COUNT; gx++) {
        for (let gz = 0; gz <= CONFIG.GRID_COUNT; gz++) {
            const x = -half + gx * CONFIG.CELL_SIZE;
            const z = -half + gz * CONFIG.CELL_SIZE;
            const geo = new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH * 0.7, 2.4);
            const cw = new THREE.Mesh(geo, crossMat);
            cw.rotation.x = -Math.PI / 2;
            cw.position.set(x, 0.12, z - CONFIG.CELL_SIZE / 2 + 3);
            scene.add(cw);
        }
    }
}

export class TrafficLightSystem {
    constructor(scene) {
        this.lights = new Map(); // "gx,gz" -> { state, timer, redMat, yellowMat, greenMat }
        this.build(scene);
    }

    build(scene) {
        const half = CONFIG.CITY_SIZE / 2;
        for (let gx = 0; gx <= CONFIG.GRID_COUNT; gx++) {
            for (let gz = 0; gz <= CONFIG.GRID_COUNT; gz++) {
                if ((gx + gz) % 4 !== 0) continue; // μόνο σε επιλεγμένες διασταυρώσεις
                const x = -half + gx * CONFIG.CELL_SIZE;
                const z = -half + gz * CONFIG.CELL_SIZE;
                const entry = this.createPole(scene, x, z);
                entry.timer = Math.random() * 8;
                entry.state = 'green';
                this.lights.set(`${gx},${gz}`, entry);
            }
        }
    }

    createPole(scene, x, z) {
        const group = new THREE.Group();
        const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.2, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 1.6;
        pole.castShadow = true;
        group.add(pole);

        const boxGeo = new THREE.BoxGeometry(0.35, 0.9, 0.3);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.y = 3.4;
        group.add(box);

        const redMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0000, emissiveIntensity: 0 });
        const yellowMat = new THREE.MeshStandardMaterial({ color: 0x332b00, emissive: 0xffcc00, emissiveIntensity: 0 });
        const greenMat = new THREE.MeshStandardMaterial({ color: 0x003300, emissive: 0x00ff55, emissiveIntensity: 0 });
        const lampGeo = new THREE.SphereGeometry(0.1, 8, 8);

        const redLamp = new THREE.Mesh(lampGeo, redMat);
        redLamp.position.set(0, 3.65, 0.16);
        const yellowLamp = new THREE.Mesh(lampGeo, yellowMat);
        yellowLamp.position.set(0, 3.4, 0.16);
        const greenLamp = new THREE.Mesh(lampGeo, greenMat);
        greenLamp.position.set(0, 3.15, 0.16);
        group.add(redLamp, yellowLamp, greenLamp);

        group.position.set(x + 1.5, 0, z + 1.5);
        scene.add(group);

        return { redMat, yellowMat, greenMat };
    }

    update(delta) {
        const T = CONFIG.TRAFFIC_LIGHT_TIMES;
        for (const light of this.lights.values()) {
            light.timer -= delta;
            if (light.timer <= 0) {
                if (light.state === 'green') { light.state = 'yellow'; light.timer = T.yellow; }
                else if (light.state === 'yellow') { light.state = 'red'; light.timer = T.red; }
                else { light.state = 'green'; light.timer = T.green; }
            }
            light.redMat.emissiveIntensity = light.state === 'red' ? 1 : 0.05;
            light.yellowMat.emissiveIntensity = light.state === 'yellow' ? 1 : 0.05;
            light.greenMat.emissiveIntensity = light.state === 'green' ? 1 : 0.05;
        }
    }
}
