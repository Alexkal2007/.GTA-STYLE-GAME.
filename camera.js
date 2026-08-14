// js/camera.js
// Third-person κάμερα σε στυλ open-world action game: περιστρέφεται με το
// ποντίκι γύρω από τον στόχο (target), τον ακολουθεί ομαλά, και αποφεύγει
// να μπαίνει μέσα σε κτίρια με raycast. Ο "target" μπορεί να είναι είτε ο
// Player (πεζός) είτε ένα Vehicle (όταν ο παίκτης οδηγεί) — και τα δύο
// εκθέτουν ένα .mesh, οπότε η κάμερα δουλεύει και στις δύο περιπτώσεις.

import * as THREE from 'three';

export class ThirdPersonCamera {
    constructor(camera, target, buildings, domElement) {
        this.camera = camera;
        this.target = target;
        this.buildings = buildings;
        this.domElement = domElement;

        this.yaw = 0;
        this.pitch = 0.28;
        this.minPitch = -0.15;
        this.maxPitch = 1.1;
        this.distance = 7;
        this.mouseSensitivity = 0.0025;

        this._raycaster = new THREE.Raycaster();
        this._currentCamPos = new THREE.Vector3(0, 3, -this.distance);

        this.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    }

    // Καλείται όταν ο παίκτης μπαίνει/βγαίνει από όχημα.
    setTarget(newTarget, distance) {
        this.target = newTarget;
        this.distance = distance;
    }

    onMouseMove(e) {
        if (document.pointerLockElement !== this.domElement) return;
        this.yaw -= e.movementX * this.mouseSensitivity;
        this.pitch -= e.movementY * this.mouseSensitivity;
        this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    }

    update(delta) {
        const targetPos = this.target.mesh.position.clone();
        targetPos.y += 1.5;

        const offset = new THREE.Vector3(
            Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            Math.cos(this.yaw) * Math.cos(this.pitch)
        ).multiplyScalar(this.distance);

        let desired = targetPos.clone().add(offset);

        const dir = desired.clone().sub(targetPos);
        const maxDist = dir.length();
        dir.normalize();

        this._raycaster.set(targetPos, dir);
        this._raycaster.far = maxDist;
        const meshes = this.buildings.map((b) => b.mesh);
        const hits = this._raycaster.intersectObjects(meshes, false);

        let finalDist = maxDist;
        if (hits.length > 0) finalDist = Math.max(1.5, hits[0].distance * 0.9);
        desired = targetPos.clone().add(dir.multiplyScalar(finalDist));

        if (desired.y < 0.5) desired.y = 0.5;

        const smoothing = 1 - Math.pow(0.0005, delta);
        this._currentCamPos.lerp(desired, smoothing);

        this.camera.position.copy(this._currentCamPos);
        this.camera.lookAt(targetPos);
    }
}
