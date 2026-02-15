// ============================================
// UTILITY FUNCTIONS
// ============================================


// Zvučno obaveštenje za kuhinju (Web Audio API)
function playKitchenSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Tri kratka beep-a
        [0, 0.2, 0.4].forEach(delay => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.value = 0.3;
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.15);
        });
        // Vibracija ako je podržana
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
    } catch(e) {}
}


function showConfirm(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = callback;
    document.getElementById('confirmModal').classList.add('show');
}


function closeConfirmModal(confirmed) {
    document.getElementById('confirmModal').classList.remove('show');
    if(confirmCallback) {
        confirmCallback(confirmed);
        confirmCallback = null;
    }
}


function showAlert(message) {
    showConfirm('⚠️ Obaveštenje', message, () => {});
}


function getTimeAgo(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    
    if(diffMins < 1) return 'Upravo sada';
    if(diffMins === 1) return '1 minut';
    if(diffMins < 60) return `${diffMins} minuta`;
    
    const diffHours = Math.floor(diffMins / 60);
    if(diffHours === 1) return '1 sat';
    return `${diffHours} sati`;
}

