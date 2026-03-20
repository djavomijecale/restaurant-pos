// ============================================
// TABLE MANAGEMENT & MENU DISPLAY
// ============================================


function renderTableSelect(c) {
    
    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    
    let h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px"><h2>🪑 Izaberi Sto</h2><div style="display:flex;gap:8px">';
    h += '<button class="btn" style="width:auto;padding:8px 16px;background:#2E7D32" onclick="page=\'garden\';render()">🌿 Bašta</button>';
    if(DB.currentUser) {
        h += '<button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="page=\'edittables\';render()">✏️ Izmeni</button>';
    }
    h += '</div></div><div class="table-grid">';
    
    // Helper za dobijanje info o stolu
    function getTableInfo(t) {
        if (!t) return null;
        if (!t.order) t.order = [];
        
        let myItems = t.order;
        if (isWaiter) {
            myItems = t.order.filter(item => 
                !item.createdBy || item.createdBy === currentUsername
            );
        }
        
        const isOccupied = myItems && Array.isArray(myItems) && myItems.length > 0;
        const total = isOccupied ? myItems.reduce((s,i)=>s+(i.price*i.qty),0) : 0;
        
        let waiterIndicator = '';
        if (!isWaiter && t.order.length > 0) {
            const waitersOnTable = [...new Set(t.order.map(item => item.createdBy).filter(Boolean))];
            if (waitersOnTable.length > 0) {
                const waiterColors = ['#4CAF50', '#FF9800', '#9C27B0', '#2196F3', '#E91E63'];
                waiterIndicator = '<div style="display:flex;gap:4px;margin-top:4px;justify-content:center">';
                waitersOnTable.forEach((waiter, idx) => {
                    const color = waiterColors[idx % waiterColors.length];
                    waiterIndicator += `<span style="background:${color};color:#FFF;padding:2px 6px;border-radius:8px;font-size:10px;font-weight:bold">${waiter}</span>`;
                });
                waiterIndicator += '</div>';
            }
        }
        
        return { isOccupied, total, waiterIndicator };
    }
    
    if (DB.tables && Array.isArray(DB.tables)) {
        const regularTables = DB.tables.filter(t => !t.isBar && !t.isGarden);
        const barTables = DB.tables.filter(t => t.isBar);
        
        regularTables.forEach(t => {
            const info = getTableInfo(t);
            if (!info) return;
            
            h += `<div class="table-card ${info.isOccupied?'occupied':''}" data-table="${t.num}" onclick="selectTable(${t.num})">
                <div class="table-icon">🪑</div>
                <div class="table-number">${t.name || ('Sto ' + t.num)}</div>
                ${info.isOccupied ? `<div class="table-status">${info.total.toFixed(0)}din</div>` : ''}
                ${info.waiterIndicator}
            </div>`;
        });
        
        // Šank sa stolicama
        h += '<div class="bar-area"><span class="bar-label">🍺 ŠANK</span><div class="bar-stools">';
        barTables.forEach(t => {
            const info = getTableInfo(t);
            if (!info) return;
            
            h += `<div class="bar-stool ${info.isOccupied?'occupied':''}" onclick="selectTable(${t.num})">
                <div class="table-icon">🍺</div>
                <div class="table-number">${t.name || ('Šank ' + (t.num - 10))}</div>
                ${info.isOccupied ? `<div class="table-status">${info.total.toFixed(0)}din</div>` : ''}
            </div>`;
        });
        h += '</div></div>';
    }
    
    h += '</div>';
    c.innerHTML = h;
}


function selectTable(num) {
    DB.selectedTable = num;
    page = 'tables';
    render();
}

// ============================================
// BAŠTA - GARDEN TABLES
// ============================================
function renderGarden(c) {
    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    const gardenTables = DB.tables.filter(t => t.isGarden);
    
    function gInfo(t) {
        if (!t || !t.order) return { occ: false, tot: 0 };
        let items = isWaiter ? t.order.filter(i => !i.createdBy || i.createdBy === currentUsername) : t.order;
        const occ = items.length > 0;
        const tot = occ ? items.reduce((s,i) => s + ((parseFloat(i.price)||0) * (parseInt(i.qty)||0)), 0) : 0;
        return { occ, tot };
    }
    
    function gBtn(num) {
        const t = gardenTables.find(x => x.num === num);
        if (!t) return '';
        const info = gInfo(t);
        const name = t.name || ('B' + (num - 20));
        return `<div class="g-table ${info.occ ? 'g-occ' : ''}" onclick="selectTable(${num})">
            <div class="g-icon">🪑</div>
            <div class="g-name">${name}</div>
            ${info.occ ? `<div class="g-total">${info.tot.toFixed(0)}</div>` : ''}
        </div>`;
    }
    
    let h = `
    <style>
        .garden-wrap {
            position: relative;
            width: 100%;
            max-width: 520px;
            margin: 0 auto;
            aspect-ratio: 1 / 1.1;
            background: linear-gradient(180deg, #1B3A1B 0%, #0D260D 100%);
            border-radius: 16px;
            border: 2px solid #2E7D32;
            overflow: hidden;
            padding: 12px;
        }
        .garden-wrap::before {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(ellipse at 30% 20%, rgba(76,175,80,0.08) 0%, transparent 60%),
                        radial-gradient(ellipse at 70% 80%, rgba(76,175,80,0.05) 0%, transparent 50%);
            pointer-events: none;
        }
        .g-table {
            position: absolute;
            width: 64px; height: 64px;
            background: #1A3D1A;
            border: 2px solid #388E3C;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.15s;
            z-index: 2;
            -webkit-tap-highlight-color: transparent;
        }
        .g-table:active { transform: scale(0.93); }
        .g-table.g-occ {
            background: #2E4B1A;
            border-color: #FFD700;
            box-shadow: 0 0 12px rgba(255,215,0,0.25);
        }
        .g-icon { font-size: 18px; }
        .g-name { font-size: 10px; font-weight: 700; color: #A5D6A7; margin-top: 1px; }
        .g-occ .g-name { color: #FFD700; }
        .g-total { font-size: 10px; font-weight: 800; color: #FFD700; }
        .g-entrance {
            position: absolute;
            background: rgba(46,125,50,0.25);
            border: 1px dashed rgba(76,175,80,0.4);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255,255,255,0.35);
            font-size: 11px;
            font-weight: 600;
            z-index: 1;
            pointer-events: none;
        }
    </style>
    
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:12px">
            <button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="page='tables';DB.selectedTable=null;render()">← Unutra</button>
            <h2 style="color:#4CAF50">🌿 Bašta</h2>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#388E3C"></span><span style="color:#888;font-size:12px">Slobodan</span>
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#FFD700;margin-left:8px"></span><span style="color:#888;font-size:12px">Zauzet</span>
        </div>
    </div>
    
    <div class="garden-wrap">
        <!-- Ulaz -->
        <div class="g-entrance" style="left:2%;top:2%;width:18%;height:10%">🚪 Ulaz</div>
        
        <!-- Ulaz iz bašte -->
        <div class="g-entrance" style="left:28%;top:52%;width:22%;height:6%;font-size:10px">🌿 Ulaz iz bašte</div>
        
        <!-- Gornji levi: B1(21), B2(22) -->
        <div style="position:absolute;left:3%;top:3%">${gBtn(21)}</div>
        <div style="position:absolute;left:17%;top:3%">${gBtn(22)}</div>
        
        <!-- Gornji centar: B3(23) -->
        <div style="position:absolute;left:38%;top:2%">${gBtn(23)}</div>
        
        <!-- Desna kolona: B4(24) - B9(29) -->
        <div style="position:absolute;right:14%;top:4%">${gBtn(24)}</div>
        <div style="position:absolute;right:14%;top:16%">${gBtn(25)}</div>
        <div style="position:absolute;right:14%;top:28%">${gBtn(26)}</div>
        <div style="position:absolute;right:14%;top:40%">${gBtn(27)}</div>
        <div style="position:absolute;right:14%;top:52%">${gBtn(28)}</div>
        <div style="position:absolute;right:14%;top:64%">${gBtn(29)}</div>
        
        <!-- Srednji levi: B10(30) -->
        <div style="position:absolute;left:28%;top:30%">${gBtn(30)}</div>
        
        <!-- Blizu ulaza iz bašte: B11(31) -->
        <div style="position:absolute;left:28%;top:60%">${gBtn(31)}</div>
        
        <!-- Donji red: B12(32), B13(33), B14(34) -->
        <div style="position:absolute;left:28%;top:78%">${gBtn(32)}</div>
        <div style="position:absolute;left:46%;top:78%">${gBtn(33)}</div>
        <div style="position:absolute;left:64%;top:78%">${gBtn(34)}</div>
    </div>`;
    
    c.innerHTML = h;
}


function renderEditTables(c) {
    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="page='tables';render()">← Natrag</button>
        <h2>✏️ Izmeni Imena Stolova</h2>
        <div style="width:80px"></div>
    </div>`;
    
    DB.tables.forEach(t => {
        h += `<div class="card" style="cursor:default">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="flex:1">
                    <h3 style="color:#FFD700">Sto ${t.num}</h3>
                    <p style="color:#B0B0B0;font-size:13px">Trenutno ime: ${t.name}</p>
                </div>
                <button class="btn" style="width:auto;padding:8px 16px" onclick="editTableName(${t.num})">✏️ Promeni Ime</button>
            </div>
        </div>`;
    });
    
    c.innerHTML = h;
}


function editTableName(num) {
    editingTableNum = num;
    const table = DB.tables.find(t => t.num === num);
    document.getElementById('tableNameLabel').textContent = `Unesite novo ime za Sto ${num}:`;
    document.getElementById('tableNameInput').value = table.name;
    document.getElementById('tableNameModal').classList.add('show');
    document.getElementById('tableNameInput').focus();
}


function closeTableNameModal() {
    document.getElementById('tableNameModal').classList.remove('show');
    editingTableNum = null;
}


function saveTableName() {
    const newName = document.getElementById('tableNameInput').value.trim();
    if(!newName) {
        showAlert('Molimo unesite ime stola');
        return;
    }
    const table = DB.tables.find(t => t.num === editingTableNum);
    table.name = newName;
    save();
    closeTableNameModal();
    render();
}


function renderTableMenu(c) {
    const table = DB.tables.find(t=>t.num===DB.selectedTable);
    const cats = ['Sve', 'Hrana', 'Piće'];
    
    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    
    // Filtriraj samo stavke trenutnog konobara
    let myOrder = table.order;
    if (isWaiter) {
        myOrder = table.order.filter(item => 
            !item.createdBy || item.createdBy === currentUsername
        );
    }
    
    const sub = myOrder.reduce((s,i)=>s+(i.price*i.qty),0);
    
    // Izračunaj popust po novom sistemu (po artiklima)
    let discountAmount = 0;
    if(table.discountPercent > 0 && table.discountedItems && table.discountedItems.length > 0) {
        myOrder.forEach(item => {
            if(table.discountedItems.includes(item.id)) {
                discountAmount += (item.price * item.qty * table.discountPercent / 100);
            }
        });
    }
    const tot = Math.max(0, sub - discountAmount);
    
    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="DB.selectedTable=null;render()">← Stolovi</button>
        <h2>🪑 ${table.name}</h2>
        <button class="btn" style="width:auto;padding:8px 16px" onclick="page='tableorder';render()">Narudžba (${myOrder.length})</button>
    </div>`;
    
    // Category chips
    h += '<div style="margin:16px 0">';
    cats.forEach(cat => h += `<span class="chip ${DB.selectedCat===cat?'active':''}" onclick="filterCat('${cat}')">${cat}</span>`);
    h += '</div>';
    
    // Get groups based on selected category
    let groups = [];
    if(DB.selectedCat === 'Sve') {
        groups = [];
    } else if(DB.selectedCat === 'Hrana') {
        const hranaItems = DB.menu.filter(i => i.cat === 'Hrana');
        groups = ['Sve', ...new Set(hranaItems.map(i => i.group || 'Ostalo'))];
    } else if(DB.selectedCat === 'Piće') {
        const piceItems = DB.menu.filter(i => i.cat === 'Piće');
        groups = ['Sve', ...new Set(piceItems.map(i => i.group || 'Ostalo'))];
    }
    
    // Group chips
    if(groups.length > 1) {
        h += '<div style="margin:16px 0;border-top:2px solid #2A2A4A;padding-top:16px">';
        h += '<p style="color:#B0B0B0;font-size:13px;margin-bottom:8px">Grupe:</p>';
        groups.forEach(group => {
            h += `<span class="chip ${DB.selectedGroup===group?'active':''}" onclick="filterGroup('${group}')">${group}</span>`;
        });
        h += '</div>';
    }
    
    // Filter items
    let items = DB.menu;
    if(DB.selectedCat !== 'Sve') {
        items = items.filter(i => i.cat === DB.selectedCat);
    }
    if(DB.selectedGroup && DB.selectedGroup !== 'Sve') {
        items = items.filter(i => (i.group || 'Ostalo') === DB.selectedGroup);
    }
    
    // Display items
    h += '<div class="menu-items-container">';
    items.forEach(i => {
        // Odaberi emoji na osnovu kategorije/imena
        let emoji = '🍽️';
        if(i.cat === 'Hrana') {
            if(i.name.toLowerCase().includes('ćevap')) emoji = '🥙';
            else if(i.name.toLowerCase().includes('pileć')) emoji = '🍗';
            else if(i.name.toLowerCase().includes('šiš') || i.name.toLowerCase().includes('kebab')) emoji = '🍢';
            else if(i.name.toLowerCase().includes('burger')) emoji = '🍔';
            else if(i.name.toLowerCase().includes('pizza')) emoji = '🍕';
            else if(i.name.toLowerCase().includes('pljeskavic')) emoji = '🥩';
            else emoji = '🍽️';
        } else if(i.cat === 'Piće') {
            if(i.name.toLowerCase().includes('coca') || i.name.toLowerCase().includes('cola')) emoji = '🥤';
            else if(i.name.toLowerCase().includes('pivo')) emoji = '🍺';
            else if(i.name.toLowerCase().includes('ayran')) emoji = '🥛';
            else if(i.name.toLowerCase().includes('sok')) emoji = '🧃';
            else if(i.name.toLowerCase().includes('kafa') || i.name.toLowerCase().includes('coffee')) emoji = '☕';
            else if(i.name.toLowerCase().includes('voda')) emoji = '💧';
            else emoji = '🥤';
        } else if(i.cat === 'Dezert') {
            if(i.name.toLowerCase().includes('baklava')) emoji = '🍰';
            else if(i.name.toLowerCase().includes('tulumba')) emoji = '🍩';
            else if(i.name.toLowerCase().includes('sladoled')) emoji = '🍦';
            else emoji = '🍰';
        }
        
        h += `<div class="menu-item-card" onclick="addToTable(${i.id})">
            <div class="menu-item-icon">${emoji}</div>
            <div class="menu-item-details">
                <div class="menu-item-name">${i.name}</div>`;
        if(i.desc) {
            h += `<div class="menu-item-desc">${i.desc}</div>`;
        }
        if(i.group) {
            h += `<div class="menu-item-group">📁 ${i.group}</div>`;
        }
        h += `</div>
            <div class="menu-item-price">${i.price} din.</div>
        </div>`;
    });
    h += '</div>';
    
    if(myOrder.length > 0) {
        h += `<div style="position:sticky;bottom:0;background:#E94560;padding:12px 24px;border-radius:12px 12px 0 0;box-shadow:0 -4px 20px rgba(233,69,96,0.5);margin:16px -16px 0 -16px;z-index:100">
            <div style="display:flex;justify-content:space-between;align-items:center;max-width:500px;margin:0 auto">
                <div>
                    <div style="font-size:12px;opacity:0.9">${myOrder.length} stavki</div>
                    <div style="font-size:20px;font-weight:bold">${tot.toFixed(0)} din.</div>
                </div>
                <button class="btn" style="width:auto;background:#FFF;color:#E94560;padding:10px 20px" onclick="page='tableorder';render()">Narudžba →</button>
            </div>
        </div>`;
    }
    
    c.innerHTML = h;
}


function renderMenu(c) {
    // Fixed categories
    const cats = ['Sve', 'Hrana', 'Piće'];
    
    let h = '<h2>🍕 Menu - Katalog</h2>';
    
    // Category chips
    h += '<div style="margin:16px 0">';
    cats.forEach(cat => h += `<span class="chip ${DB.selectedCat===cat?'active':''}" onclick="filterCat('${cat}')">${cat}</span>`);
    h += '</div>';
    
    // Get groups based on selected category
    let groups = [];
    if(DB.selectedCat === 'Sve') {
        // Show all groups
        groups = ['Sve', ...new Set(DB.menu.map(i => i.cat + ':' + (i.group || 'Ostalo')))];
    } else if(DB.selectedCat === 'Hrana') {
        // Show only Hrana groups
        const hranaItems = DB.menu.filter(i => i.cat === 'Hrana');
        groups = ['Sve', ...new Set(hranaItems.map(i => i.group || 'Ostalo'))];
    } else if(DB.selectedCat === 'Piće') {
        // Show only Piće groups
        const piceItems = DB.menu.filter(i => i.cat === 'Piće');
        groups = ['Sve', ...new Set(piceItems.map(i => i.group || 'Ostalo'))];
    }
    
    // Group chips (only show if not 'Sve' category or if there are groups)
    if(groups.length > 1 && DB.selectedCat !== 'Sve') {
        h += '<div style="margin:16px 0;border-top:2px solid #2A2A4A;padding-top:16px">';
        h += '<p style="color:#B0B0B0;font-size:13px;margin-bottom:8px">Grupe:</p>';
        groups.forEach(group => {
            h += `<span class="chip ${DB.selectedGroup===group?'active':''}" onclick="filterGroup('${group}')">${group}</span>`;
        });
        h += '</div>';
    }
    
    // Filter items
    let items = DB.menu;
    
    // Filter by category
    if(DB.selectedCat !== 'Sve') {
        items = items.filter(i => i.cat === DB.selectedCat);
    }
    
    // Filter by group
    if(DB.selectedGroup && DB.selectedGroup !== 'Sve') {
        items = items.filter(i => (i.group || 'Ostalo') === DB.selectedGroup);
    }
    
    // Display items
    if(items.length === 0) {
        h += '<div class="empty"><p>Nema stavki u ovoj kategoriji/grupi</p></div>';
    } else {
        items.forEach(i => {
            h += `<div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <h3>${i.name}</h3>
                        <p style="color:#B0B0B0;font-size:13px">${i.desc || ''}</p>
                        ${i.group ? `<span style="color:#FFD700;font-size:11px">📁 ${i.group}</span>` : ''}
                    </div>
                    <div style="color:#FFD700;font-size:20px;font-weight:bold">${i.price} din.</div>
                </div>
            </div>`;
        });
    }
    c.innerHTML = h;
}


function filterCat(cat) { 
    DB.selectedCat = cat;
    DB.selectedGroup = 'Sve'; // Reset group when category changes
    render(); 
}


function filterGroup(group) {
    DB.selectedGroup = group;
    render();
}


function exportMenu() {
    if (!DB.menu || DB.menu.length === 0) {
        showAlert('Meni je prazan!');
        return;
    }

    // CSV header
    let csv = 'Naziv,Kategorija,Grupa,Cena,Opis\n';

    // Sort by category then group then name
    const sorted = [...DB.menu].sort((a, b) => {
        if (a.cat !== b.cat) return (a.cat || '').localeCompare(b.cat || '');
        if ((a.group || '') !== (b.group || '')) return (a.group || '').localeCompare(b.group || '');
        return a.name.localeCompare(b.name);
    });

    sorted.forEach(item => {
        const esc = (val) => {
            const s = String(val || '');
            return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
        };
        csv += esc(item.name) + ',' + esc(item.cat) + ',' + esc(item.group) + ',' + (item.price || 0) + ',' + esc(item.desc) + '\n';
    });

    // Download
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel to recognize Serbian chars
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meni_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
}

