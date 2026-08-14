// js/textures.js
// Procedural (canvas-based) textures ώστε τα κτίρια και τα οχήματα να μην
// είναι μονόχρωμοι κύβοι: ένα επαναλαμβανόμενο μοτίβο παραθύρων, και
// πινακίδες επιχειρήσεων με κείμενο.

import * as THREE from 'three';

let baseWindowCanvas = null;

function getBaseWindowCanvas() {
    if (baseWindowCanvas) return baseWindowCanvas;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(0, 0, 64, 64);

    const cols = 4;
    const rows = 4;
    const padding = 3;
    const cw = 64 / cols;
    const rh = 64 / rows;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const lit = Math.random() > 0.55;
            ctx.fillStyle = lit ? '#ffe9a8' : '#3d4652';
            ctx.fillRect(c * cw + padding, r * rh + padding, cw - padding * 2, rh - padding * 2);
        }
    }

    baseWindowCanvas = canvas;
    return canvas;
}

// Επιστρέφει ένα ΝΕΟ material με το μοτίβο παραθύρων, με δικό του repeat
// ανάλογα με τις διαστάσεις του κτιρίου (κάθε κτίριο έχει το δικό του
// texture instance ώστε το repeat να μην συγκρούεται μεταξύ κτιρίων).
export function makeWindowMaterial(baseColor, repeatX, repeatY) {
    const tex = new THREE.CanvasTexture(getBaseWindowCanvas());
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(repeatX)), Math.max(1, Math.round(repeatY)));
    return new THREE.MeshStandardMaterial({
        color: baseColor,
        map: tex,
        roughness: 0.75,
        metalness: 0.1,
    });
}

const signCache = new Map();

// Πινακίδα επιχείρησης με κείμενο (cached ανά κείμενο+χρώμα ώστε να μην
// ξαναδημιουργείται το ίδιο canvas για κάθε κτίριο).
export function getSignTexture(text, bgColor = '#d0342c', textColor = '#ffffff') {
    const key = text + '|' + bgColor + '|' + textColor;
    if (signCache.has(key)) return signCache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 60);

    ctx.fillStyle = textColor;
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 34);

    const tex = new THREE.CanvasTexture(canvas);
    signCache.set(key, tex);
    return tex;
}
