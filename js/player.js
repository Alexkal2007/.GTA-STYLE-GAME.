// js/player.js
// Ο χαρακτήρας του παίκτη: 3D mesh, κίνηση με WASD (σχετική με την κάμερα),
// sprint, άλμα/βαρύτητα, και collision με τα κτίρια της πόλης.

import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Player {
    constructor(scene, buildings) {
        this.buildings = buildings;
        this.velocityY = 0;
        this.onGround = true;

        this.mesh = this.createMesh();
        this.mesh.position.set(0, 0, 0);
        scene.add(this.mesh);
    }

    createMesh() {
        const group = new THREE.Group();

        const bodyGeo = new THREE.CapsuleGeometry(CONFIG.PLAYER_RADIUS, 1.0, 4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3388ff });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.0;
        body.castShadow = true;
        group.add(body);

        const headGeo = new THREE.SphereGeometry(0.28, 12, 12);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffd9b3 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.78;
        head.castShadow = true;
        group.add(head);

        // Απλός δείκτης κατεύθυνσης (σαν "μύτη") ώστε να φαίνεται προς τα πού κοιτάζει
        const noseGeo = new THREE.ConeGeometry(0.08, 0.2, 6);
        const noseMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 1.78, 0.3);
        group.add(nose);

        return group;
    }

    update(delta, keys, cameraYaw) {
        // Κατεύθυνση κίνησης σχετική με την κάμερα (GTA-style)
        const forward = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
        const right = new THREE.Vector3(Math.sin(cameraYaw + Math.PI / 2), 0, Math.cos(cameraYaw + Math.PI / 2));

        const move = new THREE.Vector3();
        if (keys['KeyW']) move.add(forward);
        if (keys['KeyS']) move.sub(forward);
        if (keys['KeyD']) move.add(right);
        if (keys['KeyA']) move.sub(right);

        const isSprinting = keys['ShiftLeft'] || keys['ShiftRight'];
        const speed = isSprinting ? CONFIG.SPRINT_SPEED : CONFIG.WALK_SPEED;

        if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(speed * delta);

            // Ομαλή περιστροφή του χαρακτήρα προς την κατεύθυνση κίνησης
            const targetAngle = Math.atan2(move.x, move.z);
            let angleDiff = targetAngle - this.mesh.rotation.y;
            angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
            this.mesh.rotation.y += angleDiff * Math.min(1, delta * 12);
        }

        // --- Άλμα / βαρύτητα ---
        if (keys['Space'] && this.onGround) {
            this.velocityY = CONFIG.JUMP_FORCE;
            this.onGround = false;
        }
        this.velocityY -= CONFIG.GRAVITY * delta;

        let newY = this.mesh.position.y + this.velocityY * delta;
        if (newY <= 0) {
            newY = 0;
            this.velocityY = 0;
            this.onGround = true;
        }

        // --- Νέα θέση (XZ) + collision με κτίρια ---
        let newPos = this.mesh.position.clone();
        newPos.x += move.x;
        newPos.z += move.z;
        newPos.y = newY;

        newPos = this.resolveBuildingCollision(newPos);

        // Όρια πόλης
        const half = CONFIG.CITY_SIZE / 2 - 2;
        newPos.x = Math.max(-half, Math.min(half, newPos.x));
        newPos.z = Math.max(-half, Math.min(half, newPos.z));

        this.mesh.position.copy(newPos);

        // Πληροφορίες που χρειάζεται η κάμερα / minimap
        this.isSprinting = isSprinting;
        this.isMoving = move.lengthSq() > 0;
    }

    // Απλό 2D (XZ) circle-vs-box collision. Σπρώχνει τον παίκτη έξω από κάθε κτίριο
    // με το οποίο επικαλύπτεται, ώστε να μην μπορεί να περάσει μέσα από τοίχους.
    resolveBuildingCollision(pos) {
        const radius = CONFIG.PLAYER_RADIUS + 0.15;

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
            }
        }
        return pos;
    }
}
