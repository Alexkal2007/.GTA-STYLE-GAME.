// js/sun.js
// Πλήρης κύκλος ημέρας/νύχτας: ο ήλιος κινείται στον ουρανό, ο ουρανός/η
// ομίχλη αλλάζουν χρώμα (νύχτα -> ανατολή -> μέρα -> δύση -> νύχτα), και τα
// φανάρια δρόμου / πινακίδες ενεργοποιούνται αυτόματα το βράδυ.

import * as THREE from 'three';
import { CONFIG } from './config.js';

const SKY_NIGHT = new THREE.Color(0x0a0e2a);
const SKY_SUNRISE = new THREE.Color(0xff9e6b);
const SKY_DAY = new THREE.Color(0x8fc7ff);

export class DayNightCycle {
    constructor(scene, sun, ambient, streetLightMats) {
        this.scene = scene;
        this.sun = sun;
        this.ambient = ambient;
        this.streetLightMats = streetLightMats || [];
        this.time = 8; // ώρα (0-24), ξεκινάει πρωί
        this.isNight = false;
    }

    update(delta) {
        this.time += (24 / CONFIG.DAY_LENGTH_SECONDS) * delta;
        if (this.time >= 24) this.time -= 24;

        const angle = ((this.time - 6) / 24) * Math.PI * 2; // ανατολή στις 06:00
        const sunHeight = Math.sin(angle);

        this.sun.position.set(Math.cos(angle) * 150, Math.max(sunHeight, -0.1) * 150 + 25, 60);
        this.sun.target.position.set(0, 0, 0);

        const dayFactor = THREE.MathUtils.clamp(sunHeight + 0.15, 0, 1);
        this.sun.intensity = 0.25 + dayFactor * 1.0;
        this.ambient.intensity = 0.12 + dayFactor * 0.5;

        let color;
        if (sunHeight < -0.15) {
            color = SKY_NIGHT.clone();
        } else if (sunHeight < 0.2) {
            const t = THREE.MathUtils.clamp((sunHeight + 0.15) / 0.35, 0, 1);
            color = SKY_NIGHT.clone().lerp(SKY_SUNRISE, t);
        } else {
            const t = THREE.MathUtils.clamp((sunHeight - 0.2) / 0.35, 0, 1);
            color = SKY_SUNRISE.clone().lerp(SKY_DAY, t);
        }
        this.scene.background = color;
        if (this.scene.fog) this.scene.fog.color = color;

        this.isNight = sunHeight < -0.05;
        const targetGlow = this.isNight ? 1 : 0.12;
        for (const mat of this.streetLightMats) {
            mat.emissiveIntensity = targetGlow;
        }
    }

    getClockString() {
        const h = Math.floor(this.time);
        const m = Math.floor((this.time - h) * 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
}
