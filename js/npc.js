// js/npc.js
// Πεζοί: περιφέρονται ΜΟΝΟ μέσα σε lots (πεζοδρόμια/blocks — ποτέ πάνω
// στο άσφαλτο, αφού οι στόχοι τους επιλέγονται πάντα μέσα σε ένα lot),
// κάνουν μικρές παύσεις όταν φτάνουν κάπου (σαν να στέκονται/μιλάνε), και
// περιστασιακά «διασχίζουν» προς γειτονικό block.

import * as THREE from 'three';
import { CONFIG } from './config.js';

export class NPCManager {
    constructor(scene, buildings, lots) {
        this.scene = scene;
        this.buildings = buildings;
        this.lots = lots.filter((l) => l.type !== 'special' || true); // όλα τα lots είναι βατά
        this.npcs = [];

        for (let i = 0; i < CONFIG.NPC_COUNT; i++) {
            this.npcs.push(this.createNPC());
        }
    }

    randomPointInLot(lot) {
        const margin = 2;
        const half = lot.size / 2 - margin;
        return new THREE.Vector3(
            lot.x + (Math.random() * 2 - 1) * half,
            0,
            lot.z + (Math.random() * 2 - 1) * half
        );
    }

    pickTarget(fromLot) {
        // Μικρή πιθανότητα να στοχεύσει σε ΓΕΙΤΟΝΙΚΟ lot (προσομοιώνει
        // διάσχιση δρόμου), αλλιώς μένει στο ίδιο block.
        if (Math.random() < CONFIG.PED_CROSS_CHANCE) {
            const candidates = this.lots.filter((l) => {
                const dx = Math.abs(l.x - fromLot.x);
                const dz = Math.abs(l.z - fromLot.z);
                return (dx < CONFIG.CELL_SIZE * 1.1 && dz < 1) || (dz < CONFIG.CELL_SIZE * 1.1 && dx < 1);
            });
            if (candidates.length > 0) {
                const lot = candidates[Math.floor(Math.random() * candidates.length)];
                return { lot, point: this.randomPointInLot(lot) };
            }
        }
        return { lot: fromLot, point: this.randomPointInLot(fromLot) };
    }

    createNPC() {
        const colors = [0xff6b6b, 0x6bff8f, 0xffe66b, 0x6bc7ff, 0xd66bff, 0xffa94d];
        const color = colors[Math.floor(Math.random() * colors.length)];

        const group = new THREE.Group();
        const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.9, 4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.85;
        body.castShadow = true;
        group.add(body);

        const headGeo = new THREE.SphereGeometry(0.22, 10, 10);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffd9b3 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.5;
        head.castShadow = true;
        group.add(head);

        const startLot = this.lots[Math.floor(Math.random() * this.lots.length)];
        const startPos = this.randomPointInLot(startLot);
        group.position.copy(startPos);
        this.scene.add(group);

        return {
            mesh: group,
            lot: startLot,
            target: this.randomPointInLot(startLot),
            speed: 0.9 + Math.random() * 0.8,
            idleTimer: Math.random() * 2,
        };
    }

    update(delta) {
        for (const npc of this.npcs) {
            if (npc.idleTimer > 0) {
                npc.idleTimer -= delta;
                continue;
            }

            const dir = npc.target.clone().sub(npc.mesh.position);
            dir.y = 0;
            const dist = dir.length();

            if (dist < 1) {
                const next = this.pickTarget(npc.lot);
                npc.lot = next.lot;
                npc.target = next.point;
                npc.idleTimer = CONFIG.PED_IDLE_MIN + Math.random() * (CONFIG.PED_IDLE_MAX - CONFIG.PED_IDLE_MIN);
                continue;
            }

            dir.normalize();
            const nextX = npc.mesh.position.x + dir.x * npc.speed * delta;
            const nextZ = npc.mesh.position.z + dir.z * npc.speed * delta;

            if (this.isInsideAnyBuilding(nextX, nextZ)) {
                const next = this.pickTarget(npc.lot);
                npc.lot = next.lot;
                npc.target = next.point;
                continue;
            }

            npc.mesh.position.x = nextX;
            npc.mesh.position.z = nextZ;
            npc.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
    }

    isInsideAnyBuilding(x, z) {
        for (const b of this.buildings) {
            const box = b.box;
            if (x > box.min.x && x < box.max.x && z > box.min.z && z < box.max.z) return true;
        }
        return false;
    }
}
