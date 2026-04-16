// ============================================
// KUĆA - Artikli na račun kuće
// ============================================
// Stavke koje se NE naplaćuju i NE vide u dnevnim izveštajima
// Svaka stavka se vezuje za ime (novo ili postojeće)

// ============================================
// MODAL ZA IZBOR IMENA - KUĆA
// ============================================
function showHouseModal() {
    const table = DB.tables.find(t => t.num === DB.selectedTable);
    if (!table) return;

    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;

    let myOrder = table.order;
    if (isWaiter) {
        myOrder = table.order.filter(item =>
            !item.createdBy || item.createdBy === currentUsername
        );
    }

    if (myOrder.length === 0) {
        showAlert('Nema stavki za prebacivanje na kuću');
        return;
    }

    // Dohvati sva jedinstvena imena iz prethodnih kuća narudžbina
    const existingNames = getHouseNames();

    const modal = document.createElement('div');
    modal.id = 'houseModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';

    let namesHTML = '';
    if (existingNames.length > 0) {
        namesHTML = `
            <div style="margin-bottom:16px">
                <label style="color:#B0B0B0;font-size:13px;display:block;margin-bottom:8px">Ili izaberi postojeće ime:</label>
                <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:200px;overflow-y:auto;padding:4px">
                    ${existingNames.map(name => `
                        <button class="btn btn-secondary" 
                            style="width:auto;padding:8px 16px;font-size:14px;background:#16213E;border:2px solid #2A2A4A" 
                            onclick="selectHouseName('${name.replace(/'/g, "\\'")}')">
                            🏠 ${name}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    const sub = myOrder.reduce((s, i) => s + (i.price * i.qty), 0);

    modal.innerHTML = `
        <div style="background:#1a1a2e;border-radius:16px;padding:24px;max-width:400px;width:100%;max-height:90vh;overflow-y:auto">
            <h3 style="color:#FF9800;margin-bottom:8px;text-align:center">🏠 Kuća</h3>
            <p style="color:#B0B0B0;font-size:13px;text-align:center;margin-bottom:20px">
                ${myOrder.length} ${myOrder.length === 1 ? 'stavka' : myOrder.length < 5 ? 'stavke' : 'stavki'} • ${sub.toFixed(0)} din.
            </p>
            <p style="color:#B0B0B0;font-size:12px;text-align:center;margin-bottom:16px">
                ⚠️ Ove stavke se NEĆE naplatiti i NEĆE biti u izveštajima
            </p>
            
            <label style="color:#FFD700;font-weight:bold;display:block;margin-bottom:8px">Upiši novo ime:</label>
            <input type="text" id="houseNameInput" placeholder="Ime za kuću..." 
                   style="width:100%;padding:12px;border-radius:8px;border:2px solid #2A2A4A;background:#0F3460;color:white;font-size:16px;box-sizing:border-box;margin-bottom:16px"
                   onkeydown="if(event.key==='Enter')confirmHouseOrder()">
            
            ${namesHTML}
            
            <div style="display:flex;gap:12px;margin-top:20px">
                <button class="btn btn-secondary" style="flex:1" onclick="this.closest('#houseModal').remove()">Otkaži</button>
                <button class="btn" style="flex:1;background:#FF9800" onclick="confirmHouseOrder()">🏠 Potvrdi</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Fokus na input
    setTimeout(() => {
        const input = document.getElementById('houseNameInput');
        if (input) input.focus();
    }, 100);
}


// ============================================
// IZABERI POSTOJEĆE IME
// ============================================
function selectHouseName(name) {
    const input = document.getElementById('houseNameInput');
    if (input) {
        input.value = name;
        input.focus();
    }
}


// ============================================
// DOHVATI SVA KORIŠĆENA IMENA
// ============================================
function getHouseNames() {
    if (!DB.houseOrders || DB.houseOrders.length === 0) return [];

    const names = {};
    DB.houseOrders.forEach(ho => {
        if (ho.houseName) {
            if (!names[ho.houseName]) {
                names[ho.houseName] = { count: 0, lastUsed: ho.time };
            }
            names[ho.houseName].count++;
            if (ho.time > names[ho.houseName].lastUsed) {
                names[ho.houseName].lastUsed = ho.time;
            }
        }
    });

    // Sortiraj po poslednjem korišćenju (najnovije prvo)
    return Object.keys(names).sort((a, b) => names[b].lastUsed.localeCompare(names[a].lastUsed));
}


// ============================================
// POTVRDI KUĆA NARUDŽBINU
// ============================================
function confirmHouseOrder() {
    const nameInput = document.getElementById('houseNameInput');
    const houseName = nameInput ? nameInput.value.trim() : '';

    if (!houseName) {
        showAlert('Upiši ime za kuću!');
        if (nameInput) nameInput.focus();
        return;
    }

    const table = DB.tables.find(t => t.num === DB.selectedTable);
    if (!table) return;

    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;

    let myOrder = table.order;
    if (isWaiter) {
        myOrder = table.order.filter(item =>
            !item.createdBy || item.createdBy === currentUsername
        );
    }

    const sub = myOrder.reduce((s, i) => s + (i.price * i.qty), 0);

    // Izračunaj popust ako postoji
    let discountAmount = 0;
    if (table.discountPercent > 0 && table.discountedItems && table.discountedItems.length > 0) {
        myOrder.forEach(item => {
            if (table.discountedItems.includes(item.id)) {
                discountAmount += (item.price * item.qty * table.discountPercent / 100);
            }
        });
    }

    const tot = Math.max(0, sub - discountAmount);

    const houseOrder = {
        id: Date.now(),
        table: table.num,
        tableName: table.name,
        items: [...myOrder],
        sub,
        disc: discountAmount,
        tot,
        houseName: houseName,
        createdBy: DB.konobarName || DB.currentUser.username,
        time: new Date().toISOString()
    };

    // Dodaj u houseOrders (NE u orders!)
    if (!DB.houseOrders) DB.houseOrders = [];
    DB.houseOrders.push(houseOrder);
    // ✅ RACE FIX: obeleži nov houseOrder kao dirty da pre-save merge ne
    // prepiše server verziju (inače bi drugi uređaj koji istovremeno piše
    // mogao da obriše ovu Kuća naplatu).
    if (typeof markDirty === 'function') markDirty('houseOrders', houseOrder.id);

    // Ukloni stavke sa stola (isto kao pri naplati)
    if (isWaiter) {
        table.order = table.order.filter(item => item.createdBy !== currentUsername);
    } else {
        table.order = [];
        table.discount = 0;
        table.discountPercent = 0;
        table.discountedItems = [];
    }

    // ✅ RACE FIX: bez markTableDirty pre-save merge vraća stavke koje su
    // upravo prebačene u kuću
    if (typeof markTableDirty === 'function') markTableDirty(table.num);
    save();

    // Zatvori modal
    const modal = document.getElementById('houseModal');
    if (modal) modal.remove();

    // Prikaži potvrdu
    showHouseReceipt(houseOrder);
}


// ============================================
// PRIKAŽI POTVRDU KUĆA NARUDŽBINE
// ============================================
function showHouseReceipt(order) {
    page = 'houseReceipt';
    DB._lastHouseOrder = order;
    render();
}

function renderHouseReceipt(c) {
    const o = DB._lastHouseOrder;
    if (!o) {
        page = 'tables';
        render();
        return;
    }

    let h = `<div class="success">
        <div class="success-icon">🏠</div>
        <h2 style="color:#FF9800;margin-bottom:24px">Kuća - ${o.houseName}</h2>
        <div style="background:#0F3460;padding:20px;border-radius:12px;max-width:400px;margin:0 auto">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span>${o.tableName || 'Sto ' + o.table}</span>
                <span style="color:#FF9800">🏠 KUĆA</span>
            </div>
            <hr style="border:none;border-top:1px solid #2A2A4A;margin:12px 0">`;

    o.items.forEach(i => {
        h += `<div style="display:flex;justify-content:space-between;margin:4px 0">
            <span>${i.qty}x ${i.name}</span>
            <span>${(i.price * i.qty).toFixed(0)} din.</span>
        </div>`;
    });

    h += `<hr style="border:none;border-top:1px solid #2A2A4A;margin:12px 0">
        <div style="display:flex;justify-content:space-between;font-size:20px;font-weight:bold;margin-top:8px">
            <span>VREDNOST:</span><span style="color:#FF9800">${o.tot.toFixed(0)} din.</span>
        </div>
        <hr style="border:none;border-top:1px solid #2A2A4A;margin:12px 0">
        <div style="display:flex;justify-content:space-between"><span>Ime:</span><span style="color:#FFD700">🏠 ${o.houseName}</span></div>
        <div style="display:flex;justify-content:space-between;margin-top:4px"><span>Status:</span><span style="color:#FF9800">⛔ NIJE NAPLAĆENO</span></div>
    </div>
    <button class="btn" style="max-width:400px;margin:24px auto 0" onclick="newOrder()">Nazad na Stolove</button>
</div>`;

    c.innerHTML = h;
}


// ============================================
// STRANICA: PREGLED KUĆA NARUDŽBINA
// ============================================
let houseFilterName = 'Sve';
let houseFilterDate = '';

function renderHouse(c) {
    if (!DB.houseOrders) DB.houseOrders = [];

    const names = getHouseNames();
    const allOrders = [...DB.houseOrders].reverse();

    // Filtriraj po imenu
    let filtered = allOrders;
    if (houseFilterName !== 'Sve') {
        filtered = filtered.filter(o => o.houseName === houseFilterName);
    }

    // Filtriraj po datumu
    if (houseFilterDate) {
        filtered = filtered.filter(o => o.time.split('T')[0] === houseFilterDate);
    }

    // Statistika
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = DB.houseOrders.filter(o => o.time.split('T')[0] === today);
    const todayTotal = todayOrders.reduce((s, o) => s + o.tot, 0);
    const allTotal = filtered.reduce((s, o) => s + o.tot, 0);
    const totalAllTime = DB.houseOrders.reduce((s, o) => s + o.tot, 0);

    // Statistika po imenu
    const nameStats = {};
    DB.houseOrders.forEach(o => {
        if (!nameStats[o.houseName]) nameStats[o.houseName] = { count: 0, total: 0 };
        nameStats[o.houseName].count++;
        nameStats[o.houseName].total += o.tot;
    });

    let h = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
            <h2>🏠 Kuća</h2>
            ${DB.houseOrders.length > 0 ? `
                <button class="btn btn-secondary" style="width:auto;padding:8px 16px;background:#E94560;font-size:12px" onclick="clearHouseOrders()">🗑️ Očisti sve</button>
            ` : ''}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px">
            <div class="stat-card">
                <div class="stat-label">Danas</div>
                <div class="stat-value" style="color:#FF9800">${todayTotal.toFixed(0)}</div>
                <div class="stat-label">din.</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Filtrirano</div>
                <div class="stat-value" style="color:#FFD700">${allTotal.toFixed(0)}</div>
                <div class="stat-label">din. (${filtered.length})</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ukupno svi</div>
                <div class="stat-value" style="color:#00BCD4">${totalAllTime.toFixed(0)}</div>
                <div class="stat-label">din.</div>
            </div>
        </div>`;

    // Filter po imenu
    h += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <button class="btn btn-secondary" style="width:auto;padding:6px 14px;font-size:13px;${houseFilterName === 'Sve' ? 'background:#FF9800;color:white' : ''}" onclick="houseFilterName='Sve';render()">Sva imena</button>`;
    names.forEach(name => {
        const stat = nameStats[name] || { count: 0, total: 0 };
        h += `<button class="btn btn-secondary" style="width:auto;padding:6px 14px;font-size:13px;${houseFilterName === name ? 'background:#FF9800;color:white' : ''}" 
            onclick="houseFilterName='${name.replace(/'/g, "\\'")}';render()">
            🏠 ${name} <span style="font-size:11px;opacity:0.7">(${stat.count})</span>
        </button>`;
    });
    h += `</div>`;

    // Filter po datumu
    h += `<div style="margin-bottom:20px">
        <input type="date" value="${houseFilterDate}" 
            onchange="houseFilterDate=this.value;render()" 
            style="padding:8px 12px;border-radius:8px;border:2px solid #2A2A4A;background:#0F3460;color:white;font-size:14px">
        ${houseFilterDate ? `<button class="btn btn-secondary" style="width:auto;padding:6px 12px;font-size:12px;margin-left:8px" onclick="houseFilterDate='';render()">✕ Očisti datum</button>` : ''}
    </div>`;

    // Statistika po imenima (ako nema filtera)
    if (houseFilterName === 'Sve' && names.length > 0) {
        h += `<div style="background:#16213E;padding:16px;border-radius:12px;margin-bottom:24px">
            <h4 style="color:#FF9800;margin-bottom:12px">📊 Po imenima (ukupno)</h4>`;
        names.forEach(name => {
            const stat = nameStats[name];
            h += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #2A2A4A">
                <span style="color:#FFD700">🏠 ${name}</span>
                <span style="color:#B0B0B0">${stat.count} puta • <strong style="color:#FF9800">${stat.total.toFixed(0)} din.</strong></span>
            </div>`;
        });
        h += `</div>`;
    }

    // Lista narudžbina
    if (filtered.length === 0) {
        h += `<div class="empty" style="margin-top:32px">
            <div style="font-size:48px;margin-bottom:16px">🏠</div>
            <p>Nema stavki na kući${houseFilterName !== 'Sve' ? ' za ' + houseFilterName : ''}</p>
        </div>`;
    } else {
        filtered.forEach((o, idx) => {
            const date = new Date(o.time);
            const dateStr = date.toLocaleDateString('sr-RS');
            const timeStr = date.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });

            h += `<div class="card" style="cursor:default;margin-bottom:8px;border-left:4px solid #FF9800">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                    <div>
                        <span style="color:#FF9800;font-weight:bold">🏠 ${o.houseName}</span>
                        <span style="color:#B0B0B0;font-size:12px;margin-left:8px">${o.tableName || 'Sto ' + o.table}</span>
                    </div>
                    <div style="text-align:right">
                        <span style="color:#FFD700;font-weight:bold">${o.tot.toFixed(0)} din.</span>
                        <button style="background:none;border:none;color:#E94560;cursor:pointer;font-size:16px;margin-left:8px;padding:2px 6px" 
                                onclick="deleteHouseOrder(${o.id})" title="Obriši">🗑️</button>
                    </div>
                </div>
                <div style="color:#B0B0B0;font-size:12px;margin-bottom:6px">
                    ${dateStr} ${timeStr} • ${o.createdBy || 'Admin'}
                </div>
                <div style="font-size:13px;color:#B0B0B0">
                    ${o.items.map(i => `${i.qty}x ${i.name}`).join(' • ')}
                </div>
            </div>`;
        });
    }

    c.innerHTML = h;
}


// ============================================
// OBRIŠI JEDNU KUĆA NARUDŽBINU
// ============================================
function deleteHouseOrder(orderId) {
    showConfirm('🗑️ Obriši', 'Da li si siguran da želiš da obrišeš ovu kuća narudžbinu?', (confirmed) => {
        if (confirmed) {
            // ✅ RACE FIX: pre filtriranja označi ID kao obrisan da ga
            // pre-save merge ne vrati iz servera.
            if (typeof markDeleted === 'function') markDeleted('houseOrders', orderId);
            DB.houseOrders = DB.houseOrders.filter(o => o.id !== orderId);
            save();
            render();
        }
    });
}


// ============================================
// OČISTI SVE KUĆA NARUDŽBINE
// ============================================
function clearHouseOrders() {
    showConfirm('🗑️ Očisti sve', `Da li si siguran da želiš da obrišeš SVE kuća narudžbine?\n\n${DB.houseOrders.length} stavki ukupno`, (confirmed) => {
        if (confirmed) {
            // ✅ RACE FIX: pojedinačno označi sve kao obrisane pre reset-a
            if (typeof markDeleted === 'function') {
                (DB.houseOrders || []).forEach(o => { if (o && o.id) markDeleted('houseOrders', o.id); });
            }
            DB.houseOrders = [];
            save();
            render();
        }
    });
}


console.log('✅ Kuća modul učitan');
