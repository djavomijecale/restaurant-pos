// ============================================
// PREBACIVANJE STOLOVA, PODELA RAČUNA, PREDAJA KONOBARU
// ============================================
let splitSelection = {};    // { lineIndex: izabranaKoličina } - podela računa
let splitLines = [];        // reference na stavke (myOrder), paralelno sa splitSelection
let splitPayMethod = '';
let transferSelection = {}; // { lineIndex: količina } - prebacivanje stola
let transferLines = [];     // reference na stavke koje se prebacuju

// Kartica jedne stavke sa "− količina +" biračem (deli je transfer i podela).
// prefix = 'transfer' ili 'split' → zove {prefix}QtyChange i koristi {prefix}Qty_/{prefix}LineTot_ id-jeve.
function _qtyStepperCard(item, idx, prefix) {
    const selObj = (prefix === 'transfer') ? transferSelection : splitSelection;
    const sel = selObj[idx] || 0;
    const lineTot = (item.price || 0) * sel;
    return `<div class="card" style="cursor:default">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div style="flex:1;min-width:0">
                <h3 style="margin:0">${item.name}</h3>
                <p style="color:#B0B0B0;font-size:13px;margin:2px 0 0">${(item.price||0).toLocaleString()} din/kom · na stolu: ${item.qty}</p>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
                <button class="btn btn-secondary" style="width:40px;height:40px;padding:0;font-size:24px;border-radius:8px" onclick="${prefix}QtyChange(${idx},-1)">−</button>
                <span id="${prefix}Qty_${idx}" style="min-width:26px;text-align:center;font-size:20px;font-weight:bold">${sel}</span>
                <button class="btn btn-secondary" style="width:40px;height:40px;padding:0;font-size:24px;border-radius:8px" onclick="${prefix}QtyChange(${idx},1)">+</button>
                <span id="${prefix}LineTot_${idx}" style="min-width:76px;text-align:right;color:#FFD700;font-weight:bold">${lineTot.toLocaleString()} din</span>
            </div>
        </div>
    </div>`;
}

function _updateStepperDom(prefix, idx, lineTot, q) {
    const qEl = document.getElementById(prefix + 'Qty_' + idx);
    if (qEl) qEl.textContent = q;
    const ltEl = document.getElementById(prefix + 'LineTot_' + idx);
    if (ltEl) ltEl.textContent = (lineTot || 0).toLocaleString() + ' din';
    if (prefix === 'split') updateSplitBillTotal();
}

// --- 1. PREBACI NA DRUGI STO (izbor artikala + količine) ---
function openTransferTable(tableNum) {
    const table = DB.tables.find(t => t.num === tableNum);
    if (!table || table.order.length === 0) { showAlert('Sto je prazan!'); return; }

    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    let myItems = isWaiter ? table.order.filter(i => !i.createdBy || i.createdBy === currentUsername) : table.order;
    if (myItems.length === 0) { showAlert('Nemate stavki na ovom stolu!'); return; }

    transferLines = myItems;
    transferSelection = {};
    myItems.forEach((item, idx) => { transferSelection[idx] = item.qty || 0; }); // podrazumevano: sve
    if (typeof markTableDirty === 'function') markTableDirty(table.num); // zaštiti od sync-a tokom izbora

    let destOptions = '<option value="">-- Izaberi sto --</option>';
    DB.tables.forEach(t => {
        if (t.num !== tableNum) {
            const label = t.name || ('Sto ' + t.num);
            const occupied = (t.order && t.order.length > 0) ? ' (zauzet)' : '';
            destOptions += `<option value="${t.num}">${label}${occupied}</option>`;
        }
    });

    let html = `<div style="max-width:600px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="page='tableorder';render()">← Nazad</button>
            <h2>🔄 Prebaci Sto</h2>
            <div style="width:80px"></div>
        </div>
        <p style="color:#B0B0B0;margin-bottom:12px;text-align:center">Podesi koliko čega prebacuješ (podrazumevano sve), pa izaberi sto.</p>
        <div style="background:#0F3460;padding:12px 16px;border-radius:12px;margin-bottom:16px">
            <label style="color:#B0B0B0;font-size:13px;display:block;margin-bottom:6px">Prebaci na:</label>
            <select id="transferDestSelect" style="width:100%;padding:10px;border-radius:8px;border:1px solid #2A2A4A;background:#16213E;color:#FFF;font-size:16px">${destOptions}</select>
        </div>`;
    myItems.forEach((item, idx) => { html += _qtyStepperCard(item, idx, 'transfer'); });
    html += `<button class="btn" style="margin-top:16px" onclick="confirmTransferTable(${tableNum})">🔄 Prebaci Izabrano</button>
    </div>`;

    document.getElementById('content').innerHTML = html;
}

function transferQtyChange(idx, delta) {
    const item = transferLines[idx];
    if (!item) return;
    const max = item.qty || 0;
    let q = (transferSelection[idx] || 0) + delta;
    if (q < 0) q = 0;
    if (q > max) q = max;
    transferSelection[idx] = q;
    _updateStepperDom('transfer', idx, (item.price || 0) * q, q);
}

function confirmTransferTable(tableNum) {
    const destSel = document.getElementById('transferDestSelect');
    const destNum = destSel ? parseInt(destSel.value) : NaN;
    if (!destNum) { showAlert('⚠️ Izaberite sto!'); return; }

    const srcNum = (typeof tableNum === 'number') ? tableNum : DB.selectedTable;
    const srcTable = DB.tables.find(t => t.num === srcNum);
    const destTable = DB.tables.find(t => t.num === destNum);
    if (!srcTable || !destTable) return;
    if (!Array.isArray(destTable.order)) destTable.order = [];

    let moved = 0;
    transferLines.forEach((item, idx) => {
        const q = transferSelection[idx] || 0;
        if (q <= 0) return;
        // Spoji u dest istu stavku (isti id + konobar + cena), inače dodaj novu liniju
        const existing = destTable.order.find(d => d.id === item.id && (d.createdBy || '') === (item.createdBy || '') && d.price === item.price);
        if (existing) existing.qty = (existing.qty || 0) + q;
        else destTable.order.push(Object.assign({}, item, { qty: q }));
        item.qty = (item.qty || 0) - q; // smanji izvor (referenca na stavku stola)
        moved += q;
    });
    if (moved === 0) { showAlert('⚠️ Nisi izabrao nijedan komad za prebacivanje.'); return; }

    srcTable.order = srcTable.order.filter(i => (i.qty || 0) > 0);
    if (srcTable.order.length === 0) { srcTable.discountPercent = 0; srcTable.discountedItems = []; }

    if (typeof markTableDirty === 'function') { markTableDirty(srcTable.num); markTableDirty(destTable.num); }
    save();

    const destName = destTable.name || ('Sto ' + destNum);
    showAlert(`✅ ${moved} kom prebačeno na ${destName}`);
    DB.selectedTable = destNum;
    page = 'tableorder';
    render();
}

// --- 2. PODELI RAČUN ---
function openSplitBill(tableNum) {
    const table = DB.tables.find(t => t.num === tableNum);
    if (!table || table.order.length === 0) { showAlert('Sto je prazan!'); return; }
    
    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    let myOrder = isWaiter ? table.order.filter(i => !i.createdBy || i.createdBy === currentUsername) : table.order;
    
    // Dozvoli podelu i kad je jedna stavka kucana više puta (npr. 5x pivo → 2 i 3)
    const totalPieces = myOrder.reduce((s, i) => s + (i.qty || 0), 0);
    if (totalPieces < 2) { showAlert('Potrebna su bar 2 komada za podelu računa'); return; }

    splitLines = myOrder;
    splitSelection = {};
    myOrder.forEach((item, idx) => { splitSelection[idx] = 0; }); // podrazumevano: ništa
    if (typeof markTableDirty === 'function') markTableDirty(table.num);

    let html = `<div style="max-width:600px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="page='tableorder';render()">← Nazad</button>
            <h2>✂️ Podeli Račun</h2>
            <div style="width:80px"></div>
        </div>
        <p style="color:#B0B0B0;margin-bottom:16px;text-align:center">Podesi koliko čega ovaj gost plaća (po komadu), pa klikni Naplati.</p>`;

    myOrder.forEach((item, idx) => { html += _qtyStepperCard(item, idx, 'split'); });

    html += `<div id="splitBillSummary" style="background:#0F3460;padding:20px;border-radius:12px;margin-top:16px">
            <div style="display:flex;justify-content:space-between;font-size:20px;font-weight:bold;margin-bottom:16px">
                <span>Izabrano:</span>
                <span style="color:#FFD700" id="splitBillTotal">0 din</span>
            </div>
            <div style="display:flex;gap:8px">
                <button class="btn btn-secondary" onclick="selectAllSplit()">Označi Sve</button>
                <button class="btn" id="splitPayBtn" disabled onclick="proceedSplitPayment(${tableNum})">💳 Naplati Izabrano</button>
            </div>
        </div>
    </div>`;

    document.getElementById('content').innerHTML = html;
    updateSplitBillTotal();
}

function splitQtyChange(idx, delta) {
    const item = splitLines[idx];
    if (!item) return;
    const max = item.qty || 0;
    let q = (splitSelection[idx] || 0) + delta;
    if (q < 0) q = 0;
    if (q > max) q = max;
    splitSelection[idx] = q;
    _updateStepperDom('split', idx, (item.price || 0) * q, q);
}

// Vrati {items:[{...stavka, qty:izabrano}], total, pieces} za trenutni izbor podele.
function _splitSelectedItems() {
    const items = [];
    let total = 0, pieces = 0;
    splitLines.forEach((item, idx) => {
        const q = splitSelection[idx] || 0;
        if (q > 0) {
            items.push(Object.assign({}, item, { qty: q }));
            total += (item.price || 0) * q;
            pieces += q;
        }
    });
    return { items: items, total: total, pieces: pieces };
}

function selectAllSplit() {
    splitLines.forEach((item, idx) => {
        const max = item.qty || 0;
        splitSelection[idx] = max;
        _updateStepperDom('split', idx, (item.price || 0) * max, max);
    });
    updateSplitBillTotal();
}

function updateSplitBillTotal() {
    let total = 0, any = false;
    splitLines.forEach((item, idx) => {
        const q = splitSelection[idx] || 0;
        total += (item.price || 0) * q;
        if (q > 0) any = true;
    });
    const el = document.getElementById('splitBillTotal');
    if (el) el.textContent = total.toLocaleString() + ' din';
    const btn = document.getElementById('splitPayBtn');
    if (btn) btn.disabled = !any;
}

function proceedSplitPayment(tableNum) {
    const sel = _splitSelectedItems();
    if (sel.items.length === 0) return;
    const table = DB.tables.find(t => t.num === tableNum);
    if (!table) return;

    let html = `<div style="max-width:600px;margin:0 auto">
        <div style="margin-bottom:24px">
            <button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="openSplitBill(${tableNum})">← Nazad</button>
        </div>
        <div style="background:#0F3460;padding:20px;border-radius:12px;text-align:center;margin-bottom:24px">
            <p style="color:#B0B0B0">✂️ Podeljeni Račun - ${table.name}</p>
            <p style="color:#B0B0B0;font-size:13px;margin:8px 0">${sel.pieces} kom · ${sel.items.length} ${sel.items.length === 1 ? 'stavka' : 'stavke'}</p>
            <h1 style="color:#FFD700;font-size:48px">${sel.total.toLocaleString()} din.</h1>
        </div>
        <h3 style="text-align:center;margin:24px 0;color:#B0B0B0">Način plaćanja</h3>
        <div style="display:flex;gap:16px">
            <div id="splitCash" onclick="selectSplitPay('Cash')" style="flex:1;background:#16213E;padding:24px;border-radius:12px;text-align:center;cursor:pointer;border:3px solid transparent">
                <div style="font-size:48px">💵</div><h3>Cash</h3>
            </div>
            <div id="splitCard" onclick="selectSplitPay('Card')" style="flex:1;background:#16213E;padding:24px;border-radius:12px;text-align:center;cursor:pointer;border:3px solid transparent">
                <div style="font-size:48px">💳</div><h3>Card</h3>
            </div>
            <div id="splitWire" onclick="selectSplitPay('Wire')" style="flex:1;background:#16213E;padding:24px;border-radius:12px;text-align:center;cursor:pointer;border:3px solid transparent">
                <div style="font-size:48px">🏦</div><h3>Prenos</h3>
            </div>
        </div>
        <button class="btn" style="margin-top:24px" id="splitConfirmBtn" disabled onclick="confirmSplitPay(${tableNum})">Potvrdi</button>
    </div>`;
    
    document.getElementById('content').innerHTML = html;
}

function selectSplitPay(method) {
    splitPayMethod = method;
    document.getElementById('splitCash').style.borderColor = method === 'Cash' ? '#E94560' : 'transparent';
    document.getElementById('splitCard').style.borderColor = method === 'Card' ? '#E94560' : 'transparent';
    document.getElementById('splitWire').style.borderColor = method === 'Wire' ? '#E94560' : 'transparent';
    document.getElementById('splitConfirmBtn').disabled = false;
}

function confirmSplitPay(tableNum) {
    if (!splitPayMethod) return;
    const table = DB.tables.find(t => t.num === tableNum);
    if (!table) return;

    const sel = _splitSelectedItems();
    if (sel.items.length === 0) return;

    const method = splitPayMethod; // zapamti pre reset-a (koristi se u poruci)

    const _splitOrder = {
        id: Date.now(),
        table: table.num,
        tableName: table.name,
        items: sel.items,          // kopije stavki sa izabranim količinama
        sub: sel.total,
        disc: 0,
        discountPercent: 0,
        discountedItems: [],
        tot: sel.total,
        method: method,
        createdBy: DB.konobarName || DB.currentUser.username,
        time: new Date().toISOString(),
        isSplitBill: true
    };
    DB.orders.push(_splitOrder);
    // 💾 Sačuvaj račun pojedinačno (računi se ne pišu više u bulk save-u)
    if (typeof persistNewOrder === 'function') persistNewOrder(_splitOrder).catch(e => console.error('❌ Split račun nije sačuvan:', e && e.message));

    // Oduzmi iz lagera (tačno izabrane količine)
    if (typeof deductInventoryOnPayment === 'function') {
        deductInventoryOnPayment(sel.items);
    }

    // Smanji izabrane količine na stolu (splitLines su reference na stavke stola)
    splitLines.forEach((item, idx) => {
        const q = splitSelection[idx] || 0;
        if (q > 0) item.qty = (item.qty || 0) - q;
    });
    table.order = table.order.filter(i => (i.qty || 0) > 0);

    if (table.order.length === 0) {
        table.discountPercent = 0;
        table.discountedItems = [];
    }

    splitSelection = {};
    splitLines = [];
    splitPayMethod = '';
    if (typeof markTableDirty === 'function') markTableDirty(table.num);
    save();

    const remaining = table.order.length;
    if (remaining > 0) {
        showAlert(`✅ Račun od ${sel.total.toLocaleString()} din naplaćen (${method})\n\nJoš ${remaining} stavki ostalo na stolu`);
        page = 'tableorder';
    } else {
        showAlert(`✅ Račun od ${sel.total.toLocaleString()} din naplaćen (${method})\n\nSto je ispražnjen`);
        DB.selectedTable = null;
        page = 'tables';
    }
    render();
}

// --- 3. PREDAJ KONOBARU ---
function openTransferWaiter(tableNum) {
    const table = DB.tables.find(t => t.num === tableNum);
    if (!table || table.order.length === 0) { showAlert('Sto je prazan!'); return; }
    
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    const myItems = table.order.filter(i => !i.createdBy || i.createdBy === currentUsername);
    
    if (myItems.length === 0) { showAlert('Nemate stavki na ovom stolu!'); return; }
    
    document.getElementById('transferWaiterInfo').textContent = 
        `Predaješ ${myItems.length} stavki sa ${table.name} drugom konobaru`;
    
    let options = '<option value="">-- Izaberi konobara --</option>';
    const activeWaiters = Object.keys(DB.workdays || {}).filter(u => u !== currentUsername);
    
    if (activeWaiters.length > 0) {
        activeWaiters.forEach(username => {
            options += `<option value="${username}">🟢 ${username} (aktivna smena)</option>`;
        });
    }
    
    const allWaiters = (DB.users || []).filter(u => 
        (u.role === 'konobar' || u.role === 'waiter') && u.username !== currentUsername
    );
    allWaiters.forEach(u => {
        if (!activeWaiters.includes(u.username)) {
            options += `<option value="${u.username}">⚪ ${u.username}</option>`;
        }
    });
    
    document.getElementById('transferWaiterSelect').innerHTML = options;
    document.getElementById('transferWaiterModal').classList.add('show');
}

function confirmTransferWaiter() {
    const newWaiter = document.getElementById('transferWaiterSelect').value;
    if (!newWaiter) { showAlert('⚠️ Izaberite konobara!'); return; }
    
    const table = DB.tables.find(t => t.num === DB.selectedTable);
    if (!table) return;
    
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    let count = 0;
    
    table.order.forEach(item => {
        if (!item.createdBy || item.createdBy === currentUsername) {
            item.createdBy = newWaiter;
            count++;
        }
    });

    // ✅ RACE FIX: bez markTableDirty pre-save merge uzima server verziju
    // stola (sa starim vlasništvom) i gazi lokalnu izmenu createdBy-a
    if (typeof markTableDirty === 'function') markTableDirty(table.num);
    save();
    document.getElementById('transferWaiterModal').classList.remove('show');
    showAlert(`✅ ${count} stavki predato konobaru ${newWaiter}`);
    
    page = 'tables';
    DB.selectedTable = null;
    render();
}
