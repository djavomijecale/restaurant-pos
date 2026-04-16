// ============================================
// QR GUEST ORDERS - Narudžbine od gostiju
// ============================================

function renderGuestOrders(c) {
    const pending = (DB.guestOrders || []).filter(o => o.status === 'pending');
    const confirmed = (DB.guestOrders || []).filter(o => o.status === 'confirmed');
    const rejected = (DB.guestOrders || []).filter(o => o.status === 'rejected');
    const pendingCalls = (DB.waiterCalls || []).filter(wc => wc.status === 'pending');
    
    let html = `<h2>📱 QR Narudžbine</h2>`;
    
    // Pozivi konobara
    if (pendingCalls.length > 0) {
        html += `<div style="background:linear-gradient(135deg,#FF9800 0%,#F57C00 100%);padding:16px;border-radius:12px;margin:12px 0;animation:callPulse 1.5s ease-in-out infinite">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                <span style="font-size:28px">🔔</span>
                <div>
                    <div style="font-weight:bold;font-size:16px">Poziv Konobara!</div>
                    <div style="opacity:0.85;font-size:13px">${pendingCalls.length} ${pendingCalls.length === 1 ? 'gost traži' : 'gostiju traže'} konobara</div>
                </div>
            </div>`;
        
        pendingCalls.forEach(call => {
            const time = new Date(call.createdAt);
            const ago = Math.floor((Date.now() - time.getTime()) / 60000);
            const agoStr = ago < 1 ? 'upravo' : ago + ' min';
            
            html += `<div style="background:rgba(0,0,0,0.2);padding:10px 14px;border-radius:8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
                <div>
                    <span style="font-weight:bold">👤 ${call.guestName || 'Gost'}</span>
                    <span style="opacity:0.7;font-size:12px;margin-left:8px">· ${agoStr}</span>
                </div>
                <button onclick="dismissWaiterCall('${call.id}')" style="background:rgba(0,0,0,0.3);color:#FFF;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold">✓ OK</button>
            </div>`;
        });
        
        if (pendingCalls.length > 1) {
            html += `<button onclick="dismissAllWaiterCalls()" style="background:rgba(0,0,0,0.3);color:#FFF;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold;width:100%;margin-top:6px">✓ Sve pregledano</button>`;
        }
        
        html += `</div>
        <style>@keyframes callPulse { 0%,100% { box-shadow:0 0 0 0 rgba(255,152,0,0.4); } 50% { box-shadow:0 0 20px 4px rgba(255,152,0,0.2); } }</style>`;
    }
    
    html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0">
            <div class="stat-card" style="border-left:4px solid #FF9800">
                <div class="stat-label">⏳ Čeka</div>
                <div class="stat-value" style="color:#FF9800">${pending.length}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #4CAF50">
                <div class="stat-label">✅ Potvrđeno</div>
                <div class="stat-value" style="color:#4CAF50">${confirmed.length}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #E94560">
                <div class="stat-label">❌ Odbijeno</div>
                <div class="stat-value" style="color:#E94560">${rejected.length}</div>
            </div>
        </div>`;
    
    if (pending.length > 0) {
        html += `<h3 style="color:#FF9800;margin:20px 0 12px">⏳ Čekaju Potvrdu (${pending.length})</h3>`;
        pending.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        pending.forEach(order => {
            html += renderGuestOrderCard(order, true);
        });
    } else {
        html += `<div style="text-align:center;padding:30px;color:#B0B0B0">
            <p style="font-size:40px;margin-bottom:12px">📱</p>
            <p>Nema novih QR narudžbina</p>
            <p style="font-size:13px;margin-top:8px">Gosti skeniraju QR kod da naruče</p>
        </div>`;
    }
    
    if (confirmed.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const todayConfirmed = confirmed.filter(o => o.confirmedAt && o.confirmedAt.startsWith(today));
        if (todayConfirmed.length > 0) {
            html += `<h3 style="color:#4CAF50;margin:20px 0 12px">✅ Potvrđene Danas (${todayConfirmed.length})</h3>`;
            todayConfirmed.sort((a, b) => new Date(b.confirmedAt) - new Date(a.confirmedAt));
            todayConfirmed.forEach(order => {
                html += renderGuestOrderCard(order, false);
            });
        }
    }
    
    const totalOld = (DB.guestOrders || []).filter(o => o.status !== 'pending').length;
    if (totalOld > 5) {
        html += `<div style="margin-top:24px;text-align:center">
            <button class="btn btn-secondary" style="max-width:300px" onclick="clearOldGuestOrders()">🗑️ Obriši stare narudžbine</button>
        </div>`;
    }
    
    c.innerHTML = html;
    updateGuestOrdersBadge();
}

function renderGuestOrderCard(order, showActions) {
    const timeAgo = getTimeAgo(order.createdAt);
    const statusColor = order.status === 'pending' ? '#FF9800' : order.status === 'confirmed' ? '#4CAF50' : '#E94560';
    const statusIcon = order.status === 'pending' ? '⏳' : order.status === 'confirmed' ? '✅' : '❌';
    
    // Osiguraj da items bude niz
    let items = order.items || [];
    if (!Array.isArray(items)) items = Object.values(items);
    
    let html = `<div class="card" style="border-left:4px solid ${statusColor};cursor:default">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-weight:bold;font-size:16px">${statusIcon} ${order.guestName || 'Gost'}</span>
            <span style="color:#B0B0B0;font-size:12px">${timeAgo}</span>
        </div>`;
    
    // Stavke - izračunaj total iz stavki
    let calculatedTotal = 0;
    items.forEach(item => {
        const price = parseFloat(item.price) || 0;
        const qty = parseInt(item.qty) || 0;
        const itemTotal = price * qty;
        calculatedTotal += itemTotal;
        html += `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #2A2A4A">
            <span>${item.name} × ${qty}</span>
            <span style="color:#FFD700">${itemTotal.toLocaleString()} din</span>
        </div>`;
    });
    
    const displayTotal = calculatedTotal || parseFloat(order.total) || 0;
    
    html += `<div style="display:flex;justify-content:space-between;margin-top:8px;font-weight:bold">
        <span style="color:#FFD700">Ukupno:</span>
        <span style="color:#FFD700;font-size:18px">${displayTotal.toLocaleString()} din</span>
    </div>`;
    
    if (order.guestNote) {
        html += `<div style="margin-top:8px;padding:8px;background:#16213E;border-radius:8px;font-size:13px;color:#B0B0B0">
            💬 ${order.guestNote}
        </div>`;
    }
    
    if (showActions && order.status === 'pending') {
        let tableOptions = '<option value="">-- Izaberi sto --</option>';
        DB.tables.forEach(t => {
            const label = t.name || ('Sto ' + t.num);
            tableOptions += `<option value="${t.num}">${label}</option>`;
        });
        
        html += `<div style="margin-top:12px;padding-top:12px;border-top:2px solid #2A2A4A">
            <div style="margin-bottom:10px">
                <label style="color:#B0B0B0;font-size:13px;display:block;margin-bottom:4px">Dodeli sto:</label>
                <select id="guestTable_${order.id}" style="background:#16213E;border:2px solid #2A2A4A;color:#FFF;padding:10px;border-radius:8px;width:100%;font-size:16px">
                    ${tableOptions}
                </select>
            </div>
            <div style="display:flex;gap:10px">
                <button class="btn" style="background:#4CAF50;flex:1" onclick="confirmGuestOrder('${order.id}')">✅ Potvrdi</button>
                <button class="btn" style="background:#E94560;flex:1" onclick="rejectGuestOrder('${order.id}')">❌ Odbij</button>
            </div>
        </div>`;
    }
    
    if (order.status === 'confirmed' && order.assignedTable) {
        const table = DB.tables.find(t => t.num == order.assignedTable);
        const tableName = table && table.name ? table.name : 'Sto ' + order.assignedTable;
        html += `<div style="margin-top:8px;color:#4CAF50;font-size:13px">
            📍 ${tableName} • Potvrdio: ${order.confirmedBy || '?'}
        </div>`;
    }
    
    html += '</div>';
    return html;
}

function confirmGuestOrder(orderId) {
    const tableSelect = document.getElementById('guestTable_' + orderId);
    const tableNum = tableSelect ? parseInt(tableSelect.value) : null;
    
    if (!tableNum) {
        showAlert('⚠️ Molimo izaberite sto za ovu narudžbinu!');
        return;
    }
    
    const order = DB.guestOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const table = DB.tables.find(t => t.num === tableNum);
    if (!table) {
        showAlert('❌ Sto nije pronađen!');
        return;
    }
    
    // Osiguraj da items bude niz
    let orderItems = order.items || [];
    if (!Array.isArray(orderItems)) orderItems = Object.values(orderItems);
    
    orderItems.forEach(item => {
        const menuItem = DB.menu.find(m => m.id == item.id);
        if (menuItem) {
            const itemQty = parseInt(item.qty) || 1;
            const existing = table.order.find(o => o.id == item.id && o.createdBy === DB.currentUser.username);
            if (existing) {
                existing.qty = (parseInt(existing.qty) || 0) + itemQty;
            } else {
                table.order.push({
                    ...menuItem,
                    qty: itemQty,
                    createdBy: DB.currentUser.username,
                    addedAt: new Date().toISOString(),
                    fromQR: true
                });
            }
        }
    });
    
    const foodItems = orderItems.filter(item => {
        const menuItem = DB.menu.find(m => m.id == item.id);
        return menuItem && menuItem.cat === 'Hrana';
    });
    
    if (foodItems.length > 0) {
        const kitchenOrder = {
            id: 'ko_' + Date.now(),
            tableNum: tableNum,
            tableName: table.name || ('Sto ' + tableNum),
            waiterUsername: DB.currentUser.username,
            waiterName: DB.konobarName || DB.currentUser.username,
            items: foodItems.map(item => ({
                name: item.name,
                qty: parseInt(item.qty) || 1,
                note: order.guestNote || ''
            })),
            status: 'pending',
            orderedAt: new Date().toISOString(),
            orderedBy: DB.currentUser.username,
            readyAt: null,
            completedAt: null,
            fromQR: true,
            guestName: order.guestName || 'Gost'
        };
        DB.kitchenOrders.push(kitchenOrder);
        if (typeof markDirty === 'function') markDirty('kitchenOrders', kitchenOrder.id);
    }

    order.status = 'confirmed';
    order.confirmedBy = DB.currentUser.username;
    order.confirmedAt = new Date().toISOString();
    order.assignedTable = tableNum;

    if (typeof markTableDirty === 'function') markTableDirty(tableNum);
    if (typeof markDirty === 'function') markDirty('guestOrders', order.id);
    save();
    renderGuestOrders(document.getElementById('content'));
    
    const tableName = table.name || ('Sto ' + tableNum);
    showAlert(`✅ Narudžbina potvrđena!\n\nStavke dodate na ${tableName}${foodItems.length > 0 ? '\nHrana poslata u kuhinju 🍳' : ''}`);
}

function rejectGuestOrder(orderId) {
    showConfirm('❌ Odbij Narudžbinu', 'Da li ste sigurni da želite da odbijete ovu narudžbinu?', (confirmed) => {
        if (!confirmed) return;
        
        const order = DB.guestOrders.find(o => o.id === orderId);
        if (order) {
            order.status = 'rejected';
            order.rejectedBy = DB.currentUser.username;
            order.rejectedAt = new Date().toISOString();
            if (typeof markDirty === 'function') markDirty('guestOrders', order.id);
            save();
            renderGuestOrders(document.getElementById('content'));
        }
    });
}

function dismissWaiterCall(callId) {
    const call = (DB.waiterCalls || []).find(c => c.id === callId);
    if (call) {
        call.status = 'dismissed';
        call.dismissedBy = DB.currentUser ? DB.currentUser.username : 'unknown';
        call.dismissedAt = new Date().toISOString();
        if (typeof markDirty === 'function') markDirty('waiterCalls', call.id);
    }
    save();
    render();
}

function dismissAllWaiterCalls() {
    (DB.waiterCalls || []).forEach(c => {
        if (c.status === 'pending') {
            c.status = 'dismissed';
            c.dismissedBy = DB.currentUser ? DB.currentUser.username : 'unknown';
            c.dismissedAt = new Date().toISOString();
            if (typeof markDirty === 'function') markDirty('waiterCalls', c.id);
        }
    });
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const _oldCalls = (DB.waiterCalls || []).filter(c => !(c.createdAt > twoHoursAgo));
    DB.waiterCalls = (DB.waiterCalls || []).filter(c => c.createdAt > twoHoursAgo);
    if (typeof markDeleted === 'function') _oldCalls.forEach(c => markDeleted('waiterCalls', c.id));
    save();
    render();
}

function clearOldGuestOrders() {
    showConfirm('🗑️ Obriši Stare', 'Obrisati sve potvrđene i odbijene narudžbine?', (confirmed) => {
        if (!confirmed) return;
        const _toDel = DB.guestOrders.filter(o => o.status !== 'pending');
        DB.guestOrders = DB.guestOrders.filter(o => o.status === 'pending');
        if (typeof markDeleted === 'function') _toDel.forEach(o => markDeleted('guestOrders', o.id));
        save();
        renderGuestOrders(document.getElementById('content'));
    });
}

function updateGuestOrdersBadge() {
    const badge = document.getElementById('guestOrdersBadge');
    if (!badge) return;
    const pendingOrders = (DB.guestOrders || []).filter(o => o.status === 'pending').length;
    const pendingCalls = (DB.waiterCalls || []).filter(c => c.status === 'pending').length;
    const total = pendingOrders + pendingCalls;
    if (total > 0) {
        badge.style.display = 'flex';
        badge.textContent = total;
        badge.style.background = pendingCalls > 0 ? '#FF9800' : '#4CAF50';
    } else {
        badge.style.display = 'none';
    }
}
