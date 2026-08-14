// js/weather.js
// Καιρός: clear / cloudy / rain / storm / fog. Η βροχή υλοποιείται με ένα
// σύννεφο σωματιδίων (THREE.Points) που ακολουθεί τον παίκτη, η ομίχλη
// αλλάζει την απόσταση scene.fog, και ο δρόμος γίνεται πιο σκούρος/γυαλιστερός
// («βρεγμένη» εμφάνιση) όταν βρέχει.

import * as THREE from 'three';

const FOG_RANGES = {
    clear: [70, 230],
    cloudy: [55, 190],
    rain: [45, 160],
    storm: [25, 110],
    fog: [15, 90],
};

export class WeatherSystem {
    constructor(scene, ground) {
        this.scene = scene;
        this.ground = ground;
        this.groundBaseColor = ground ? ground.material.color.clone() : null;
        this.mode = 'clear';
        this.rainPoints = this.createRain();
        this.rainPoints.visible = false;
        scene.add(this.rainPoints);
    }

    createRain() {
        const count = 1800;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() * 2 - 1) * 130;
            positions[i * 3 + 1] = Math.random() * 60;
            positions[i * 3 + 2] = (Math.random() * 2 - 1) * 130;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color: 0xaeccff, size: 0.15, transparent: true, opacity: 0.55 });
        return new THREE.Points(geo, mat);
    }

    setMode(mode) {
        if (!FOG_RANGES[mode]) return;
        this.mode = mode;
        const raining = mode === 'rain' || mode === 'storm';
        this.rainPoints.visible = raining;

        const [near, far] = FOG_RANGES[mode];
        if (this.scene.fog) {
            this.scene.fog.near = near;
            this.scene.fog.far = far;
        }

        if (this.ground) {
            if (raining || mode === 'fog') {
                this.ground.material.color.copy(this.groundBaseColor).multiplyScalar(0.65);
                this.ground.material.roughness = raining ? 0.25 : 0.75; // βρεγμένος δρόμος -> πιο γυαλιστερός
            } else {
                this.ground.material.color.copy(this.groundBaseColor);
                this.ground.material.roughness = 0.95;
            }
        }
    }

    cycleNext() {
        const modes = Object.keys(FOG_RANGES);
        const idx = modes.indexOf(this.mode);
        this.setMode(modes[(idx + 1) % modes.length]);
    }

    update(delta, focusPos) {
        if (!this.rainPoints.visible) return;
        const posAttr = this.rainPoints.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            let y = posAttr.getY(i) - delta * 42;
            if (y < 0) y = 55 + Math.random() * 5;
            posAttr.setY(i, y);
        }
        posAttr.needsUpdate = true;
        this.rainPoints.position.set(focusPos.x, 0, focusPos.z);
    }
}
