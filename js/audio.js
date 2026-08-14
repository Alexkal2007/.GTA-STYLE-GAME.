// js/audio.js
// Ελαφρύ ηχητικό σύστημα με Web Audio API — δεν φορτώνει εξωτερικά αρχεία
// ήχου (δεν υπάρχουν διαθέσιμα assets), αντ' αυτού συνθέτει: engine hum
// που αλλάζει με την ταχύτητα, σειρήνα αστυνομίας, και ένα αχνό ambient
// "βουητό πόλης". Πρέπει να καλεστεί init() μετά από user gesture (click),
// λόγω περιορισμών των browsers στο autoplay.

export class AudioSystem {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (this.ctx) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();

        // --- Engine ---
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.frequency.value = 55;
        this.engineOsc.connect(this.engineGain).connect(this.ctx.destination);
        this.engineOsc.start();

        // --- Siren ---
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.frequency.value = 650;
        this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
        this.sirenOsc.start();

        // --- Ambient city drone (φιλτραρισμένος θόρυβος) ---
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 350;
        const ambientGain = this.ctx.createGain();
        ambientGain.gain.value = 0.025;
        noise.connect(filter).connect(ambientGain).connect(this.ctx.destination);
        noise.start();
    }

    updateEngine(isDriving, speedRatio) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const targetGain = isDriving ? 0.07 + speedRatio * 0.07 : 0;
        this.engineGain.gain.linearRampToValueAtTime(targetGain, now + 0.15);
        this.engineOsc.frequency.linearRampToValueAtTime(45 + speedRatio * 170, now + 0.15);
    }

    updateSiren(active, elapsedTime) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        if (active) {
            const wobble = Math.sin(elapsedTime * 6) > 0 ? 720 : 500;
            this.sirenOsc.frequency.setValueAtTime(wobble, now);
            this.sirenGain.gain.linearRampToValueAtTime(0.045, now + 0.1);
        } else {
            this.sirenGain.gain.linearRampToValueAtTime(0, now + 0.3);
        }
    }
}
