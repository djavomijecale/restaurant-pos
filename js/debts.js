// ============================================
// DEBTS / DUGOVANJA MANAGEMENT
// ============================================

let debtSearch = '';
let debtsTab = 'active';

function renderDebts(c) {
    if (!DB.debts) DB.debts = [];
    
    const active = DB.debts.filter(d => d.remaining > 0 && !d.deleted);
    const cleared = DB.debts.filter(d => d.remaining <= 0 && !d.deleted);
    const deleted = DB.debts.filter(d => d.deleted);
    const totalDebt = active.reduce((s, d) => s + d.remaining, 0);
    const totalCleared = cleared.reduce((s, d) => s + (d.originalTotal || 0), 0);
    
    // Grupiši aktivna po dužniku
    const byDebtor = {};
    active.forEach(d => {
        const name = d.debtorName || 'Nepoznat';
        if (!byDebtor[name]) byDebtor[name] = { debts: [], total: 0 };
        byDebtor[name].debts.push(d);
        byDebtor[name].total += d.remaining;
    });
    
    const debtorCount = Object.keys(byDebtor).length;
    
    let h = `<h2 style="margin-bottom:16px">📝 Dugovanja</h2>`;
    
    // Stats
    h += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
        <div style="background:#0F3460;padding:12px;border-radius:8px;text-align:center">
            <div style="color:#E94560;font-size:22px;font-weight:bold">${totalDebt.toFixed(0)}</div>
            <div style="color:#B0B0B0;font-size:10px">Ukupan dug (din)</div>
        </div>
        <div style="background:#0F3460;padding:12px;border-radius:8px;text-align:center">
            <div style="color:#FFD700;font-size:22px;font-weight:bold">${debtorCount}</div>
            <div style="color:#B0B0B0;font-size:10px">Dužnika</div>
        </div>
        <div style="background:#0F3460;padding:12px;border-radius:8px;text-align:center">
            <div style="color:#4CAF50;font-size:22px;font-weight:bold">${totalCleared.toFixed(0)}</div>
            <div style="color:#B0B0B0;font-size:10px">Vraćeno (din)</div>
        </div>
    </div>`;
    
    // Tabs
    h += `<div style="display:flex;gap:6px;margin-bottom:16px">
        <button onclick="debtsTab='active';render()" style="flex:1;padding:10px;border-radius:8px;border:none;cursor:pointer;font-weight:bold;font-size:13px;
            background:${debtsTab==='active' ? '#E94560' : '#16213E'};color:${debtsTab==='active' ? '#FFF' : '#888'}">
            🔴 Aktivna (${active.length})
        </button>
        <button onclick="debtsTab='cleared';render()" style="flex:1;padding:10px;border-radius:8px;border:none;cursor:pointer;font-weight:bold;font-size:13px;
            background:${debtsTab==='cleared' ? '#4CAF50' : '#16213E'};color:${debtsTab==='cleared' ? '#FFF' : '#888'}">
            ✅ Vraćena (${cleared.length})
        </button>
        <button onclick="debtsTab='deleted';render()" style="flex:1;padding:10px;border-radius:8px;border:none;cursor:pointer;font-weight:bold;font-size:13px;
            background:${debtsTab==='deleted' ? '#888' : '#16213E'};color:${debtsTab==='deleted' ? '#FFF' : '#888'}">
            🗑️ Obrisana (${deleted.length})
        </button>
    </div>`;
    
    // Search (for all tabs)
    const allForTab = debtsTab === 'active' ? active : debtsTab === 'cleared' ? cleared : deleted;
    if (allForTab.length > 3) {
        h += `<div style="margin-bottom:12px">
            <input type="text" id="debtSearch" placeholder="🔍 Pretraži po imenu..." value="${debtSearch}" 
                oninput="debtSearch=this.value;render()" 
                style="width:100%;padding:10px 16px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
        </div>`;
    }
    
    switch(debtsTab) {
        case 'active': h += renderActiveDebts(active, byDebtor); break;
        case 'cleared': h += renderClearedDebts(cleared); break;
        case 'deleted': h += renderDeletedDebts(deleted); break;
    }
    
    c.innerHTML = h;
}

// ============================================
// TAB: ACTIVE DEBTS
// ============================================
function renderActiveDebts(active, byDebtor) {
    let h = '';
    
    if (active.length === 0) {
        return `<div class="empty">
            <div style="font-size:64px">✅</div>
            <h3>Nema aktivnih dugovanja</h3>
            <p>Svi su podmirili račune</p>
        </div>`;
    }
    
    const sortedDebtors = Object.entries(byDebtor).sort((a, b) => b[1].total - a[1].total);
    
    sortedDebtors.forEach(([name, data]) => {
        if (debtSearch && !name.toLowerCase().includes(debtSearch.toLowerCase())) return;
        
        h += `<div class="card" style="margin-bottom:12px;border-left:4px solid #E94560">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <div>
                    <h3 style="font-size:18px">👤 ${name}</h3>
                    <span style="color:#888;font-size:12px">${data.debts.length} ${data.debts.length === 1 ? 'dugovanje' : 'dugovanja'}</span>
                </div>
                <div style="text-align:right">
                    <div style="font-size:22px;font-weight:bold;color:#E94560">${data.total.toFixed(0)} din</div>
                    <button class="btn" style="width:auto;padding:4px 12px;background:#4CAF50;font-size:12px;margin-top:4px" 
                        onclick="payAllDebts('${name.replace(/'/g, "\\'")}')">💰 Vrati Sve</button>
                </div>
            </div>`;
        
        data.debts.sort((a, b) => new Date(b.time) - new Date(a.time));
        data.debts.forEach(debt => {
            const date = new Date(debt.time);
            const dateStr = date.toLocaleDateString('sr-RS', {day:'2-digit', month:'2-digit'});
            const timeStr = date.toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'});
            const itemNames = debt.items ? debt.items.map(i => i.qty + 'x ' + i.name).join(', ') : '';
            
            h += `<div style="background:#16213E;padding:10px 12px;border-radius:8px;margin-bottom:6px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="flex:1;min-width:0">
                        <div style="font-size:13px;font-weight:bold;color:#FFD700">${debt.remaining.toFixed(0)} din${debt.remaining < debt.originalTotal ? ` <span style="color:#4CAF50;font-size:11px">(od ${debt.originalTotal.toFixed(0)})</span>` : ''}</div>
                        <div style="color:#888;font-size:11px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${itemNames}">
                            ${debt.tableName || 'Sto'} · ${dateStr} ${timeStr}${itemNames ? ' · ' + itemNames : ''}
                        </div>
                    </div>
                    <div style="display:flex;gap:6px;margin-left:8px">
                        <button onclick="payPartialDebt('${debt.id}')" style="background:#FF9800;border:none;color:#FFF;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold" title="Uplati deo">💰</button>
                        <button onclick="payFullDebt('${debt.id}')" style="background:#4CAF50;border:none;color:#FFF;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold" title="Vrati ceo dug">✅</button>
                        <button onclick="deleteDebt('${debt.id}')" style="background:#E94560;border:none;color:#FFF;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold" title="Obriši (bez naplate)">🗑️</button>
                    </div>
                </div>
            </div>`;
        });
        
        h += '</div>';
    });
    
    return h;
}

// ============================================
// TAB: CLEARED (PAID) DEBTS
// ============================================
function renderClearedDebts(cleared) {
    if (cleared.length === 0) {
        return `<div class="empty">
            <div style="font-size:64px">📜</div>
            <h3>Nema vraćenih dugovanja</h3>
            <p>Ovde će se pojaviti dugovi koji su podmireni</p>
        </div>`;
    }
    
    let h = '';
    const sorted = [...cleared].sort((a, b) => new Date(b.clearedAt || b.time) - new Date(a.clearedAt || a.time));
    
    sorted.forEach(debt => {
        if (debtSearch && !(debt.debtorName || '').toLowerCase().includes(debtSearch.toLowerCase())) return;
        
        const createdDate = new Date(debt.time);
        const clearedDate = new Date(debt.clearedAt || debt.time);
        const createdStr = createdDate.toLocaleDateString('sr-RS', {day:'2-digit', month:'2-digit', year:'numeric'}) + ' ' + createdDate.toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'});
        const clearedStr = clearedDate.toLocaleDateString('sr-RS', {day:'2-digit', month:'2-digit', year:'numeric'}) + ' ' + clearedDate.toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'});
        const itemNames = debt.items ? debt.items.map(i => i.qty + 'x ' + i.name).join(', ') : '';
        
        // Payments history
        const payments = debt.payments ? debt.payments.filter(p => p.method !== 'init') : [];
        let paymentsHtml = '';
        if (payments.length > 0) {
            paymentsHtml = '<div style="margin-top:8px;border-top:1px solid #2A2A4A;padding-top:8px">';
            paymentsHtml += '<div style="color:#888;font-size:11px;margin-bottom:4px;font-weight:bold">Uplate:</div>';
            payments.forEach(p => {
                const pDate = new Date(p.date);
                const pStr = pDate.toLocaleDateString('sr-RS', {day:'2-digit', month:'2-digit'}) + ' ' + pDate.toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'});
                paymentsHtml += `<div style="display:flex;justify-content:space-between;font-size:12px;color:#B0B0B0;padding:2px 0">
                    <span>${pStr} · ${p.method === 'Cash' ? '💵' : '💳'} ${p.method} · ${p.by || ''}</span>
                    <span style="color:#4CAF50;font-weight:bold">${(p.amount || 0).toFixed(0)} din</span>
                </div>`;
            });
            paymentsHtml += '</div>';
        }
        
        h += `<div class="card" style="margin-bottom:8px;border-left:4px solid #4CAF50">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div style="flex:1;min-width:0">
                    <div style="font-size:16px;font-weight:bold">👤 ${debt.debtorName} <span style="color:#4CAF50;font-size:13px">✅ Podmireno</span></div>
                    <div style="color:#888;font-size:12px;margin-top:4px">${debt.tableName || 'Sto'} · Zapisano: ${createdStr}</div>
                    <div style="color:#4CAF50;font-size:12px">Vraćeno: ${clearedStr}</div>
                    ${itemNames ? `<div style="color:#888;font-size:11px;margin-top:4px">${itemNames}</div>` : ''}
                    ${paymentsHtml}
                </div>
                <div style="text-align:right;margin-left:12px">
                    <div style="font-size:20px;font-weight:bold;color:#4CAF50">${(debt.originalTotal || 0).toFixed(0)} din</div>
                    <div style="color:#888;font-size:11px">Ukupno</div>
                </div>
            </div>
        </div>`;
    });
    
    return h;
}

// ============================================
// TAB: DELETED DEBTS
// ============================================
function renderDeletedDebts(deleted) {
    if (deleted.length === 0) {
        return `<div class="empty">
            <div style="font-size:64px">🗑️</div>
            <h3>Nema obrisanih dugovanja</h3>
            <p>Dugovi koji se obrišu bez naplate pojave se ovde</p>
        </div>`;
    }
    
    let h = '';
    const sorted = [...deleted].sort((a, b) => new Date(b.deletedAt || b.time) - new Date(a.deletedAt || a.time));
    
    sorted.forEach(debt => {
        if (debtSearch && !(debt.debtorName || '').toLowerCase().includes(debtSearch.toLowerCase())) return;
        
        const createdDate = new Date(debt.time);
        const deletedDate = new Date(debt.deletedAt || debt.time);
        const createdStr = createdDate.toLocaleDateString('sr-RS', {day:'2-digit', month:'2-digit', year:'numeric'}) + ' ' + createdDate.toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'});
        const deletedStr = deletedDate.toLocaleDateString('sr-RS', {day:'2-digit', month:'2-digit', year:'numeric'}) + ' ' + deletedDate.toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'});
        const itemNames = debt.items ? debt.items.map(i => i.qty + 'x ' + i.name).join(', ') : '';
        
        h += `<div class="card" style="margin-bottom:8px;border-left:4px solid #888;opacity:0.8">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div style="flex:1;min-width:0">
                    <div style="font-size:16px;font-weight:bold">👤 ${debt.debtorName} <span style="color:#888;font-size:13px">🗑️ Obrisano</span></div>
                    <div style="color:#888;font-size:12px;margin-top:4px">${debt.tableName || 'Sto'} · Zapisano: ${createdStr}</div>
                    <div style="color:#E94560;font-size:12px">Obrisano: ${deletedStr}${debt.deletedBy ? ' · ' + debt.deletedBy : ''}</div>
                    ${itemNames ? `<div style="color:#888;font-size:11px;margin-top:4px">${itemNames}</div>` : ''}
                </div>
                <div style="text-align:right;margin-left:12px">
                    <div style="font-size:20px;font-weight:bold;color:#888;text-decoration:line-through">${(debt.originalTotal || 0).toFixed(0)} din</div>
                    <button onclick="restoreDebt('${debt.id}')" class="btn" style="width:auto;padding:4px 10px;background:#FF9800;font-size:11px;margin-top:4px">♻️ Vrati</button>
                </div>
            </div>
        </div>`;
    });
    
    return h;
}


// ============================================
// CREATE DEBT FROM PAYMENT
// ============================================
function showDebtModal() {
    // Get existing debtor names for autocomplete
    const existingNames = [...new Set((DB.debts || []).filter(d => d.remaining > 0 && !d.deleted).map(d => d.debtorName).filter(Boolean))];
    
    const modal = document.createElement('div');
    modal.id = 'debtModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1001;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    let nameButtons = '';
    if (existingNames.length > 0) {
        nameButtons = '<div style="margin-bottom:12px"><div style="color:#888;font-size:12px;margin-bottom:6px">Postojeći dužnici:</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
        existingNames.forEach(name => {
            nameButtons += `<button onclick="document.getElementById('debtorNameInput').value='${name.replace(/'/g, "\\'")}'" 
                style="background:#0F3460;border:1px solid #2A2A4A;color:#FFD700;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:13px">
                👤 ${name}
            </button>`;
        });
        nameButtons += '</div></div>';
    }
    
    modal.innerHTML = `<div style="background:#1A1A2E;padding:24px;border-radius:16px;width:100%;max-width:400px">
        <h3 style="color:#E94560;margin-bottom:16px">📝 Zapiši Dug</h3>
        ${nameButtons}
        <div style="margin-bottom:16px">
            <label style="color:#888;font-size:12px;display:block;margin-bottom:4px">Ime dužnika</label>
            <input type="text" id="debtorNameInput" placeholder="Unesite ime..." autofocus
                style="width:100%;padding:12px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:16px">
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" style="flex:1" onclick="this.closest('#debtModal').remove()">Otkaži</button>
            <button class="btn" style="flex:1;background:#E94560" onclick="confirmDebtPayment()">📝 Zapiši</button>
        </div>
    </div>`;
    
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('debtorNameInput')?.focus(), 100);
}

function confirmDebtPayment() {
    const nameInput = document.getElementById('debtorNameInput');
    const debtorName = nameInput ? nameInput.value.trim() : '';
    
    if (!debtorName) {
        showAlert('⚠️ Unesite ime dužnika!');
        return;
    }
    
    // Remove modal
    const modal = document.getElementById('debtModal');
    if (modal) modal.remove();
    
    const table = DB.tables.find(t => t.num === DB.selectedTable);
    if (!table) return;
    
    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    
    let myOrder = table.order;
    if (isWaiter) {
        myOrder = table.order.filter(item => !item.createdBy || item.createdBy === currentUsername);
    }
    
    const sub = myOrder.reduce((s, i) => s + (i.price * i.qty), 0);
    
    let discountAmount = 0;
    if (table.discountPercent > 0 && table.discountedItems && table.discountedItems.length > 0) {
        myOrder.forEach(item => {
            if (table.discountedItems.includes(item.id)) {
                discountAmount += (item.price * item.qty * table.discountPercent / 100);
            }
        });
    }
    
    const tot = Math.max(0, sub - discountAmount);
    
    // Create debt record
    if (!DB.debts) DB.debts = [];
    const debt = {
        id: 'debt_' + Date.now(),
        debtorName: debtorName,
        table: table.num,
        tableName: table.name || ('Sto ' + table.num),
        items: [...myOrder],
        sub: sub,
        disc: discountAmount,
        originalTotal: tot,
        remaining: tot,
        payments: [{amount: 0, method: 'init', date: new Date().toISOString(), by: 'system'}],
        createdBy: DB.konobarName || DB.currentUser.username,
        time: new Date().toISOString(),
        clearedAt: null
    };
    
    DB.debts.push(debt);
    
    // Oduzmi iz lagera (jer je roba izdata)
    if (typeof deductInventoryOnPayment === 'function') {
        deductInventoryOnPayment(myOrder);
    }
    
    // Očisti sto
    if (isWaiter) {
        table.order = table.order.filter(item => item.createdBy !== currentUsername);
    } else {
        table.order = [];
        table.discount = 0;
        table.discountPercent = 0;
        table.discountedItems = [];
    }
    
    save();
    
    showAlert(`📝 Dug zapisan!\n\n👤 ${debtorName}\n💰 ${tot.toFixed(0)} din`);
    page = 'tables';
    DB.selectedTable = null;
    render();
}


// ============================================
// PAY DEBTS
// ============================================
function payFullDebt(debtId) {
    const debt = DB.debts.find(d => d.id === debtId);
    if (!debt || debt.remaining <= 0) return;
    
    showConfirm('💰 Vrati Dug', 
        `Da li ${debt.debtorName} vraća ${debt.remaining.toFixed(0)} din?\n\nBiće dodato u dnevni pazar.`,
        (confirmed) => {
            if (!confirmed) return;
            showDebtPaymentMethod(debtId, debt.remaining);
        }
    );
}

function payPartialDebt(debtId) {
    const debt = DB.debts.find(d => d.id === debtId);
    if (!debt || debt.remaining <= 0) return;
    
    const modal = document.createElement('div');
    modal.id = 'partialDebtModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1001;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `<div style="background:#1A1A2E;padding:24px;border-radius:16px;width:100%;max-width:360px">
        <h3 style="color:#FF9800;margin-bottom:4px">💰 Delimična Uplata</h3>
        <p style="color:#888;font-size:13px;margin-bottom:16px">👤 ${debt.debtorName} · Duguje: <strong style="color:#E94560">${debt.remaining.toFixed(0)} din</strong></p>
        <div style="margin-bottom:16px">
            <label style="color:#888;font-size:12px;display:block;margin-bottom:4px">Iznos uplate</label>
            <input type="number" id="partialDebtAmount" placeholder="${debt.remaining.toFixed(0)}" min="1" max="${debt.remaining}" step="1"
                style="width:100%;padding:12px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:20px;text-align:center;font-weight:bold">
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" style="flex:1" onclick="this.closest('#partialDebtModal').remove()">Otkaži</button>
            <button class="btn" style="flex:1;background:#FF9800" onclick="confirmPartialDebt('${debtId}')">💰 Uplati</button>
        </div>
    </div>`;
    
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('partialDebtAmount')?.focus(), 100);
}

function confirmPartialDebt(debtId) {
    const debt = DB.debts.find(d => d.id === debtId);
    if (!debt) return;
    
    const amountInput = document.getElementById('partialDebtAmount');
    const amount = parseFloat(amountInput?.value) || 0;
    
    if (amount <= 0) { showAlert('⚠️ Unesite iznos!'); return; }
    if (amount > debt.remaining) { showAlert('⚠️ Iznos ne može biti veći od duga!'); return; }
    
    const modal = document.getElementById('partialDebtModal');
    if (modal) modal.remove();
    
    showDebtPaymentMethod(debtId, amount);
}

function showDebtPaymentMethod(debtId, amount) {
    const debt = DB.debts.find(d => d.id === debtId);
    if (!debt) return;
    
    const modal = document.createElement('div');
    modal.id = 'debtPayMethodModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1001;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `<div style="background:#1A1A2E;padding:24px;border-radius:16px;width:100%;max-width:360px;text-align:center">
        <h3 style="color:#4CAF50;margin-bottom:4px">💰 Uplata: ${amount.toFixed(0)} din</h3>
        <p style="color:#888;font-size:13px;margin-bottom:20px">👤 ${debt.debtorName}</p>
        <div style="display:flex;gap:12px;margin-bottom:16px">
            <div onclick="processDebtPayment('${debtId}', ${amount}, 'Cash');this.closest('#debtPayMethodModal').remove()" 
                style="flex:1;background:#16213E;border:2px solid #2A2A4A;border-radius:12px;padding:20px;cursor:pointer;text-align:center;transition:border-color 0.2s"
                onmouseover="this.style.borderColor='#4CAF50'" onmouseout="this.style.borderColor='#2A2A4A'">
                <div style="font-size:36px">💵</div>
                <div style="color:#FFF;font-weight:bold;margin-top:4px">Cash</div>
            </div>
            <div onclick="processDebtPayment('${debtId}', ${amount}, 'Card');this.closest('#debtPayMethodModal').remove()"
                style="flex:1;background:#16213E;border:2px solid #2A2A4A;border-radius:12px;padding:20px;cursor:pointer;text-align:center;transition:border-color 0.2s"
                onmouseover="this.style.borderColor='#4CAF50'" onmouseout="this.style.borderColor='#2A2A4A'">
                <div style="font-size:36px">💳</div>
                <div style="color:#FFF;font-weight:bold;margin-top:4px">Card</div>
            </div>
        </div>
        <button class="btn btn-secondary" style="width:100%" onclick="this.closest('#debtPayMethodModal').remove()">Otkaži</button>
    </div>`;
    
    document.body.appendChild(modal);
}

function processDebtPayment(debtId, amount, method) {
    const debt = DB.debts.find(d => d.id === debtId);
    if (!debt) return;
    
    if (!debt.payments) debt.payments = [];
    amount = Math.min(amount, debt.remaining);
    
    // Record payment
    debt.payments.push({
        amount: amount,
        method: method,
        date: new Date().toISOString(),
        by: DB.konobarName || (DB.currentUser ? DB.currentUser.username : 'admin')
    });
    
    debt.remaining = Math.max(0, debt.remaining - amount);
    
    if (debt.remaining <= 0) {
        debt.clearedAt = new Date().toISOString();
    }
    
    // Dodaj u dnevni pazar kao narudžbinu
    const orderItems = (debt.remaining <= 0 && debt.items && debt.items.length > 0) 
        ? debt.items 
        : [{name: 'Vraćen dug - ' + debt.debtorName, price: amount, qty: 1}];
    
    DB.orders.push({
        id: Date.now(),
        table: debt.table || 0,
        tableName: debt.tableName || 'Dug',
        items: orderItems,
        sub: amount,
        disc: 0,
        discountPercent: 0,
        discountedItems: [],
        tot: amount,
        method: method,
        createdBy: DB.konobarName || (DB.currentUser ? DB.currentUser.username : 'admin'),
        time: new Date().toISOString(),
        isDebtPayment: true,
        debtorName: debt.debtorName,
        debtId: debt.id
    });
    
    save();
    
    const remainMsg = debt.remaining > 0 ? `\nPreostali dug: ${debt.remaining.toFixed(0)} din` : '\n✅ Dug potpuno podmiren!';
    showAlert(`💰 Uplata primljena!\n\n👤 ${debt.debtorName}\n💵 ${amount.toFixed(0)} din (${method})${remainMsg}`);
    render();
}


// ============================================
// PAY ALL DEBTS FOR A DEBTOR
// ============================================
function payAllDebts(debtorName) {
    const debts = DB.debts.filter(d => d.debtorName === debtorName && d.remaining > 0 && !d.deleted);
    if (debts.length === 0) return;
    
    const total = debts.reduce((s, d) => s + d.remaining, 0);
    
    showConfirm('💰 Vrati Sve Dugove', 
        `Da li ${debtorName} vraća sva dugovanja?\n\nUkupno: ${total.toFixed(0)} din\n(${debts.length} ${debts.length === 1 ? 'dugovanje' : 'dugovanja'})`,
        (confirmed) => {
            if (!confirmed) return;
            
            // Show payment method for total
            const modal = document.createElement('div');
            modal.id = 'debtPayAllModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1001;display:flex;align-items:center;justify-content:center;padding:16px';
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
            
            modal.innerHTML = `<div style="background:#1A1A2E;padding:24px;border-radius:16px;width:100%;max-width:360px;text-align:center">
                <h3 style="color:#4CAF50;margin-bottom:4px">💰 Ukupno: ${total.toFixed(0)} din</h3>
                <p style="color:#888;font-size:13px;margin-bottom:20px">👤 ${debtorName} · ${debts.length} dugovanja</p>
                <div style="display:flex;gap:12px;margin-bottom:16px">
                    <div onclick="processAllDebtPayments('${debtorName.replace(/'/g, "\\'")}', 'Cash');this.closest('#debtPayAllModal').remove()" 
                        style="flex:1;background:#16213E;border:2px solid #2A2A4A;border-radius:12px;padding:20px;cursor:pointer;text-align:center"
                        onmouseover="this.style.borderColor='#4CAF50'" onmouseout="this.style.borderColor='#2A2A4A'">
                        <div style="font-size:36px">💵</div><div style="color:#FFF;font-weight:bold;margin-top:4px">Cash</div>
                    </div>
                    <div onclick="processAllDebtPayments('${debtorName.replace(/'/g, "\\'")}', 'Card');this.closest('#debtPayAllModal').remove()"
                        style="flex:1;background:#16213E;border:2px solid #2A2A4A;border-radius:12px;padding:20px;cursor:pointer;text-align:center"
                        onmouseover="this.style.borderColor='#4CAF50'" onmouseout="this.style.borderColor='#2A2A4A'">
                        <div style="font-size:36px">💳</div><div style="color:#FFF;font-weight:bold;margin-top:4px">Card</div>
                    </div>
                </div>
                <button class="btn btn-secondary" style="width:100%" onclick="this.closest('#debtPayAllModal').remove()">Otkaži</button>
            </div>`;
            
            document.body.appendChild(modal);
        }
    );
}

function processAllDebtPayments(debtorName, method) {
    const debts = DB.debts.filter(d => d.debtorName === debtorName && d.remaining > 0 && !d.deleted);
    let totalPaid = 0;
    
    debts.forEach(debt => {
        const amount = debt.remaining;
        totalPaid += amount;
        
        if (!debt.payments) debt.payments = [];
        debt.payments.push({
            amount: amount,
            method: method,
            date: new Date().toISOString(),
            by: DB.konobarName || (DB.currentUser ? DB.currentUser.username : 'admin')
        });
        
        debt.remaining = 0;
        debt.clearedAt = new Date().toISOString();
    });
    
    // Jedan zbirni unos u pazar
    DB.orders.push({
        id: Date.now(),
        table: 0,
        tableName: 'Vraćen dug',
        items: [{name: 'Vraćen dug - ' + debtorName + ' (' + debts.length + ' dugovanja)', price: totalPaid, qty: 1}],
        sub: totalPaid,
        disc: 0,
        discountPercent: 0,
        discountedItems: [],
        tot: totalPaid,
        method: method,
        createdBy: DB.konobarName || (DB.currentUser ? DB.currentUser.username : 'admin'),
        time: new Date().toISOString(),
        isDebtPayment: true,
        debtorName: debtorName
    });
    
    save();
    showAlert(`✅ Sva dugovanja podmirena!\n\n👤 ${debtorName}\n💵 ${totalPaid.toFixed(0)} din (${method})`);
    render();
}


// ============================================
// DELETE DEBT (without adding to revenue)
// ============================================
function deleteDebt(debtId) {
    const debt = DB.debts.find(d => d.id === debtId);
    if (!debt) return;
    
    showConfirm('🗑️ Obriši Dug', 
        `Obrisati dug od ${debt.debtorName} (${debt.remaining.toFixed(0)} din)?\n\n⚠️ Ovo NE dodaje u pazar - koristite samo ako je dug pogrešno unesen.\n\nDug ostaje vidljiv u tabu "Obrisana".`,
        (confirmed) => {
            if (!confirmed) return;
            debt.deleted = true;
            debt.deletedAt = new Date().toISOString();
            debt.deletedBy = DB.konobarName || (DB.currentUser ? DB.currentUser.username : 'admin');
            save();
            render();
            showAlert('🗑️ Dug obrisan. Možete ga videti u tabu "Obrisana".');
        }
    );
}

function restoreDebt(debtId) {
    const debt = DB.debts.find(d => d.id === debtId);
    if (!debt) return;
    
    showConfirm('♻️ Vrati Dug', 
        `Vratiti dug od ${debt.debtorName} (${(debt.originalTotal || 0).toFixed(0)} din) u aktivna dugovanja?`,
        (confirmed) => {
            if (!confirmed) return;
            debt.deleted = false;
            debt.deletedAt = null;
            debt.deletedBy = null;
            debt.remaining = debt.originalTotal || 0;
            save();
            debtsTab = 'active';
            render();
            showAlert('♻️ Dug vraćen u aktivna dugovanja.');
        }
    );
}
