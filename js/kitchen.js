// ============================================
// KITCHEN DISPLAY SYSTEM
// ============================================


// ============================================
// KITCHEN DISPLAY SYSTEM - KUHINJA
// ============================================
function renderKitchen(c) {
    // Ako je kuvar sa aktivnom smenom, prikaži samo narudžbine od početka smene
    const isKuvar = DB.currentUser && DB.currentUser.role === 'kuvar';
    const myWorkday = isKuvar && DB.workdays ? DB.workdays[DB.currentUser.username] : null;
    const shiftStart = myWorkday ? myWorkday.startTime : null;
    
    let allOrders = DB.kitchenOrders;
    if (isKuvar && shiftStart) {
        allOrders = DB.kitchenOrders.filter(ko => ko.orderedAt >= shiftStart);
    }
    
    const pendingOrders = allOrders.filter(ko => ko.status === 'pending' || ko.status === 'preparing')
        .sort((a, b) => new Date(a.orderedAt) - new Date(b.orderedAt));
    const readyOrders = allOrders.filter(ko => ko.status === 'ready')
        .sort((a, b) => new Date(b.readyAt) - new Date(a.readyAt));
    
    // Statistika smene/dana
    const today = new Date().toISOString().split('T')[0];
    const completedInScope = allOrders.filter(ko => ko.status === 'completed').length;
    const readyInScope = readyOrders.length;
    const totalInScope = completedInScope + readyInScope + pendingOrders.length;
    
    // Očisti completed narudžbine starije od 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const beforeClean = DB.kitchenOrders.length;
    DB.kitchenOrders = DB.kitchenOrders.filter(ko => 
        ko.status !== 'completed' || !ko.completedAt || ko.completedAt > oneDayAgo
    );
    if (DB.kitchenOrders.length < beforeClean) {
        save();
    }
    
    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h2>🍳 Kuhinja</h2>
        <div style="font-size:14px;color:#B0B0B0">
            ${pendingOrders.length} aktivnih${isKuvar && shiftStart ? ' (ova smena)' : ''}
        </div>
    </div>`;
    
    // Statistika
    h += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div style="background:#0F3460;padding:12px;border-radius:8px;text-align:center">
            <div style="color:#FFD700;font-size:22px;font-weight:bold">${pendingOrders.length}</div>
            <div style="color:#B0B0B0;font-size:11px">Na čekanju</div>
        </div>
        <div style="background:#0F3460;padding:12px;border-radius:8px;text-align:center">
            <div style="color:#4CAF50;font-size:22px;font-weight:bold">${completedInScope + readyInScope}</div>
            <div style="color:#B0B0B0;font-size:11px">Spremljeno</div>
        </div>
        <div style="background:#0F3460;padding:12px;border-radius:8px;text-align:center">
            <div style="color:#E94560;font-size:22px;font-weight:bold">${totalInScope}</div>
            <div style="color:#B0B0B0;font-size:11px">${isKuvar && shiftStart ? 'U smeni' : 'Ukupno danas'}</div>
        </div>
    </div>`;
    
    if(pendingOrders.length === 0 && readyOrders.length === 0) {
        h += `<div class="empty">
            <div style="font-size:64px">✅</div>
            <h3>Sve narudžbine su spremne</h3>
            <p>Čekamo nove narudžbine...</p>
        </div>`;
    } else {
        // Pending i Preparing narudžbine
        if(pendingOrders.length > 0) {
            h += `<div style="margin-bottom:24px">
                <h3 style="color:#FFD700;margin-bottom:16px">⏰ U pripremi (${pendingOrders.length})</h3>
            </div>`;
            
            pendingOrders.forEach(order => {
                const timeAgo = getTimeAgo(order.orderedAt);
                const isPreparing = order.status === 'preparing';
                const totalItems = order.items.reduce((s, i) => s + i.qty, 0);
                
                h += `<div class="card" style="border:3px solid ${isPreparing ? '#FF9800' : '#E94560'};margin-bottom:16px">
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
                        <div>
                            <h3 style="color:${isPreparing ? '#FF9800' : '#E94560'};font-size:20px">
                                ${order.tableName}
                            </h3>
                            <p style="color:#B0B0B0;font-size:13px;margin-top:4px">
                                👨‍🍳 ${order.waiterName} • ⏱️ <span data-time="${order.orderedAt}">${timeAgo}</span> • ${totalItems} ${totalItems === 1 ? 'stavka' : totalItems < 5 ? 'stavke' : 'stavki'}
                            </p>
                        </div>
                        <div style="background:${isPreparing ? '#FF9800' : '#E94560'};padding:6px 12px;border-radius:8px;font-size:12px;font-weight:bold">
                            ${isPreparing ? '🔥 PRIPREMA SE' : '🆕 NOVO'}
                        </div>
                    </div>
                    
                    <div style="background:#16213E;padding:16px;border-radius:8px;margin-bottom:16px">`;
                
                order.items.forEach(item => {
                    h += `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #2A2A4A">
                        <div>
                            <span style="font-size:16px;font-weight:bold">${item.name}</span>
                        </div>
                        <div style="background:#FFD700;color:#000;padding:4px 12px;border-radius:6px;font-weight:bold">
                            ${item.qty}x
                        </div>
                    </div>`;
                });
                
                h += `</div>
                    <div style="display:flex;gap:12px">`;
                
                if(order.status === 'pending') {
                    h += `<button class="btn" style="flex:1;background:#FF9800" onclick="startPreparing('${order.id}')">
                        🔥 Počni Pripremu
                    </button>`;
                }
                
                h += `<button class="btn" style="flex:1;background:#4CAF50" onclick="markAsReady('${order.id}')">
                    ✅ Spremno!
                </button>
                    </div>
                </div>`;
            });
        }
        
        // Ready narudžbine - sa detaljima stavki
        if(readyOrders.length > 0) {
            h += `<div style="margin-top:32px">
                <h3 style="color:#4CAF50;margin-bottom:16px">✅ Spremno za servisiranje (${readyOrders.length})</h3>
            </div>`;
            
            readyOrders.forEach(order => {
                const timeAgo = getTimeAgo(order.readyAt);
                const totalItems = order.items.reduce((s, i) => s + i.qty, 0);
                
                h += `<div class="card" style="border:3px solid #4CAF50;opacity:0.7;margin-bottom:12px;cursor:pointer" onclick="toggleOrderDetails('${order.id}')">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <h3 style="color:#4CAF50">${order.tableName}</h3>
                            <p style="color:#B0B0B0;font-size:13px">
                                👨‍🍳 ${order.waiterName} • ✅ <span data-time="${order.readyAt}">${timeAgo}</span> • ${totalItems} ${totalItems === 1 ? 'stavka' : totalItems < 5 ? 'stavke' : 'stavki'}
                            </p>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px">
                            <div style="background:#4CAF50;padding:8px 16px;border-radius:8px;font-weight:bold">
                                SPREMNO
                            </div>
                            <span style="color:#B0B0B0" id="arrow_${order.id}">▼</span>
                        </div>
                    </div>
                    <div id="details_${order.id}" style="display:none;border-top:1px solid #2A2A4A;margin-top:12px;padding-top:12px">`;
                
                order.items.forEach(item => {
                    h += `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#B0B0B0;font-size:14px">
                        <span>${item.name}</span>
                        <span style="color:#FFD700;font-weight:bold">${item.qty}x</span>
                    </div>`;
                });
                
                h += `<button class="btn" style="margin-top:12px;background:#FF9800;font-size:14px" onclick="event.stopPropagation();revertToPreparing('${order.id}')">
                        ↩️ Vrati u pripremu
                    </button>`;
                
                h += `</div>
                </div>`;
            });
        }
    }
    
    c.innerHTML = h;
    
    // Auto-update vremena svaki 30 sekundi (samo na kuhinjskoj stranici)
    if (kitchenTimeInterval) clearInterval(kitchenTimeInterval);
    if (page === 'kitchen') {
        kitchenTimeInterval = setInterval(() => {
            if (page !== 'kitchen') { clearInterval(kitchenTimeInterval); return; }
            document.querySelectorAll('[data-time]').forEach(el => {
                el.textContent = getTimeAgo(el.getAttribute('data-time'));
            });
        }, 30000);
    }
}


function startPreparing(orderId) {
    const order = DB.kitchenOrders.find(ko => ko.id == orderId);
    if(order) {
        order.status = 'preparing';
        save();
        render();
    }
}


function markAsReady(orderId) {
    const order = DB.kitchenOrders.find(ko => ko.id == orderId);
    if(order) {
        order.status = 'ready';
        order.readyAt = new Date().toISOString();
        save();
        render();
        showAlert('✅ Narudžbina spremna! Konobar će dobiti obaveštenje.');
    }
}


function revertToPreparing(orderId) {
    const order = DB.kitchenOrders.find(ko => ko.id == orderId);
    if(order) {
        order.status = 'preparing';
        order.readyAt = null;
        save();
        render();
    }
}


function markOrderCompleted(orderId) {
    const order = DB.kitchenOrders.find(ko => ko.id == orderId);
    if(order) {
        order.status = 'completed';
        order.completedAt = new Date().toISOString();
        save();
        render();
    }
}


// ============================================
// KITCHEN READY PAGE - Spremne narudžbine za konobara
// ============================================
function renderKitchenReady(c) {
    const currentUsername = DB.currentUser.username;
    const myReadyOrders = DB.kitchenOrders.filter(ko => 
        ko.status === 'ready' && 
        ko.waiterUsername === currentUsername
    );
    
    let h = '<div style="max-width:800px;margin:0 auto">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">';
    h += '<button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="page=\'report\';render()">← Nazad</button>';
    h += '<h2 style="color:#4CAF50">✅ Spremne Narudžbine</h2>';
    h += '<div style="width:80px"></div></div>';
    
    if(myReadyOrders.length === 0) {
        h += '<div class="empty"><div style="font-size:64px">👍</div>';
        h += '<h3>Nema spremnih narudžbina</h3>';
        h += '<p style="color:#B0B0B0;margin-top:12px">Kada kuhinja pripremi hranu, pojaviće se ovde</p>';
        h += '</div>';
    } else {
        h += '<div style="background:#4CAF50;border-radius:12px;padding:20px;margin-bottom:20px;border:3px solid #45A049">';
        h += '<div style="text-align:center;margin-bottom:16px">';
        h += '<div style="font-size:48px;margin-bottom:8px">✅</div>';
        h += '<h3 style="color:#FFF;margin:0">HRANA SPREMNA!</h3>';
        h += '<p style="color:#FFF;opacity:0.9;margin-top:8px">';
        h += myReadyOrders.length + ' ' + (myReadyOrders.length === 1 ? 'narudžbina spremna' : 'narudžbine spremne') + ' za servisiranje';
        h += '</p></div>';
        
        myReadyOrders.forEach(function(order) {
            var timeAgo = getTimeAgo(order.readyAt);
            h += '<div style="background:rgba(255,255,255,0.2);border-radius:8px;padding:16px;margin-bottom:12px">';
            h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
            h += '<h4 style="color:#FFF;margin:0;font-size:20px">' + order.tableName + '</h4>';
            h += '<span style="color:#FFF;opacity:0.9;font-size:13px">✅ ' + timeAgo + '</span>';
            h += '</div>';
            h += '<div style="color:#FFF;opacity:0.9;font-size:15px">';
            
            order.items.forEach(function(item) {
                h += '<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.15)">' + item.qty + 'x ' + item.name + '</div>';
            });
            
            h += '</div>';
            h += '<button class="btn" style="margin-top:16px;background:#FFF;color:#4CAF50;font-size:18px" onclick="markOrderCompleted(\'' + order.id + '\')">👍 Preuzeto</button>';
            h += '</div>';
        });
        
        h += '</div>';
    }
    
    h += '</div>';
    c.innerHTML = h;
}


// ============================================
// KUVAR REPORT - Izveštaj kuvara
// ============================================
function renderKuvarReport(c) {
    const username = DB.currentUser.username;
    const myWorkday = DB.workdays && DB.workdays[username];
    const today = new Date().toISOString().split('T')[0];
    
    let h = '<div style="max-width:800px;margin:0 auto">';
    h += '<h2 style="text-align:center;margin-bottom:8px">📊 Izveštaj Kuvara</h2>';
    h += `<p style="color:#B0B0B0;text-align:center;margin-bottom:24px">${new Date().toLocaleDateString('sr-RS')}</p>`;
    
    if (!myWorkday) {
        h += `<div class="empty">
            <div style="font-size:64px">⚠️</div>
            <h3>Smena nije otvorena</h3>
            <p style="color:#B0B0B0">Odjavite se i ponovo se prijavite da otvorite smenu.</p>
        </div>`;
        h += '</div>';
        c.innerHTML = h;
        return;
    }
    
    // Izračunaj vreme smene
    const startTime = new Date(myWorkday.startTime);
    const now = new Date();
    const diffMins = Math.floor((now - startTime) / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    // Narudžbine danas — sve statuse
    const todayOrders = DB.kitchenOrders.filter(ko => 
        ko.orderedAt && ko.orderedAt.split('T')[0] === today
    );
    
    // Narudžbine tokom ove smene
    const shiftOrders = DB.kitchenOrders.filter(ko => 
        ko.orderedAt && ko.orderedAt >= myWorkday.startTime
    );
    
    const completedInShift = shiftOrders.filter(ko => ko.status === 'completed').length;
    const readyInShift = shiftOrders.filter(ko => ko.status === 'ready').length;
    const preparingInShift = shiftOrders.filter(ko => ko.status === 'pending' || ko.status === 'preparing').length;
    const totalInShift = shiftOrders.length;
    
    // Prosečno vreme pripreme (completed narudžbine sa readyAt)
    const completedWithTime = shiftOrders.filter(ko => ko.status === 'completed' && ko.readyAt && ko.orderedAt);
    let avgPrepTime = 0;
    if (completedWithTime.length > 0) {
        const totalPrepMs = completedWithTime.reduce((sum, ko) => {
            return sum + (new Date(ko.readyAt) - new Date(ko.orderedAt));
        }, 0);
        avgPrepTime = Math.floor(totalPrepMs / completedWithTime.length / 60000);
    }
    
    // Ukupan broj jela (stavki)
    const totalDishes = shiftOrders.reduce((sum, ko) => {
        return sum + ko.items.reduce((s, item) => s + item.qty, 0);
    }, 0);
    
    const completedDishes = shiftOrders.filter(ko => ko.status === 'completed' || ko.status === 'ready')
        .reduce((sum, ko) => sum + ko.items.reduce((s, item) => s + item.qty, 0), 0);
    
    // Stat kartice
    h += `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px">
        <div class="stat-card" style="border-left:4px solid #FF9800">
            <div class="stat-label">⏱️ Vreme smene</div>
            <div class="stat-value" style="color:#FF9800">${hours}h ${mins}m</div>
            <div class="stat-label">od ${startTime.toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'})}</div>
        </div>
        <div class="stat-card" style="border-left:4px solid #E94560">
            <div class="stat-label">📋 Narudžbine u smeni</div>
            <div class="stat-value" style="color:#E94560">${totalInShift}</div>
            <div class="stat-label">${totalDishes} jela ukupno</div>
        </div>
        <div class="stat-card" style="border-left:4px solid #4CAF50">
            <div class="stat-label">✅ Završeno</div>
            <div class="stat-value" style="color:#4CAF50">${completedInShift + readyInShift}</div>
            <div class="stat-label">${completedDishes} jela</div>
        </div>
        <div class="stat-card" style="border-left:4px solid #FFD700">
            <div class="stat-label">🔥 Na čekanju</div>
            <div class="stat-value" style="color:#FFD700">${preparingInShift}</div>
            <div class="stat-label">${avgPrepTime > 0 ? 'Prosek: ~' + avgPrepTime + ' min' : 'Nema podataka'}</div>
        </div>
    </div>`;
    
    // Progress bar — koliko % je završeno
    const progressPercent = totalInShift > 0 ? Math.round((completedInShift + readyInShift) / totalInShift * 100) : 0;
    h += `<div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
            <span style="color:#B0B0B0">Procenat završenih</span>
            <span style="color:#FFD700;font-weight:bold">${progressPercent}%</span>
        </div>
        <div style="background:#16213E;border-radius:8px;height:16px;overflow:hidden">
            <div style="background:linear-gradient(90deg,#4CAF50,#8BC34A);height:100%;width:${progressPercent}%;border-radius:8px;transition:width 0.5s"></div>
        </div>
    </div>`;
    
    // Lista narudžbina u smeni
    if (shiftOrders.length > 0) {
        h += `<div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#FFD700;margin-bottom:16px">📋 Narudžbine u Smeni</h3>`;
        
        const sortedOrders = [...shiftOrders].sort((a, b) => new Date(b.orderedAt) - new Date(a.orderedAt));
        
        sortedOrders.forEach(order => {
            const timeAgo = getTimeAgo(order.orderedAt);
            const totalItems = order.items.reduce((s, i) => s + i.qty, 0);
            let statusIcon = '🆕';
            let statusColor = '#E94560';
            let statusText = 'Čeka';
            
            if (order.status === 'preparing') { statusIcon = '🔥'; statusColor = '#FF9800'; statusText = 'Priprema'; }
            else if (order.status === 'ready') { statusIcon = '✅'; statusColor = '#4CAF50'; statusText = 'Spremno'; }
            else if (order.status === 'completed') { statusIcon = '👍'; statusColor = '#8BC34A'; statusText = 'Preuzeto'; }
            
            h += `<div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px;border-left:4px solid ${statusColor}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <span style="font-weight:bold">${order.tableName}</span>
                        <span style="color:#B0B0B0;font-size:12px;margin-left:8px">${order.items.map(i => i.qty + 'x ' + i.name).join(', ')}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="color:#B0B0B0;font-size:12px">${timeAgo}</span>
                        <span style="background:${statusColor};padding:4px 10px;border-radius:6px;font-size:12px;font-weight:bold">${statusIcon} ${statusText}</span>
                    </div>
                </div>
            </div>`;
        });
        
        h += `</div>`;
    }
    
    // Istorija prethodnih smena
    const kuvarHistory = (DB.workdayHistory || []).filter(s => s.user === username && s.role === 'kuvar').reverse();
    if (kuvarHistory.length > 0) {
        h += `<div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#9C27B0;margin-bottom:16px">🕐 Prethodne Smene (${kuvarHistory.length})</h3>`;
        
        kuvarHistory.slice(0, 10).forEach(session => {
            const loginDate = new Date(session.loginTime);
            const logoutDate = new Date(session.logoutTime);
            const date = loginDate.toLocaleDateString('sr-RS');
            const loginTime = loginDate.toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'});
            const logoutTime = logoutDate.toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'});
            const sHours = Math.floor(session.duration / 60);
            const sMins = session.duration % 60;
            
            h += `<div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div style="color:#FFD700;font-weight:bold">${date}</div>
                        <div style="color:#B0B0B0;font-size:12px">
                            🔓 ${loginTime} → 🔒 ${logoutTime} · ${sHours}h ${sMins}min
                        </div>
                    </div>
                    <div style="text-align:right">
                        <div style="color:#E94560;font-weight:bold">${session.ordersProcessed || 0} narudžbina</div>
                        <div style="color:#B0B0B0;font-size:12px">${session.dishesCompleted || 0} jela</div>
                    </div>
                </div>
            </div>`;
        });
        
        h += `</div>`;
    }
    
    h += '</div>';
    c.innerHTML = h;
}


function closeKuvarWorkday() {
    const username = DB.currentUser.username;
    const myWorkday = DB.workdays && DB.workdays[username];
    
    if (!myWorkday) {
        showAlert('❌ Nema aktivne smene!');
        return;
    }
    
    showConfirm('🍳 Zatvori Smenu', 'Da li želite da zatvorite smenu?', (confirmed) => {
        if (!confirmed) return;
        
        const endTime = new Date().toISOString();
        const startTime = new Date(myWorkday.startTime);
        const duration = Math.floor((new Date(endTime) - startTime) / 1000 / 60);
        
        // Narudžbine tokom smene
        const shiftOrders = DB.kitchenOrders.filter(ko => 
            ko.orderedAt && ko.orderedAt >= myWorkday.startTime
        );
        
        const completedCount = shiftOrders.filter(ko => ko.status === 'completed' || ko.status === 'ready').length;
        const totalDishes = shiftOrders.filter(ko => ko.status === 'completed' || ko.status === 'ready')
            .reduce((sum, ko) => sum + ko.items.reduce((s, i) => s + i.qty, 0), 0);
        
        // Sačuvaj u istoriju
        if (!DB.workdayHistory) DB.workdayHistory = [];
        
        DB.workdayHistory.push({
            user: username,
            role: 'kuvar',
            loginTime: myWorkday.startTime,
            logoutTime: endTime,
            duration: duration,
            ordersProcessed: completedCount,
            totalOrders: shiftOrders.length,
            dishesCompleted: totalDishes
        });
        
        // Obriši workday
        delete DB.workdays[username];
        save();
        
        // Prikaži rezime
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;
        showAlert(`✅ Smena zatvorena!\n\n⏱️ Trajanje: ${hours}h ${mins}min\n📋 Narudžbine: ${completedCount}\n🍽️ Jela: ${totalDishes}`);
        
        page = 'kitchen';
        render();
    });
}

