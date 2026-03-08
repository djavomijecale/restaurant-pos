// ============================================
// APP INITIALIZATION
// ============================================


// ============================================
// INITIALIZATION
// ============================================
async function initApp() {
    console.log('🚀 Starting Restaurant POS with Firebase...');
    
    // IMPORTANT: Clear old localStorage workday to prevent conflicts
    localStorage.removeItem('workday');
    console.log('🧹 Cleared old workday from localStorage');
    
    // Show loading
    document.getElementById('content').innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh">
            <div style="font-size:64px;margin-bottom:20px">🔄</div>
            <h2 style="color:#E94560">Učitavanje...</h2>
            <p style="color:#B0B0B0">Povezivanje sa Firebase serverom...</p>
        </div>
    `;
    
    try {
        // Load data from Firebase
        await loadFromFirebase();
        
        // ⏰ Auto-zatvori smene starije od 14h
        checkAndAutoCloseShifts();
        
        // Set initial page
        if(DB.currentUser) {
            if(DB.currentUser.role === 'kuvar') {
                page = 'kitchen';
            } else {
                const hasWorkday = DB.workdays && DB.workdays[DB.currentUser.username];
                if((DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter') && !hasWorkday) {
                    page = 'workday';
                } else {
                    page = 'tables';
                }
            }
        } else {
            page = 'login';
        }
        
        // Start auto-refresh
        startAutoRefresh();
        
        // 📍 Start geo tracking ako je aktivno
        if (typeof startGeoTracking === 'function') {
            startGeoTracking();
        }
        
        // ⏰ Start shift reminders
        if (typeof startShiftReminders === 'function') {
            startShiftReminders();
        }
        
        // Initial render
        render();
        
        console.log('✅ Restaurant POS ready!');
        
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        document.getElementById('content').innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:20px">
                <div style="font-size:64px;margin-bottom:20px">❌</div>
                <h2 style="color:#E94560">Greška povezivanja</h2>
                <p style="color:#B0B0B0;text-align:center;max-width:500px;line-height:1.6">
                    Nije moguće povezati se sa Firebase serverom.<br><br>
                    Proverite internet konekciju i pokušajte ponovo.
                </p>
                <p style="color:#B0B0B0;font-size:12px;margin-top:8px">${error.message}</p>
                <button class="btn" onclick="initApp()" style="max-width:300px;margin-top:20px">🔄 Pokušaj ponovo</button>
            </div>
        `;
    }
}


// Start app when page loads
initApp();
