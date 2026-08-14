// js/police.js
// Αστυνομικά οχήματα: όταν wantedLevel == 0 περιπολούν στο road grid (ίδια
// λογική με το traffic.js), και όταν wantedLevel > 0 ένας αριθμός τους
// (ανάλογα με τα αστέρια) στρέφεται σε "καταδίωξη" — κατευθύνεται απευθείας
// προς τον παίκτη/όχημα, με σειρήνα ενεργή.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Vehicle } from './vehicle.js';

export class PoliceManager {
    constructor(scene, buildings) {
        this.buildings = buildings;
        this.cars = [];

        const half = CONFIG.CITY_SIZE / 2;
        const spacing = CONFIG.CELL_SIZE;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

        for (let i = 0; i < CONFIG.POLICE_CAR_COUNT; i++) {
            const vehicle = new Vehicle(scene, 'police', buildings);
            vehicle.isParked = false;

            const gx = Math.floor(Math.random() * (CONFIG.GRID_COUNT + 1));
            const gz = Math.floor(Math.random() * (CONFIG.GRID_COUNT + 1));
            const [dx, dz] = dirs[Math.floor(Math.random() * dirs.length)];
            vehicle.setPosition(-half + gx * spacing, -half + gz * spacing, Math.atan2(dx, dz));

            this.cars.push({
                vehicle,
                node: { gx, gz },
                dir: [dx, dz],
                mode: 'patrol',
                sirenMats: this.findSirenMats(vehicle),
            });
        }
    }

    findSirenMats(vehicle) {
        const mats = [];
        vehicle.mesh.traverse((obj) => {
            if (obj.material && obj.material.emissive && (obj.material.emissive.r > 0.5 || obj.material.emissive.b > 0.5)) {
                mats.push(obj.material);
            }
        });
        return mats;
    }

    update(delta, targetPos, wantedLevel, elapsedTime) {
        const half = CONFIG.CITY_SIZE / 2;
        const spacing = CONFIG.CELL_SIZE;
        const chaseCount = Math.min(this.cars.length, wantedLevel * 2);

        for (let idx = 0; idx < this.cars.length; idx++) {
            const c = this.cars[idx];
            const v = c.vehicle;
            const shouldChase = wantedLevel > 0 && idx < chaseCount;
            c.mode = shouldChase ? 'chase' : 'patrol';

            const sirenOn = shouldChase && Math.floor(elapsedTime * 4) % 2 === 0;
            for (const mat of c.sirenMats) mat.emissiveIntensity = sirenOn ? 1.6 : 0.3;

            if (shouldChase) {
                const dx = targetPos.x - v.mesh.position.x;
                const dz = targetPos.z - v.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                const desiredHeading = Math.atan2(dx, dz);
                let diff = desiredHeading - v.heading;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                v.heading += diff * Math.min(1, delta * 2.4);
                v.throttleInput = dist > 4 ? 1 : 0.15;
                v.steerInput = 0;
                v.handbrake = false;
                v.update(delta);
            } else {
                const targetX = -half + (c.node.gx + c.dir[0]) * spacing;
                const targetZ = -half + (c.node.gz + c.dir[1]) * spacing;
                const dx = targetX - v.mesh.position.x;
                const dz = targetZ - v.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                v.throttleInput = 0.45;
                v.steerInput = 0;
                v.handbrake = false;
                const desiredHeading = Math.atan2(c.dir[0], c.dir[1]);
                let diff = desiredHeading - v.heading;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                v.heading += diff * Math.min(1, delta * 3);
                v.update(delta);

                if (dist < 1.5) {
                    c.node = { gx: c.node.gx + c.dir[0], gz: c.node.gz + c.dir[1] };
                    c.dir = this.pickNextDirection(c.node, c.dir);
                }
            }
        }
    }

    pickNextDirection(node, currentDir) {
        const options = [];
        if (node.gx > 0) options.push([-1, 0]);
        if (node.gx < CONFIG.GRID_COUNT) options.push([1, 0]);
        if (node.gz > 0) options.push([0, -1]);
        if (node.gz < CONFIG.GRID_COUNT) options.push([0, 1]);

        const noReverse = options.filter(([dx, dz]) => !(dx === -currentDir[0] && dz === -currentDir[1]));
        const pool = noReverse.length > 0 ? noReverse : options;
        if (pool.some(([dx, dz]) => dx === currentDir[0] && dz === currentDir[1]) && Math.random() < 0.6) {
            return currentDir;
        }
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // Απόσταση του πλησιέστερου αυτοκινήτου που καταδιώκει, από μια θέση.
    closestChaserDistance(pos) {
        let min = Infinity;
        for (const c of this.cars) {
            if (c.mode !== 'chase') continue;
            const dx = c.vehicle.mesh.position.x - pos.x;
            const dz = c.vehicle.mesh.position.z - pos.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < min) min = d;
        }
        return min;
    }

    // Απόσταση του πλησιέστερου (οποιουδήποτε mode) περιπολικού, από μια θέση.
    closestAnyDistance(pos) {
        let min = Infinity;
        for (const c of this.cars) {
            const dx = c.vehicle.mesh.position.x - pos.x;
            const dz = c.vehicle.mesh.position.z - pos.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < min) min = d;
        }
        return min;
    }
}
