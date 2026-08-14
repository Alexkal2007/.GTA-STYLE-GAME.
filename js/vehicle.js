// js/vehicle.js
// Οχήματα: factory function που φτιάχνει το 3D mesh ενός τύπου οχήματος
// (όχι απλός κύβος — σώμα + καμπίνα + τροχοί + φώτα + λεπτομέρειες ανά
// τύπο), και μια κλάση Vehicle με απλή αλλά "βαριά/αποκρίσιμη" φυσική
// που χρησιμοποιείται είτε από τον παίκτη (οδήγηση) είτε από το AI κίνησης
// (traffic.js).

import * as THREE from 'three';
import { CONFIG } from './config.js';

export const VEHICLE_TYPES = {
    sedan: { length: 4.4, width: 1.8, height: 1.3, cabinHeight: 0.55, color: 0x3355aa, maxSpeed: 24, accel: 9 },
    suv: { length: 4.7, width: 1.95, height: 1.65, cabinHeight: 0.8, color: 0x5a5a5a, maxSpeed: 22, accel: 8 },
    sports: { length: 4.2, width: 1.85, height: 1.05, cabinHeight: 0.4, color: 0xdd2222, maxSpeed: 34, accel: 14 },
    pickup: { length: 5.0, width: 1.9, height: 1.5, cabinHeight: 0.7, color: 0x6b6b4f, maxSpeed: 20, accel: 7.5 },
    van: { length: 4.9, width: 1.95, height: 2.0, cabinHeight: 1.2, color: 0xe0dcc8, maxSpeed: 18, accel: 6.5 },
    taxi: { length: 4.4, width: 1.8, height: 1.3, cabinHeight: 0.55, color: 0xffd21f, maxSpeed: 23, accel: 9, taxi: true },
    truck: { length: 7.2, width: 2.2, height: 2.6, cabinHeight: 1.4, color: 0x8a2b2b, maxSpeed: 15, accel: 5, big: true },
    police: { length: 4.5, width: 1.85, height: 1.35, cabinHeight: 0.6, color: 0x16181c, maxSpeed: 28, accel: 11, police: true },
};

export function createVehicleMesh(typeKey) {
    const t = VEHICLE_TYPES[typeKey] || VEHICLE_TYPES.sedan;
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.4, metalness: 0.5 });
    const bodyGeo = new THREE.BoxGeometry(t.width, t.height * 0.55, t.length);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = (t.height * 0.55) / 2 + 0.35;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.85 });
    const cabinGeo = new THREE.BoxGeometry(t.width * 0.85, t.cabinHeight, t.length * (t.big ? 0.5 : 0.55));
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, t.height * 0.55 + 0.35 + t.cabinHeight / 2, t.big ? -t.length * 0.12 : -t.length * 0.02);
    cabin.castShadow = true;
    group.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const wheelX = t.width / 2 + 0.02;
    const wheelZ = t.length / 2 - 0.6;
    const wheelY = 0.35;
    const wheels = [];
    for (const [wx, wz] of [[-wheelX, wheelZ], [wheelX, wheelZ], [-wheelX, -wheelZ], [wheelX, -wheelZ]]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, wheelY, wz);
        wheel.castShadow = true;
        group.add(wheel);
        wheels.push(wheel);
    }

    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff4c2, emissive: 0xfff4c2, emissiveIntensity: 1 });
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0xff2b2b, emissive: 0xff2b2b, emissiveIntensity: 1 });
    const lightGeo = new THREE.BoxGeometry(0.25, 0.15, 0.06);
    for (const side of [-1, 1]) {
        const hl = new THREE.Mesh(lightGeo, headlightMat);
        hl.position.set(side * (t.width / 2 - 0.25), t.height * 0.4, t.length / 2 + 0.02);
        group.add(hl);
        const tl = new THREE.Mesh(lightGeo, taillightMat);
        tl.position.set(side * (t.width / 2 - 0.25), t.height * 0.4, -t.length / 2 - 0.02);
        group.add(tl);
    }

    if (t.police) {
        const barGeo = new THREE.BoxGeometry(t.width * 0.7, 0.18, 0.4);
        const barMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(0, t.height * 0.55 + 0.35 + t.cabinHeight + 0.12, -t.length * 0.02);
        group.add(bar);
        const led = new THREE.BoxGeometry(t.width * 0.32, 0.1, 0.3);
        const redLed = new THREE.Mesh(led, new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1 }));
        redLed.position.set(-t.width * 0.18, bar.position.y + 0.14, bar.position.z);
        const blueLed = new THREE.Mesh(led, new THREE.MeshStandardMaterial({ color: 0x2255ff, emissive: 0x2255ff, emissiveIntensity: 1 }));
        blueLed.position.set(t.width * 0.18, bar.position.y + 0.14, bar.position.z);
        group.add(redLed, blueLed);
    }

    if (t.taxi) {
        const signGeo = new THREE.BoxGeometry(0.5, 0.2, 0.25);
        const signMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffcc00, emissiveIntensity: 0.5 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(0, t.height * 0.55 + 0.35 + t.cabinHeight + 0.1, -t.length * 0.02);
        group.add(sign);
    }

    group.userData.wheels = wheels;
    group.userData.length = t.length;
    group.userData.width = t.width;
    return group;
}

// --- Ελεγχόμενο όχημα (παίκτης ή AI) ---
export class Vehicle {
    constructor(scene, typeKey, buildings) {
        this.typeKey = typeKey;
        this.stats = VEHICLE_TYPES[typeKey] || VEHICLE_TYPES.sedan;
        this.buildings = buildings;
        this.mesh = createVehicleMesh(typeKey);
        scene.add(this.mesh);

        this.speed = 0;
        this.heading = 0;
        this.steerInput = 0;
        this.throttleInput = 0;
        this.handbrake = false;
        this.isPlayerControlled = false;
        this.isParked = true;
    }

    setPosition(x, z, heading = 0) {
        this.mesh.position.set(x, 0, z);
        this.heading = heading;
        this.mesh.rotation.y = heading;
    }

    update(delta) {
        const s = this.stats;

        if (this.handbrake) {
            this.speed *= Math.max(0, 1 - delta * 4.5);
        } else if (this.throttleInput > 0) {
            this.speed += s.accel * this.throttleInput * delta;
        } else if (this.throttleInput < 0) {
            if (this.speed > 0.3) {
                this.speed += s.accel * 1.6 * this.throttleInput * delta; // φρενάρισμα
            } else {
                this.speed += s.accel * 0.6 * this.throttleInput * delta; // όπισθεν
            }
        } else {
            this.speed *= Math.max(0, 1 - delta * 1.2); // τριβή
        }

        const maxReverse = -s.maxSpeed * 0.4;
        this.speed = Math.max(maxReverse, Math.min(s.maxSpeed, this.speed));
        if (Math.abs(this.speed) < 0.03) this.speed = 0;

        if (Math.abs(this.speed) > 0.05) {
            const steerFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 6, 0.3, 1);
            const dir = this.speed >= 0 ? 1 : -1;
            this.heading += this.steerInput * steerFactor * dir * delta * 1.8;
        }

        const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
        let nextPos = this.mesh.position.clone().addScaledVector(forward, this.speed * delta);
        nextPos = this.resolveCollision(nextPos);

        const half = CONFIG.CITY_SIZE / 2 - 3;
        if (Math.abs(nextPos.x) > half || Math.abs(nextPos.z) > half) {
            this.speed *= 0.2;
            nextPos.x = Math.max(-half, Math.min(half, nextPos.x));
            nextPos.z = Math.max(-half, Math.min(half, nextPos.z));
        }

        this.mesh.position.copy(nextPos);
        this.mesh.rotation.y = this.heading;

        const wheels = this.mesh.userData.wheels;
        if (wheels) {
            const spin = (this.speed * delta) / 0.35;
            for (const w of wheels) w.rotation.x -= spin;
        }
    }

    resolveCollision(pos) {
        const radius = (Math.max(this.stats.width, this.stats.length) / 2) * 0.85;
        for (const b of this.buildings) {
            const box = b.box;
            const closestX = Math.max(box.min.x, Math.min(pos.x, box.max.x));
            const closestZ = Math.max(box.min.z, Math.min(pos.z, box.max.z));
            const dx = pos.x - closestX;
            const dz = pos.z - closestZ;
            const distSq = dx * dx + dz * dz;
            if (distSq < radius * radius) {
                const dist = Math.sqrt(distSq) || 0.0001;
                const overlap = radius - dist;
                pos.x += (dx / dist) * overlap;
                pos.z += (dz / dist) * overlap;
                this.speed *= 0.6;
            }
        }
        return pos;
    }
}

// Δημιουργεί στατικά παρκαρισμένα (αλλά οδηγήσιμα) οχήματα διάσπαρτα
// στην πόλη, κοντά σε δρόμους, για να μπορεί ο παίκτης να μπει σε ένα.
export function spawnParkedVehicles(scene, buildings, count) {
    const types = Object.keys(VEHICLE_TYPES);
    const vehicles = [];
    const half = CONFIG.CITY_SIZE / 2;
    let attempts = 0;

    while (vehicles.length < count && attempts < count * 25) {
        attempts++;
        const gx = Math.floor(Math.random() * (CONFIG.GRID_COUNT + 1));
        const gz = Math.floor(Math.random() * (CONFIG.GRID_COUNT + 1));
        const alongX = Math.random() > 0.5;
        const offset = (Math.random() * 2 - 1) * (CONFIG.CELL_SIZE * 0.3);
        let x = -half + gx * CONFIG.CELL_SIZE;
        let z = -half + gz * CONFIG.CELL_SIZE;
        if (alongX) x += offset; else z += offset;

        const type = types[Math.floor(Math.random() * types.length)];
        const v = new Vehicle(scene, type, buildings);
        v.setPosition(x, z, alongX ? Math.PI / 2 : 0);
        v.isParked = true;
        vehicles.push(v);
    }
    return vehicles;
}
