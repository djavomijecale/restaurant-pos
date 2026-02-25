// ============================================
// TABLE MANAGEMENT & MENU DISPLAY
// ============================================


function renderTableSelect(c) {
    
    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    
    let h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px"><h2>🪑 Izaberi Sto</h2>';
    if(DB.currentUser) {
        h += '<button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="page=\'edittables\';render()">✏️ Izmeni Stolove</button>';
    }
    h += '</div><div class="table-grid">';
    
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
        const regularTables = DB.tables.filter(t => !t.isBar);
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
        h += `<div style="position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:#E94560;padding:12px 24px;border-radius:12px;box-shadow:0 4px 20px rgba(233,69,96,0.5);max-width:400px;width:90%">
            <div style="display:flex;justify-content:space-between;align-items:center">
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

