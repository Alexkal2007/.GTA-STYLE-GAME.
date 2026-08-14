// js/minimap.js
// Static north-up minimap. Ο "χάρτης βάσης" (κτίρια/πάρκα/ονόματα
// συνοικιών/σημαντικές επιχειρήσεις) ζωγραφίζεται ΜΙΑ φορά σε offscreen
// canvas για performance· κάθε frame προστίθεται μόνο η θέση του παίκτη
// (ή του οχήματος όταν οδηγεί) και των NPC/traffic από πάνω.

import { CONFIG } from './config.js';

export class Minimap {
    constructor(canvas, city) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.size = canvas.width;
        this.scale = this.size / CONFIG.CITY_SIZE;

        this.base = document.createElement('canvas');
        this.base.width = this.size;
        this.base.height = this.size;
        this.drawBase(city);
    }

    worldToMap(x, z) {
        return { x: this.size / 2 + x * this.scale, y: this.size / 2 + z * this.scale };
    }

    drawBase(city) {
        const bctx = this.base.getContext('2d');
        bctx.fillStyle = '#242424';
        bctx.fillRect(0, 0, this.size, this.size);

        for (const lot of city.lots) {
            const p = this.worldToMap(lot.x, lot.z);
            const s = Math.max(1, lot.size * this.scale * 0.85);
            let color = '#767676';
            if (lot.type === 'park') color = '#3f7d3f';
            else if (lot.district === 'beach') color = '#d8c48a';
            else if (lot.district === 'airport') color = '#5c5c5c';
            bctx.fillStyle = color;
            bctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        }

        // Landmarks (σημαντικές επιχειρήσεις/σημεία ενδιαφέροντος)
        bctx.font = '7px Arial';
        bctx.fillStyle = '#ffd93b';
        for (const lm of city.landmarks || []) {
            const p = this.worldToMap(lm.x, lm.z);
            bctx.beginPath();
            bctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
            bctx.fill();
        }

        // Ονόματα συνοικιών
        bctx.font = 'bold 8px Arial';
        bctx.fillStyle = 'rgba(255,255,255,0.85)';
        bctx.textAlign = 'center';
        for (const d of city.districtLabels || []) {
            const p = this.worldToMap(d.x, d.z);
            bctx.fillText(d.name, p.x, p.y);
        }
    }

    update(playerLikeTarget, npcs, trafficCars, policeCars, missionTarget) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.size, this.size);
        ctx.drawImage(this.base, 0, 0);

        // Πεζοί
        ctx.fillStyle = '#f2d94e';
        for (const npc of npcs) {
            const p = this.worldToMap(npc.mesh.position.x, npc.mesh.position.z);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Traffic
        ctx.fillStyle = '#8ecbff';
        for (const c of trafficCars) {
            const p = this.worldToMap(c.vehicle.mesh.position.x, c.vehicle.mesh.position.z);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Αστυνομία (μπλε δείκτης· κόκκινο όταν καταδιώκει)
        if (policeCars) {
            for (const c of policeCars) {
                const p = this.worldToMap(c.vehicle.mesh.position.x, c.vehicle.mesh.position.z);
                ctx.fillStyle = c.mode === 'chase' ? '#ff3b3b' : '#3b6bff';
                ctx.beginPath();
                ctx.arc(p.x, p.y, c.mode === 'chase' ? 2.4 : 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Δείκτης ενεργής αποστολής
        if (missionTarget) {
            const p = this.worldToMap(missionTarget.x, missionTarget.z);
            ctx.fillStyle = '#ffd93b';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - 4);
            ctx.lineTo(p.x + 4, p.y + 3);
            ctx.lineTo(p.x - 4, p.y + 3);
            ctx.closePath();
            ctx.fill();
        }

        // Player / vehicle marker
        const pos = playerLikeTarget.mesh.position;
        const pp = this.worldToMap(pos.x, pos.z);
        ctx.save();
        ctx.translate(pp.x, pp.y);
        ctx.rotate(playerLikeTarget.mesh.rotation.y);
        ctx.fillStyle = '#ff3b3b';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 5);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, this.size - 2, this.size - 2);
    }
}
