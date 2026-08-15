// js/menu.js
// Απλό main menu (DOM overlay, όχι 3D σκηνή — ελαφρύ και αξιόπιστο). Δείχνει
// PLAY / CONTINUE (ενεργό μόνο αν υπάρχει αποθηκευμένο παιχνίδι) / CONTROLS.

export function showMainMenu({ hasSave, onPlay, onContinue }) {
    const overlay = document.createElement('div');
    overlay.id = 'main-menu';
    overlay.innerHTML = `
        <div class="menu-inner">
            <h1>METRO CITY</h1>
            <p class="menu-sub">an original open-world prototype</p>
            <button id="menu-play" class="menu-btn">PLAY</button>
            <button id="menu-continue" class="menu-btn" ${hasSave ? '' : 'disabled'}>CONTINUE</button>
            <button id="menu-controls" class="menu-btn menu-btn-secondary">CONTROLS</button>
        </div>
        <div id="menu-controls-panel" class="menu-inner" style="display:none">
            <h2>Controls</h2>
            <div class="menu-controls-list">
                <div>WASD — Κίνηση / Οδήγηση</div>
                <div>Shift — Sprint</div>
                <div>Space — Άλμα (πεζός) / Χειρόφρενο (όχημα)</div>
                <div>E — Είσοδος/Έξοδος οχήματος</div>
                <div>V — Αλλαγή καιρού</div>
                <div>Ποντίκι — Κάμερα</div>
            </div>
            <button id="menu-controls-back" class="menu-btn menu-btn-secondary">BACK</button>
        </div>
    `;
    document.body.appendChild(overlay);

    const mainPanel = overlay.querySelector('.menu-inner');
    const controlsPanel = document.getElementById('menu-controls-panel');

    document.getElementById('menu-play').addEventListener('click', () => {
        overlay.remove();
        onPlay();
    });

    document.getElementById('menu-continue').addEventListener('click', () => {
        if (!hasSave) return;
        overlay.remove();
        onContinue();
    });

    document.getElementById('menu-controls').addEventListener('click', () => {
        mainPanel.style.display = 'none';
        controlsPanel.style.display = 'flex';
    });

    document.getElementById('menu-controls-back').addEventListener('click', () => {
        controlsPanel.style.display = 'none';
        mainPanel.style.display = 'flex';
    });
}
