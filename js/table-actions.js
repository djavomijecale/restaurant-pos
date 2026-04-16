// ============================================
// PREBACIVANJE STOLOVA, PODELA RAČUNA, PREDAJA KONOBARU
// ============================================
let splitBillItems = [];
let splitPayMethod = '';

// --- 1. PREBACI NA DRUGI STO ---
function openTransferTable(tableNum) {
    const table = DB.tables.find(t => t.num === tableNum);
    if (!table || table.order.length === 0) { showAlert('Sto je prazan!'); return; }
    
    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    let myItems = isWaiter ? table.order.filter(i => !i.createdBy || i.createdBy === currentUsername) : table.order;
    
    document.getElementById('transferTableInfo').textContent = 
        `Prebacuješ ${myItems.length} stavki sa ${table.name}`;
    
    let options = '<option value="">-- Izaberi sto --</option>';
    DB.tables.forEach(t => {
        if (t.num !== tableNum) {
            const label = t.name || ('Sto ' + t.num);
            const occupied = t.order.length > 0 ? ' (zauzet)' : '';
            options += `<option value="${t.num}">${label}${occupied}</option>`;
        }
    });
    document.getElementById('transferTableSelect').innerHTML = options;
    document.getElementById('transferTableModal').classList.add('show');
}

function confirmTransferTable() {
    const destNum = parseInt(document.getElementById('transferTableSelect').value);
    if (!destNum) { showAlert('⚠️ Izaberite sto!'); return; }
    
    const srcTable = DB.tables.find(t => t.num === DB.selectedTable);
    const destTable = DB.tables.find(t => t.num === destNum);
    if (!srcTable || !destTable) return;
    
    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    
    let itemsToMove, itemsToKeep;
    if (isWaiter) {
        itemsToMove = srcTable.order.filter(i => !i.createdBy || i.createdBy === currentUsername);
        itemsToKeep = srcTable.order.filter(i => i.createdBy && i.createdBy !== currentUsername);
    } else {
        itemsToMove = [...srcTable.order];
        itemsToKeep = [];
    }
    
    destTable.order = [...destTable.order, ...itemsToMove];
    srcTable.order = itemsToKeep;

    if (srcTable.order.length === 0) {
        srcTable.discountPercent = 0;
        srcTable.discountedItems = [];
    }

    if (typeof markTableDirty === 'function') {
        markTableDirty(srcTable.num);
        markTableDirty(destTable.num);
    }
    save();
    document.getElementById('transferTableModal').classList.remove('show');
    
    const destName = destTable.name || ('Sto ' + destNum);
    showAlert(`✅ ${itemsToMove.length} stavki prebačeno na ${destName}`);
    
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
    
    if (myOrder.length < 2) { showAlert('Potrebne su bar 2 stavke za podelu računa'); return; }
    
    splitBillItems = [];
    
    let html = `<div style="max-width:600px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="page='tableorder';splitBillItems=[];render()">← Nazad</button>
            <h2>✂️ Podeli Račun</h2>
            <div style="width:80px"></div>
        </div>
        <p style="color:#B0B0B0;margin-bottom:16px;text-align:center">Označi stavke koje ovaj gost plaća, pa klikni Naplati</p>`;
    
    myOrder.forEach(item => {
        html += `<div class="card" style="cursor:pointer" onclick="toggleSplitItem(${item.id}, this)">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="display:flex;align-items:center;gap:12px">
                    <input type="checkbox" class="split-cb" data-id="${item.id}" 
                        style="width:22px;height:22px;cursor:pointer;accent-color:#E94560" 
                        onclick="event.stopPropagation();toggleSplitItem(${item.id}, this.parentElement.parentElement.parentElement)">
                    <div>
                        <h3>${item.name}</h3>
                        <p style="color:#B0B0B0;font-size:13px">${item.price} × ${item.qty}</p>
                    </div>
                </div>
                <span style="color:#FFD700;font-weight:bold">${(item.price * item.qty).toLocaleString()} din</span>
            </div>
        </div>`;
    });
    
    html += `<div id="splitBillSummary" style="background:#0F3460;padding:20px;border-radius:12px;margin-top:16px">
            <div style="display:flex;justify-content:space-between;font-size:20px;font-weight:bold;margin-bottom:16px">
                <span>Izabrano:</span>
                <span style="color:#FFD700" id="splitBillTotal">0 din</span>
            </div>
            <div style="display:flex;gap:8px">
                <button class="btn btn-secondary" onclick="selectAllSplit(${tableNum})">Označi Sve</button>
                <button class="btn" id="splitPayBtn" disabled onclick="proceedSplitPayment(${tableNum})">💳 Naplati Izabrano</button>
            </div>
        </div>
    </div>`;
    
    document.getElementById('content').innerHTML = html;
}

function toggleSplitItem(itemId, cardEl) {
    const idx = splitBillItems.indexOf(itemId);
    const cb = cardEl.querySelector('.split-cb');
    
    if (idx >= 0) {
        splitBillItems.splice(idx, 1);
        if (cb) cb.checked = false;
        cardEl.style.borderColor = 'transparent';
    } else {
        splitBillItems.push(itemId);
        if (cb) cb.checked = true;
        cardEl.style.borderColor = '#E94560';
    }
    updateSplitBillTotal();
}

function selectAllSplit(tableNum) {
    const table = DB.tables.find(t => t.num === tableNum);
    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    let myOrder = isWaiter ? table.order.filter(i => !i.createdBy || i.createdBy === currentUsername) : table.order;
    
    splitBillItems = myOrder.map(i => i.id);
    document.querySelectorAll('.split-cb').forEach(cb => { cb.checked = true; cb.closest('.card').style.borderColor = '#E94560'; });
    updateSplitBillTotal();
}

function updateSplitBillTotal() {
    const table = DB.tables.find(t => t.num === DB.selectedTable);
    if (!table) return;
    
    let total = 0;
    splitBillItems.forEach(id => {
        const item = table.order.find(i => i.id === id);
        if (item) total += item.price * item.qty;
    });
    
    const el = document.getElementById('splitBillTotal');
    if (el) el.textContent = total.toLocaleString() + ' din';
    
    const btn = document.getElementById('splitPayBtn');
    if (btn) btn.disabled = splitBillItems.length === 0;
}

function proceedSplitPayment(tableNum) {
    if (splitBillItems.length === 0) return;
    
    const table = DB.tables.find(t => t.num === tableNum);
    const selectedItems = table.order.filter(i => splitBillItems.includes(i.id));
    const total = selectedItems.reduce((s, i) => s + (i.price * i.qty), 0);
    
    let html = `<div style="max-width:600px;margin:0 auto">
        <div style="margin-bottom:24px">
            <button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="openSplitBill(${tableNum})">← Nazad</button>
        </div>
        <div style="background:#0F3460;padding:20px;border-radius:12px;text-align:center;margin-bottom:24px">
            <p style="color:#B0B0B0">✂️ Podeljeni Račun - ${table.name}</p>
            <p style="color:#B0B0B0;font-size:13px;margin:8px 0">${selectedItems.length} od ${table.order.length} stavki</p>
            <h1 style="color:#FFD700;font-size:48px">${total.toLocaleString()} din.</h1>
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
    if (!splitPayMethod || splitBillItems.length === 0) return;
    
    const table = DB.tables.find(t => t.num === tableNum);
    const selectedItems = table.order.filter(i => splitBillItems.includes(i.id));
    const total = selectedItems.reduce((s, i) => s + (i.price * i.qty), 0);
    
    DB.orders.push({
        id: Date.now(),
        table: table.num,
        tableName: table.name,
        items: [...selectedItems],
        sub: total,
        disc: 0,
        discountPercent: 0,
        discountedItems: [],
        tot: total,
        method: splitPayMethod,
        createdBy: DB.konobarName || DB.currentUser.username,
        time: new Date().toISOString(),
        isSplitBill: true
    });
    
    // Oduzmi iz lagera
    if (typeof deductInventoryOnPayment === 'function') {
        deductInventoryOnPayment(selectedItems);
    }
    
    table.order = table.order.filter(i => !splitBillItems.includes(i.id));

    if (table.order.length === 0) {
        table.discountPercent = 0;
        table.discountedItems = [];
    }

    splitBillItems = [];
    splitPayMethod = '';
    if (typeof markTableDirty === 'function') markTableDirty(table.num);
    save();
    
    const remaining = table.order.length;
    if (remaining > 0) {
        showAlert(`✅ Račun od ${total.toLocaleString()} din naplaćen (${splitPayMethod})\n\nJoš ${remaining} stavki ostalo na stolu`);
        page = 'tableorder';
    } else {
        showAlert(`✅ Račun od ${total.toLocaleString()} din naplaćen (${splitPayMethod})\n\nSto je ispražnjen`);
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
