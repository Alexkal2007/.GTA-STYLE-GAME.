// js/traffic.js
// AI κίνηση οχημάτων: κάθε αυτοκίνητο κινείται από διασταύρωση σε
// διασταύρωση πάνω στο road grid, σταματάει σε κόκκινο/κίτρινο φανάρι
// όταν πλησιάζει, και διαλέγει (κυρίως τυχαία, με προτίμηση στην ευθεία)
// επόμενη κατεύθυνση σε κάθε διασταύρωση.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Vehicle } from './vehicle.js';

const TRAFFIC_TYPES = ['sedan', 'suv', 'pickup', 'van', 'taxi', 'police'];

export class TrafficManager {
    constructor(scene, buildings, trafficLights) {
        this.buildings = buildings;
        this.trafficLights = trafficLights; // Map "gx,gz" -> { state, ... }
        this.cars = [];

        const half = CONFIG.CITY_SIZE / 2;
        const spacing = CONFIG.CELL_SIZE;

        for (let i = 0; i < CONFIG.TRAFFIC_CAR_COUNT; i++) {
            const type = TRAFFIC_TYPES[Math.floor(Math.random() * TRAFFIC_TYPES.length)];
            const vehicle = new Vehicle(scene, type, buildings);
            vehicle.isParked = false;

            const gx = Math.floor(Math.random() * (CONFIG.GRID_COUNT + 1));
            const gz = Math.floor(Math.random() * (CONFIG.GRID_COUNT + 1));
            const x = -half + gx * spacing;
            const z = -half + gz * spacing;
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            const [dx, dz] = dirs[Math.floor(Math.random() * dirs.length)];
            vehicle.setPosition(x, z, Math.atan2(dx, dz));

            this.cars.push({ vehicle, node: { gx, gz }, dir: [dx, dz] });
        }
    }

    update(delta) {
        const half = CONFIG.CITY_SIZE / 2;
        const spacing = CONFIG.CELL_SIZE;

        for (const c of this.cars) {
            const v = c.vehicle;

            const targetX = -half + (c.node.gx + c.dir[0]) * spacing;
            const targetZ = -half + (c.node.gz + c.dir[1]) * spacing;
            const dx = targetX - v.mesh.position.x;
            const dz = targetZ - v.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            const lightKey = `${c.node.gx + c.dir[0]},${c.node.gz + c.dir[1]}`;
            const light = this.trafficLights.get(lightKey);
            const nearIntersection = dist < spacing * 0.35;
            const mustStop = light && nearIntersection && light.state !== 'green';

            v.throttleInput = mustStop ? -1 : 0.6;
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

    pickNextDirection(node, currentDir) {
        const options = [];
        if (node.gx > 0) options.push([-1, 0]);
        if (node.gx < CONFIG.GRID_COUNT) options.push([1, 0]);
        if (node.gz > 0) options.push([0, -1]);
        if (node.gz < CONFIG.GRID_COUNT) options.push([0, 1]);

        const noReverse = options.filter(([dx, dz]) => !(dx === -currentDir[0] && dz === -currentDir[1]));
        const pool = noReverse.length > 0 ? noReverse : options;

        const hasStraight = pool.some(([dx, dz]) => dx === currentDir[0] && dz === currentDir[1]);
        if (hasStraight && Math.random() < 0.6) return currentDir;

        return pool[Math.floor(Math.random() * pool.length)];
    }
}
