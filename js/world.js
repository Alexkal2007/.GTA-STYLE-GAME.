// js/world.js
// Δημιουργεί τα βασικά στοιχεία περιβάλλοντος: ουρανό, φωτισμό, γενικό έδαφος (άσφαλτος).
// Οι δρόμοι/πεζοδρόμια/κτίρια φτιάχνονται στο city.js πάνω σε αυτό το έδαφος.

import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createWorld(scene) {
    // --- Sky / background ---
    scene.background = new THREE.Color(0x8fc7ff);
    scene.fog = new THREE.Fog(0x8fc7ff, 70, 230);

    // --- Ambient light (γενικός φωτισμός ημέρας) ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    // --- Ήλιος (directional light με σκιές) ---
    const sun = new THREE.DirectionalLight(0xfff4da, 1.15);
    sun.position.set(90, 130, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 350;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    scene.add(sun.target);

    // Ήπιο fill light από την αντίθετη πλευρά για να μη μένουν οι σκιές τελείως μαύρες
    const fill = new THREE.HemisphereLight(0xbfd9ff, 0x3a3a3a, 0.4);
    scene.add(fill);

    // --- Έδαφος / βασικός δρόμος (μεγάλο επίπεδο, καλύπτει όλη την πόλη) ---
    const groundGeo = new THREE.PlaneGeometry(CONFIG.CITY_SIZE + 80, CONFIG.CITY_SIZE + 80);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    return { sun, ambient, ground };
}
