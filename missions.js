// js/missions.js
// Απλό σύστημα αποστολών: δείκτης (κίτρινος φωτεινός δακτύλιος) σε έναν
// στόχο στον χάρτη, με τίτλο/περιγραφή/στόχο/αμοιβή. Καλύπτει delivery,
// pickup, και time-challenge τύπους. Chase/escape/follow missions ΔΕΝ
// υλοποιούνται σε αυτό το pass.

import * as THREE from 'three';
import { CONFIG } from './config.js';

const MISSION_DEFS = [
    { id: 'delivery1', title: 'Delivery Run', description: 'Drive to the drop-off point across town.', type: 'delivery', reward: 250 },
    { id: 'pickup1', title: 'Pickup Job', description: 'Walk to the pickup point on foot.', type: 'pickup', reward: 150 },
    { id: 'time1', title: 'Time Challenge', description: 'Reach the checkpoint before the timer runs out.', type: 'time', timeLimit: 45, reward: 400 },
    { id: 'delivery2', title: 'Cross-Town Delivery', description: 'Another delivery — this one is further away.', type: 'delivery', reward: 350 },
    { id: 'pickup2', title: 'Late Pickup', description: 'One more pickup job on foot.', type: 'pickup', reward: 200 },
];

export class MissionSystem {
    constructor(scene) {
        this.scene = scene;
        this.money = 0;
        this.activeIndex = -1;
        this.marker = null;
        this.timeRemaining = 0;
        this.status = 'active';
        this.def = null;
        this.currentTarget = new THREE.Vector3();
        this.startNext();
    }

    startNext() {
        this.activeIndex++;
        if (this.activeIndex >= MISSION_DEFS.length) {
            this.status = 'done';
            this.def = null;
            this.removeMarker();
            return;
        }
        this.def = MISSION_DEFS[this.activeIndex];
        const half = CONFIG.CITY_SIZE / 2 - 25;
        this.currentTarget.set((Math.random() * 2 - 1) * half, 0, (Math.random() * 2 - 1) * half);
        this.timeRemaining = this.def.timeLimit || 0;
        this.status = 'active';
        this.spawnMarker();
    }

    spawnMarker() {
        this.removeMarker();
        const group = new THREE.Group();

        const ringGeo = new THREE.TorusGeometry(2, 0.15, 8, 24);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xffd93b, emissive: 0xffd93b, emissiveIntensity: 0.9 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.35;
        group.add(ring);

        const beamGeo = new THREE.CylinderGeometry(0.12, 0.12, 22, 8);
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd93b, transparent: true, opacity: 0.3 });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = 11;
        group.add(beam);

        group.position.copy(this.currentTarget);
        this.marker = group;
        this.scene.add(group);
    }

    removeMarker() {
        if (this.marker) {
            this.scene.remove(this.marker);
            this.marker = null;
        }
    }

    update(delta, playerPos, vehiclePos) {
        if (this.status !== 'active' || !this.def) return;
        if (this.marker) this.marker.rotation.y += delta * 1.2;

        const usePos = this.def.type === 'pickup' ? playerPos : (vehiclePos || playerPos);
        const dx = usePos.x - this.currentTarget.x;
        const dz = usePos.z - this.currentTarget.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (this.def.timeLimit) {
            this.timeRemaining -= delta;
            if (this.timeRemaining <= 0) {
                this.status = 'failed';
                this.removeMarker();
                return;
            }
        }

        if (dist < 4) {
            this.money += this.def.reward;
            this.status = 'success';
            this.removeMarker();
        }
    }
}
