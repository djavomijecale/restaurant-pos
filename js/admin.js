// ============================================
// ADMIN: USERS, MENU EDIT, SETTINGS
// ============================================


function renderUsers(c) {
    const waiters = DB.users.filter(u => u.role === 'konobar' || u.role === 'waiter');
    const cooks = DB.users.filter(u => u.role === 'kuvar');
    
    let h = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
            <h2>👥 Upravljanje Osobljem</h2>
            <button class="btn" style="width:auto;padding:8px 16px" onclick="addWaiter()">➕ Dodaj Osobu</button>
        </div>
        
        <p style="color:#B0B0B0;margin-bottom:20px">
            Ovde možete dodavati, menjati i brisati konobare i kuvare. Svaka osoba će imati pristup prema svojoj ulozi.
        </p>`;
    
    // KONOBARI
    h += `<div style="margin-bottom:32px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
            <h3 style="color:#FFD700;margin:0">👨‍🍳 Konobari</h3>
            <span style="background:#E94560;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold">${waiters.length}</span>
        </div>`;
    
    if(waiters.length === 0) {
        h += '<div class="card" style="text-align:center;padding:40px;opacity:0.6"><div style="font-size:48px;margin-bottom:12px">👨‍🍳</div><p style="color:#B0B0B0">Nema konobara</p></div>';
    } else {
        waiters.forEach(w => {
            // Proveri da li je konobar trenutno aktivan
            const isActive = DB.workdays && DB.workdays[w.username];
            
            // Statistika konobara
            const waiterOrders = DB.orders.filter(o => o.createdBy === w.username);
            const totalRevenue = waiterOrders.reduce((s,o)=>s+o.tot,0);
            const waiterRemoved = DB.removedItems.filter(r => r.removedBy === w.username);
            
            h += `<div class="card" style="cursor:default;${isActive ? 'border:2px solid #4CAF50' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:start">
                    <div style="flex:1">
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
                            <div style="font-size:48px">👨‍🍳</div>
                            <div>
                                <div style="display:flex;align-items:center;gap:8px">
                                    <h3 style="color:#FFD700">${w.username}</h3>`;
                                    if(isActive) {
                                        h += `<span style="background:#4CAF50;color:#FFF;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:bold">🟢 AKTIVAN</span>`;
                                    } else {
                                        h += `<span style="background:#666;color:#FFF;padding:4px 12px;border-radius:12px;font-size:11px">⚪ OFFLINE</span>`;
                                    }
                                    h += `
                                </div>
                                <p style="color:#B0B0B0;font-size:13px">Šifra: ${'•'.repeat(w.password.length)}</p>
                            </div>
                        </div>
                        
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:12px">
                            <div style="background:#16213E;padding:8px;border-radius:6px;text-align:center">
                                <div style="color:#B0B0B0;font-size:11px">Narudžbi</div>
                                <div style="color:#4CAF50;font-size:18px;font-weight:bold">${waiterOrders.length}</div>
                            </div>
                            <div style="background:#16213E;padding:8px;border-radius:6px;text-align:center">
                                <div style="color:#B0B0B0;font-size:11px">Prihod</div>
                                <div style="color:#FFD700;font-size:18px;font-weight:bold">${totalRevenue.toFixed(0)}</div>
                            </div>
                            <div style="background:#16213E;padding:8px;border-radius:6px;text-align:center">
                                <div style="color:#B0B0B0;font-size:11px">Uklonjeno</div>
                                <div style="color:#FF9800;font-size:18px;font-weight:bold">${waiterRemoved.length}</div>
                            </div>
                            <div style="background:#4CAF50;padding:8px;border-radius:6px;text-align:center">
                                <div style="color:#FFF;font-size:11px">💰 Satnica</div>
                                <div style="color:#FFD700;font-size:18px;font-weight:bold">${w.hourlyRate || 350}</div>
                                <div style="color:#FFF;font-size:10px">din/sat</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display:flex;gap:8px">
                        <button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="editWaiter('${w.username}')">✏️ Izmeni</button>
                        <button class="btn" style="width:auto;padding:8px 16px;background:#E94560" onclick="deleteWaiter('${w.username}')">🗑️ Obriši</button>
                    </div>
                </div>
                ${isActive ? `<div style="margin-top:8px"><button class="btn" style="width:100%;background:#FF9800;padding:10px" onclick="adminCloseShift('${w.username}')">🔒 Zatvori Smenu za ${w.username}</button></div>` : ''}
            </div>`;
        });
    }
    
    h += '</div>';
    
    // KUVARI
    h += `<div style="margin-bottom:32px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
            <h3 style="color:#FFD700;margin:0">🍳 Kuvari</h3>
            <span style="background:#FF9800;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold">${cooks.length}</span>
        </div>`;
    
    if(cooks.length === 0) {
        h += '<div class="card" style="text-align:center;padding:40px;opacity:0.6"><div style="font-size:48px;margin-bottom:12px">🍳</div><p style="color:#B0B0B0">Nema kuvara</p></div>';
    } else {
        cooks.forEach(w => {
            // Proveri da li je kuvar trenutno aktivan
            const isActive = DB.workdays && DB.workdays[w.username];
            const activeShiftStart = isActive && DB.workdays[w.username].startTime ? DB.workdays[w.username].startTime : null;

            // Statistika kuvara - broj kuhinjskih narudžbina
            const cookOrders = DB.kitchenOrders.filter(ko => ko.status === 'completed');
            const groceryRequests = DB.groceryList.filter(g => g.needed && g.requestedBy && g.requestedBy.includes(w.username));

            // Real-time brojač jela u tekućoj smeni (od otvaranja smene do sad)
            let dishesThisShift = 0;
            let ordersThisShift = 0;
            if (activeShiftStart) {
                const shiftKitchen = (DB.kitchenOrders || []).filter(ko =>
                    (ko.status === 'completed' || ko.status === 'ready') &&
                    ko.orderedAt && ko.orderedAt >= activeShiftStart
                );
                ordersThisShift = shiftKitchen.length;
                dishesThisShift = shiftKitchen.reduce((sum, ko) =>
                    sum + (ko.items || []).reduce((s, i) => s + (i.qty || 0), 0), 0);
            }
            
            h += `<div class="card" style="cursor:default;${isActive ? 'border:2px solid #4CAF50' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:start">
                    <div style="flex:1">
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
                            <div style="font-size:48px">🍳</div>
                            <div>
                                <div style="display:flex;align-items:center;gap:8px">
                                    <h3 style="color:#FFD700">${w.username}</h3>`;
                                    if(isActive) {
                                        h += `<span style="background:#4CAF50;color:#FFF;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:bold">🟢 AKTIVAN</span>`;
                                    } else {
                                        h += `<span style="background:#666;color:#FFF;padding:4px 12px;border-radius:12px;font-size:11px">⚪ OFFLINE</span>`;
                                    }
                                    h += `
                                </div>
                                <p style="color:#B0B0B0;font-size:13px">Šifra: ${'•'.repeat(w.password.length)}</p>
                            </div>
                        </div>
                        
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:12px">
                            ${isActive ? `
                            <div style="background:#0F3460;padding:8px;border-radius:6px;text-align:center;border:1px solid #FFD700">
                                <div style="color:#FFD700;font-size:11px">🍽️ Jela u smeni</div>
                                <div style="color:#FFD700;font-size:20px;font-weight:bold">${dishesThisShift}</div>
                                <div style="color:#B0B0B0;font-size:10px">${ordersThisShift} porudžbina</div>
                            </div>` : ''}
                            <div style="background:#16213E;padding:8px;border-radius:6px;text-align:center">
                                <div style="color:#B0B0B0;font-size:11px">Jela Spremljenih</div>
                                <div style="color:#4CAF50;font-size:18px;font-weight:bold">${cookOrders.length}</div>
                            </div>
                            <div style="background:#16213E;padding:8px;border-radius:6px;text-align:center">
                                <div style="color:#B0B0B0;font-size:11px">Zahteva Nabavke</div>
                                <div style="color:#FF9800;font-size:18px;font-weight:bold">${groceryRequests.length}</div>
                            </div>
                            <div style="background:#4CAF50;padding:8px;border-radius:6px;text-align:center">
                                <div style="color:#FFF;font-size:11px">💰 Satnica</div>
                                <div style="color:#FFD700;font-size:18px;font-weight:bold">${w.hourlyRate || 350}</div>
                                <div style="color:#FFF;font-size:10px">din/sat</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display:flex;gap:8px">
                        <button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="editWaiter('${w.username}')">✏️ Izmeni</button>
                        <button class="btn" style="width:auto;padding:8px 16px;background:#E94560" onclick="deleteWaiter('${w.username}')">🗑️ Obriši</button>
                    </div>
                </div>
            </div>`;
        });
    }
    
    h += '</div>';
    
    c.innerHTML = h;
}


function addWaiter() {
    openWaiterModal('add');
}


function editWaiter(username) {
    openWaiterModal('edit', username);
}


function deleteWaiter(username) {
    const user = DB.users.find(u => u.username === username);
    if(!user) return;
    
    const roleLabel = user.role === 'kuvar' ? 'kuvara' : 'konobara';
    const userOrders = DB.orders.filter(o => o.createdBy === username);
    
    let confirmMsg = `Da li ste sigurni da želite da obrišete ${roleLabel} "${username}"?`;
    if(userOrders.length > 0) {
        confirmMsg += `\n\nOvaj ${roleLabel} ima ${userOrders.length} narudžbina u sistemu. Narudžbine će ostati sačuvane, ali neće više biti povezane sa ovim ${roleLabel}.`;
    }
    
    showConfirm(`Brisanje ${roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)}`, confirmMsg, (confirmed) => {
        if(confirmed) {
            DB.users = DB.users.filter(u => u.username !== username);
            // ✅ Obriši i workday ako je aktivan
            if (DB.workdays && DB.workdays[username]) {
                removeWorkday(username);
            }
            save();
            render();
            showAlert(`✅ ${roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)} je obrisan`);
        }
    });
}


function renderEdit(c) {
    if (!window.editMenuSearch) window.editMenuSearch = '';
    let h = '<div style="display:flex;justify-content:space-between;margin-bottom:16px"><h2>✏️ Izmeni Menu</h2><div><button class="btn btn-secondary" style="width:auto;padding:8px 16px;margin-right:8px" onclick="exportMenu()">📥 Export</button><button class="btn btn-secondary" style="width:auto;padding:8px 16px;margin-right:8px" onclick="importCSV()">⬆ Import</button><button class="btn" style="width:auto;padding:8px 16px" onclick="addMenuItem()">+ Dodaj</button></div></div>';
    h += '<div style="margin-bottom:16px"><input type="text" id="editMenuSearchInput" placeholder="Pretraži artikle..." value="' + window.editMenuSearch.replace(/"/g, '&quot;') + '" oninput="window.editMenuSearch=this.value;render()" style="width:100%;padding:12px 16px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px"></div>';
    const searchTerm = window.editMenuSearch.toLowerCase();
    const filteredMenu = searchTerm ? DB.menu.filter(function(i) { return i.name.toLowerCase().includes(searchTerm) || (i.cat && i.cat.toLowerCase().includes(searchTerm)) || (i.group && i.group.toLowerCase().includes(searchTerm)); }) : DB.menu;
    if (searchTerm) h += '<div style="color:#888;font-size:13px;margin-bottom:12px">' + filteredMenu.length + ' od ' + DB.menu.length + ' artikala</div>';
    filteredMenu.forEach(i => {
        h += `<div class="card" style="cursor:default">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="flex:1">
                    <span style="background:#E94560;color:white;padding:2px 8px;border-radius:4px;font-size:11px">${i.cat}</span>
                    ${i.group ? `<span style="background:#0F3460;color:#B0B0B0;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:4px">📂 ${i.group}</span>` : ''}
                    <h3 style="margin-top:8px">${i.name}</h3>
                    ${i.desc?'<p style="color:#B0B0B0;font-size:13px">'+i.desc+'</p>':''}
                </div>
                <div style="display:flex;gap:12px;align-items:center">
                    <span style="color:#FFD700;font-size:20px;font-weight:bold">${i.price} din.</span>
                    <button onclick="editItem(${i.id})" style="background:transparent;border:none;cursor:pointer;font-size:20px">✏️</button>
                    <button onclick="deleteItem(${i.id})" style="background:transparent;border:none;cursor:pointer;font-size:20px;color:#E94560">🗑️</button>
                </div>
            </div>
        </div>`;
    });
    c.innerHTML = h;
}


function populateGroupList() {
    const groups = [...new Set(DB.menu.map(m => m.group).filter(Boolean))].sort();
    const datalist = document.getElementById('menuGroupList');
    if (datalist) {
        datalist.innerHTML = groups.map(g => `<option value="${g}">`).join('');
    }
}

function addMenuItem() {
    editingMenuItemId = null;
    document.getElementById('menuItemModalTitle').textContent = '➕ Dodaj Stavku';
    document.getElementById('menuItemNameInput').value = '';
    document.getElementById('menuItemDescInput').value = '';
    document.getElementById('menuItemPriceInput').value = '';
    document.getElementById('menuItemCatInput').value = 'Hrana';
    document.getElementById('menuItemGroupInput').value = '';
    populateGroupList();
    document.getElementById('menuItemModal').classList.add('show');
    document.getElementById('menuItemNameInput').focus();
}


function closeMenuItemModal() {
    document.getElementById('menuItemModal').classList.remove('show');
    editingMenuItemId = null;
}


function saveMenuItem() {
    const name = document.getElementById('menuItemNameInput').value.trim();
    const desc = document.getElementById('menuItemDescInput').value.trim();
    const price = parseFloat(document.getElementById('menuItemPriceInput').value);
    const cat = document.getElementById('menuItemCatInput').value;
    const group = document.getElementById('menuItemGroupInput').value.trim();
    
    if(!name) {
        showAlert('⚠️ Molimo unesite naziv stavke');
        return;
    }
    
    if(!price || price <= 0) {
        showAlert('⚠️ Molimo unesite validnu cenu');
        return;
    }
    
    if(editingMenuItemId) {
        const item = DB.menu.find(i => i.id === editingMenuItemId);
        if(item) {
            item.name = name;
            item.desc = desc;
            item.price = price;
            item.cat = cat;
            item.group = group || item.group || '';
            showAlert(`✅ Stavka "${name}" je ažurirana!`);
        }
    } else {
        DB.menu.push({
            id: Date.now(),
            name: name,
            desc: desc,
            price: price,
            cat: cat,
            group: group || ''
        });
        showAlert(`✅ Stavka "${name}" je dodata! ${shouldSendToKitchen({cat:cat}) ? '🍳 Biće slana u kuhinju.' : ''}`);
    }
    
    save();
    closeMenuItemModal();
    render();
}


function editItem(id) {
    const i = DB.menu.find(x=>x.id===id);
    if(!i) return;
    
    editingMenuItemId = id;
    document.getElementById('menuItemModalTitle').textContent = '✏️ Izmeni Stavku';
    document.getElementById('menuItemNameInput').value = i.name;
    document.getElementById('menuItemDescInput').value = i.desc || '';
    document.getElementById('menuItemPriceInput').value = i.price;
    document.getElementById('menuItemCatInput').value = i.cat;
    document.getElementById('menuItemGroupInput').value = i.group || '';
    populateGroupList();
    document.getElementById('menuItemModal').classList.add('show');
    document.getElementById('menuItemNameInput').focus();
}


function deleteItem(id) {
    const item = DB.menu.find(x=>x.id===id);
    if(!item) return;
    
    showConfirm('Obriši Stavku', `Sigurno želite da obrišete "${item.name}" iz menija?`, (confirmed) => {
        if(confirmed) {
            DB.menu = DB.menu.filter(i=>i.id!==id);
            save();
            render();
        }
    });
}


function importCSV() {
    // Ask if user wants to clear existing menu
    showConfirm(
        '⬆ Import Cenovnika',
        `Da li želite da obrišete sve postojeće proizvode pre importa?\n\n✅ DA - Obriši sve i uvezi novi cenovnik (preporučeno)\n❌ NE - Dodaj nove proizvode uz postojeće`,
        (clearMenu) => {
            if(clearMenu) {
                // Clear menu
                DB.menu = [];
                console.log('🗑️ Menu cleared before import');
            }
            
            // Open file picker
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv,.xlsx,.xls';
            input.onchange = e => {
                const file = e.target.files[0];
                if(!file) return;
                
                const fileName = file.name.toLowerCase();
                
                // Check if it's Excel file
                if(fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                    importExcel(file);
                } else {
                    importCSVFile(file);
                }
            };
            input.click();
        }
    );
}


function importCSVFile(file) {
    const reader = new FileReader();
    reader.onload = ev => {
        const text = ev.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if(lines.length < 2) {
            showAlert('❌ Fajl je prazan ili nema podataka');
            return;
        }
        
        // Get header to detect format
        const header = lines[0].toLowerCase();
        let count = 0;
        
        // Detect if it's a POS export format (has "name", "price", "category" columns)
        if(header.includes('name') && (header.includes('price') || header.includes('cost'))) {
            // Advanced POS format
            const headers = lines[0].split(',').map(h => h.trim());
            
            // Find column indices
            const nameIdx = headers.findIndex(h => h.toLowerCase().includes('name'));
            const priceIdx = headers.findIndex(h => h.toLowerCase().includes('price ['));
            const costIdx = headers.findIndex(h => h.toLowerCase() === 'cost');
            const categoryIdx = headers.findIndex(h => h.toLowerCase().includes('category'));
            const descIdx = headers.findIndex(h => h.toLowerCase().includes('description'));
            
            console.log('📊 Detected POS export format');
            console.log('Columns:', {nameIdx, priceIdx, costIdx, categoryIdx, descIdx});
            
            // Process data rows (skip header)
            for(let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if(!line.trim()) continue;
                
                // Parse CSV line (handle commas in quotes)
                const columns = parseCSVLine(line);
                
                const name = nameIdx >= 0 ? columns[nameIdx]?.trim() : '';
                const desc = descIdx >= 0 ? columns[descIdx]?.trim() : '';
                const category = categoryIdx >= 0 ? columns[categoryIdx]?.trim() : 'Hrana';
                
                // Try to get price from Price column first, then Cost column
                let priceStr = '';
                if(priceIdx >= 0 && columns[priceIdx]) {
                    priceStr = columns[priceIdx].trim();
                } else if(costIdx >= 0 && columns[costIdx]) {
                    priceStr = columns[costIdx].trim();
                }
                
                if(!name || !priceStr) continue;
                
                const price = parseFloat(priceStr);
                if(isNaN(price) || price <= 0) continue;
                
                DB.menu.push({
                    id: Date.now() + Math.random(),
                    name: name,
                    desc: desc || '',
                    price: price,
                    cat: category || 'Hrana'
                });
                count++;
            }
        } else {
            // Simple format: Naziv,Opis,Cena,Kategorija
            for(let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if(!line.trim()) continue;
                
                const p = line.split(',').map(x => x.trim());
                if(p.length < 3 || !p[0] || !p[2]) continue;
                
                const price = parseFloat(p[2]);
                if(isNaN(price) || price <= 0) continue;
                
                DB.menu.push({
                    id: Date.now() + Math.random(),
                    name: p[0],
                    desc: p[1] || '',
                    price: price,
                    cat: p[3] || 'Hrana'
                });
                count++;
            }
        }
        
        if(count > 0) { 
            save(); 
            render(); 
            showAlert(`✅ Uvezeno ${count} stavki iz CSV!`); 
        } else {
            showAlert('❌ Nema validnih stavki\n\nProverite format fajla.');
        }
    };
    reader.readAsText(file);
}


// Helper function to parse CSV line (handles commas in quotes)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for(let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if(char === '"') {
            inQuotes = !inQuotes;
        } else if(char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    
    return result;
}


function importExcel(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            // Parse Excel file
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            // Get first sheet
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Convert to JSON (skip header row)
            const rows = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
            
            if(rows.length < 2) {
                showAlert('❌ Excel fajl je prazan ili nema podataka');
                return;
            }
            
            // Define category mapping based on Grupa
            const categoryMapping = {
                // KUHINJA
                'DESERTI': 'Hrana',
                'DORUCAK': 'Hrana',
                'PIZZA': 'Hrana',
                'PIZZA 26': 'Hrana',
                'SALATE': 'Hrana',
                'SENDVICI': 'Hrana',
                'SUPE POTAZ': 'Hrana',
                'SUPE POTAZI': 'Hrana',  // Alternative spelling
                'SVOJA PIZZA': 'Hrana',
                'PASTA': 'Hrana',  // Added PASTA
                
                // PIĆE
                'ENERGETSKA PICA': 'Piće',
                'GAZIRANI SOKOVI': 'Piće',
                'KOKTELI': 'Piće',
                'KRATKA PICA': 'Piće',
                'NEGAZIRANI SOKOVI': 'Piće',
                'PIVO': 'Piće',
                'TOPLI NAPICI': 'Piće',
                'VINO': 'Piće',
                'VODA': 'Piće'
            };
            
            // Get header row
            const headers = rows[0].map(h => h ? String(h).trim() : '');
            console.log('📊 Excel headers:', headers);
            
            // Find column indices (support both English and Serbian)
            const nameIdx = headers.findIndex(h => 
                h.toLowerCase().includes('naziv') || 
                h.toLowerCase() === 'name'
            );
            
            const priceIdx = headers.findIndex(h => 
                h.toLowerCase().includes('cena') || 
                h.toLowerCase().includes('price')
            );
            
            const categoryIdx = headers.findIndex(h => 
                h.toLowerCase().includes('kategorija') || 
                h.toLowerCase().includes('category')
            );
            
            const groupIdx = headers.findIndex(h => 
                h.toLowerCase().includes('grupa') || 
                h.toLowerCase().includes('group')
            );
            
            const descIdx = headers.findIndex(h => 
                h.toLowerCase().includes('opis') || 
                h.toLowerCase().includes('description')
            );
            
            console.log('Column indices:', {nameIdx, priceIdx, categoryIdx, groupIdx, descIdx});
            
            if(nameIdx === -1 || priceIdx === -1) {
                showAlert('❌ Excel fajl mora imati kolone "Naziv" i "Cena"!\n\nPronađene kolone:\n' + headers.join(', '));
                return;
            }
            
            let count = 0;
            let skippedGroups = {};
            
            // Skip header row (index 0)
            for(let i = 1; i < rows.length; i++) {
                const row = rows[i];
                
                // Skip empty rows
                if(!row || row.length === 0) continue;
                
                const name = row[nameIdx] ? String(row[nameIdx]).trim() : '';
                const priceVal = row[priceIdx];
                
                // Get group name
                let groupName = '';
                if(groupIdx >= 0 && row[groupIdx]) {
                    groupName = String(row[groupIdx]).trim().toUpperCase();
                }
                
                // Check if group should be imported
                if(!groupName || !categoryMapping[groupName]) {
                    if(groupName && !skippedGroups[groupName]) {
                        skippedGroups[groupName] = 0;
                    }
                    if(groupName) skippedGroups[groupName]++;
                    continue;
                }
                
                // Map group to category
                const category = categoryMapping[groupName];
                
                const desc = descIdx >= 0 && row[descIdx] ? String(row[descIdx]).trim() : '';
                
                // Validate required fields
                if(!name) {
                    console.log(`Skipping row ${i+1}: No name`);
                    continue;
                }
                
                if(!priceVal) {
                    console.log(`Skipping row ${i+1}: No price for ${name}`);
                    continue;
                }
                
                const price = parseFloat(priceVal);
                if(isNaN(price) || price <= 0) {
                    console.log(`Skipping row ${i+1}: Invalid price for ${name}: ${priceVal}`);
                    continue;
                }
                
                // Add to menu
                DB.menu.push({
                    id: Date.now() + Math.random(),
                    name: name,
                    desc: desc,
                    price: price,
                    cat: category,
                    group: groupName  // Store original group name
                });
                count++;
            }
            
            if(count > 0) {
                save();
                render();
                
                let message = `✅ Uvezeno ${count} stavki iz Excel-a!`;
                
                // Show skipped groups if any
                if(Object.keys(skippedGroups).length > 0) {
                    message += '\n\n⚠️ Preskočene grupe:\n';
                    for(let [group, cnt] of Object.entries(skippedGroups)) {
                        message += `• ${group}: ${cnt} stavki\n`;
                    }
                }
                
                showAlert(message);
            } else {
                showAlert('❌ Nema validnih stavki u Excel fajlu\n\nProverite da kolone "Naziv" i "Cena" imaju validne podatke.');
            }
            
        } catch(error) {
            console.error('Excel import error:', error);
            showAlert('❌ Greška pri učitavanju Excel fajla!\n\n' + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
}


function renderSettings(c) {
    c.innerHTML = `<h2>⚙️ Postavke</h2>
        <div style="margin:20px 0">
            <label style="color:#E94560;font-weight:bold">Naziv restauranta</label>
            <input type="text" id="sname" value="${DB.settings.name}">
            <label style="color:#E94560;font-weight:bold">Adresa</label>
            <input type="text" id="saddr" value="${DB.settings.addr}">
            <label style="color:#E94560;font-weight:bold">Telefon</label>
            <input type="text" id="sphone" value="${DB.settings.phone}">
            
            <div style="border-top:2px solid #2A2A4A;margin:24px 0;padding-top:24px">
                <h3 style="color:#FF9800;margin-bottom:16px">🔐 Promena Šifre</h3>
                <p style="color:#B0B0B0;font-size:13px;margin-bottom:16px">
                    Promenite šifru za svoj nalog (${DB.currentUser.username})
                </p>
                
                <label style="color:#E94560;font-weight:bold">Stara šifra</label>
                <input type="password" id="oldPassword" placeholder="Unesite staru šifru">
                
                <label style="color:#E94560;font-weight:bold">Nova šifra</label>
                <input type="password" id="newPassword" placeholder="Unesite novu šifru">
                
                <label style="color:#E94560;font-weight:bold">Potvrdi novu šifru</label>
                <input type="password" id="confirmPassword" placeholder="Ponovite novu šifru">
                
                <button class="btn btn-secondary" style="margin-top:12px;background:#FF9800" onclick="changePassword()">🔐 Promeni Šifru</button>
            </div>
            
            <div style="border-top:2px solid #2A2A4A;margin:24px 0;padding-top:24px">
                <h3 style="color:#4CAF50;margin-bottom:16px">🔥 Firebase Sinhronizacija</h3>
                <div style="background:#16213E;padding:16px;border-radius:8px;border-left:4px solid #4CAF50">
                    <p style="color:#FFD700;font-weight:bold;margin-bottom:8px">✅ Aktivna</p>
                    <p style="color:#B0B0B0;font-size:13px;line-height:1.6">
                        • Podaci se automatski sinhronizuju između svih uređaja<br>
                        • Promena na telefonu se odmah vidi na računaru<br>
                        • Auto-refresh svaka 10 sekundi<br>
                        • Bez potrebe za ručnim exportom/importom
                    </p>
                </div>
            </div>
            
            <div style="border-top:2px solid #2A2A4A;margin:24px 0;padding-top:24px">
                <h3 style="color:#FFD700;margin-bottom:16px">📧 Email Izveštaji</h3>
                <label style="color:#E94560;font-weight:bold">Email za izveštaje</label>
                <input type="email" id="semail" value="${DB.settings.email || ''}" placeholder="vas@email.com">
                <p style="color:#B0B0B0;font-size:13px;margin-top:8px;line-height:1.6">
                    💡 Kada konobari zatvore radni dan, moći će da preuzmu kompletan izveštaj.
                </p>
            </div>
            
            <label style="color:#E94560;font-weight:bold">IP Adresa štampača</label>
            <input type="text" id="sip" value="${DB.settings.ip}">
            <p style="color:#B0B0B0;font-size:12px;margin-top:4px">💡 Štampanje dostupno samo u Android verziji</p>
            
            ${typeof renderOctoposSettings === 'function' ? renderOctoposSettings() : ''}
            
            ${typeof renderEfakturaSettings === 'function' ? renderEfakturaSettings() : ''}
            
            ${typeof renderEmailSettings === 'function' ? renderEmailSettings() : ''}
            
            <div class="card" style="margin-bottom:16px;border:2px solid #FF9800">
                <h3 style="color:#FF9800;margin-bottom:12px">🍳 Kuhinjske Kategorije</h3>
                <p style="color:#888;font-size:13px;margin-bottom:12px">Kategorije koje <strong>NE</strong> idu u kuhinju (razdvojene zarezom). Sve ostale kategorije se automatski šalju kuvaru.</p>
                <input type="text" id="nonKitchenCats" value="${(DB.settings && DB.settings.nonKitchenCategories) || ''}"
                    placeholder="Piće, Voda, Sokovi, Kafa..."
                    style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:13px;margin-bottom:8px">
                <p style="color:#888;font-size:11px;margin-bottom:12px">💡 Ako ostavite prazno, automatski prepoznaje kategorije pića po imenu</p>
                <button class="btn" style="background:#FF9800" onclick="DB.settings.nonKitchenCategories=document.getElementById('nonKitchenCats').value;save();showAlert('✅ Sačuvano!')">💾 Sačuvaj</button>
            </div>

            <div class="card" style="margin-bottom:16px;border:2px solid #00BCD4">
                <h3 style="color:#00BCD4;margin-bottom:12px">📹 Kamere (Hikvision)</h3>
                <p style="color:#888;font-size:13px;margin-bottom:12px">
                    URL adrese za pristup kamerama. Konobari otvaraju <strong>lokalnu</strong> (radi samo na restoranskoj WiFi). Admin otvara <strong>daljinski</strong> (radi odakle god).
                </p>

                <label style="color:#FFD700;display:block;margin-bottom:6px;font-weight:bold">🏠 Lokalna URL (za konobare) — NVR ili Hik-Connect lokalno</label>
                <input type="text" id="camerasLocalUrl" value="${(DB.settings && DB.settings.camerasLocalUrl) || ''}"
                    placeholder="http://192.168.1.100 ili http://192.168.0.64"
                    style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:13px;margin-bottom:4px">
                <p style="color:#888;font-size:11px;margin-bottom:12px">💡 IP adresa NVR-a u lokalnoj mreži. Konobari moraju biti povezani na WiFi restorana.</p>

                <label style="color:#FFD700;display:block;margin-bottom:6px;font-weight:bold">🌍 Daljinska URL (za admina) — Hik-Connect cloud</label>
                <input type="text" id="camerasRemoteUrl" value="${(DB.settings && DB.settings.camerasRemoteUrl) || 'https://www.hik-connect.com'}"
                    placeholder="https://www.hik-connect.com"
                    style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:13px;margin-bottom:4px">
                <p style="color:#888;font-size:11px;margin-bottom:12px">💡 Hik-Connect web portal — admin se prijavi svojim nalogom, browser pamti login.</p>

                <button class="btn" style="background:#00BCD4" onclick="saveCameraSettings()">💾 Sačuvaj Kamere</button>
            </div>
            
            ${typeof renderGeoSettings === 'function' ? renderGeoSettings() : ''}
            
            <button class="btn" style="margin-top:16px" onclick="saveSettings()">Sačuvaj Postavke</button>
            
            <div style="border-top:3px solid #FF9800;margin:32px 0;padding-top:24px">
                <h3 style="color:#FF9800;margin-bottom:16px">🧹 Očisti Radni Dan</h3>
                <div style="background:#16213E;padding:16px;border-radius:8px;border-left:4px solid #FF9800;margin-bottom:16px">
                    <p style="color:#FF9800;font-weight:bold;margin-bottom:8px">Nova smena od nule</p>
                    <p style="color:#B0B0B0;font-size:13px;line-height:1.6">
                        Zatvara sve aktivne smene, briše stavke sa stolova i resetuje depozit.<br>
                        Konobari će moći da otvore novi radni dan sa ručnim unosom depozita.<br><br>
                        <strong style="color:#4CAF50">Narudžbine i istorija smena OSTAJU sačuvane.</strong>
                    </p>
                </div>
                <button class="btn" style="background:#FF9800" onclick="clearWorkday()">🧹 Očisti Radni Dan</button>
            </div>
            
            <div style="border-top:3px solid #E94560;margin:32px 0;padding-top:24px">
                <h3 style="color:#E94560;margin-bottom:16px">🗑️ Resetuj Podatke</h3>
                <div style="background:#16213E;padding:16px;border-radius:8px;border-left:4px solid #E94560;margin-bottom:16px">
                    <p style="color:#E94560;font-weight:bold;margin-bottom:8px">⚠️ OPASNA ZONA</p>
                    <p style="color:#B0B0B0;font-size:13px;line-height:1.6">
                        Ovo će <strong style="color:#E94560">OBRISATI</strong>:<br>
                        • Sve narudžbine i istoriju plaćanja<br>
                        • Istoriju radnih dana (svih konobara i kuvara)<br>
                        • Kuhinjske narudžbine<br>
                        • Uklonjene artikle<br>
                        • Aktivne radne dane (svi će biti odjavljeni)<br><br>
                        <strong style="color:#4CAF50">OSTAJE</strong>: Meni, Korisnici, Podešavanja, Nabavka
                    </p>
                </div>
                <button class="btn" style="background:#E94560" onclick="resetAllData()">🗑️ Obriši Sve Podatke</button>
            </div>
        </div>`;
}


function changePassword() {
    const oldPass = document.getElementById('oldPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    
    // Validacija
    if (!oldPass || !newPass || !confirmPass) {
        showAlert('❌ Molimo popunite sva polja!');
        return;
    }
    
    // Proveri staru šifru
    const userInDb = DB.users.find(u => u.username === DB.currentUser.username);
    if (!userInDb || userInDb.password !== oldPass) {
        showAlert('❌ Stara šifra nije tačna!');
        return;
    }
    
    // Proveri da li se nove šifre poklapaju
    if (newPass !== confirmPass) {
        showAlert('❌ Nove šifre se ne poklapaju!');
        return;
    }
    
    // Proveri dužinu nove šifre
    if (newPass.length < 4) {
        showAlert('❌ Nova šifra mora imati minimum 4 karaktera!');
        return;
    }
    
    // Promeni šifru
    const userIndex = DB.users.findIndex(u => u.username === DB.currentUser.username);
    if (userIndex !== -1) {
        DB.users[userIndex].password = newPass;
        DB.currentUser.password = newPass;
        save();
        
        // Očisti polja
        document.getElementById('oldPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        showAlert('✅ Šifra je uspešno promenjena!\n\nKoristite novu šifru pri sledećem prijavljivanju.');
    } else {
        showAlert('❌ Greška: Korisnik nije pronađen!');
    }
}


function saveSettings() {
    DB.settings.name = document.getElementById('sname').value;
    DB.settings.addr = document.getElementById('saddr').value;
    DB.settings.phone = document.getElementById('sphone').value;
    DB.settings.email = document.getElementById('semail').value;
    DB.settings.ip = document.getElementById('sip').value;
    save();
    showAlert('✅ Sačuvano!');
}

function saveCameraSettings() {
    if (!DB.settings) DB.settings = {};
    DB.settings.camerasLocalUrl = (document.getElementById('camerasLocalUrl').value || '').trim();
    DB.settings.camerasRemoteUrl = (document.getElementById('camerasRemoteUrl').value || '').trim();
    save();
    showAlert('✅ Postavke kamera sačuvane!');
}

// Otvara kamere u novom tabu - bira URL na osnovu role:
// - konobar/kuvar → uvek lokalni (NVR IP), radi samo na WiFi restorana
// - admin sa OBA URL-a → pita ga šta hoće (lokalno brže, cloud odasvud)
// - admin sa jednim URL-om → otvori taj jedan
function openCameras() {
    const settings = DB.settings || {};
    const role = DB.currentUser && DB.currentUser.role;
    const isAdmin = role === 'admin';
    const localUrl = (settings.camerasLocalUrl || '').trim();
    const remoteUrl = (settings.camerasRemoteUrl || '').trim();

    function open(url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    if (!isAdmin) {
        // Konobar/kuvar - samo lokalno
        if (!localUrl) {
            showAlert('⚠️ Lokalna adresa kamera nije podešena.\n\nPitaj admina da podesi adresu NVR-a u Postavkama → 📹 Kamere.');
            return;
        }
        open(localUrl);
        return;
    }

    // Admin - bira put
    if (!localUrl && !remoteUrl) {
        showAlert('⚠️ Nije podešen URL za kamere.\n\nIdi u Postavke → 📹 Kamere i unesi makar jednu adresu.');
        return;
    }
    if (localUrl && !remoteUrl) { open(localUrl); return; }
    if (!localUrl && remoteUrl) { open(remoteUrl); return; }

    // Oba postoje - prikaži choice modal
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML =
        '<div style="background:#0F3460;padding:24px;border-radius:12px;max-width:420px;width:100%;border:2px solid #00BCD4">' +
            '<h2 style="color:#00BCD4;margin-bottom:16px;text-align:center">📹 Kamere</h2>' +
            '<p style="color:#B0B0B0;font-size:13px;margin-bottom:20px;text-align:center">Kako želiš da pristupiš?</p>' +
            '<button class="btn" style="width:100%;margin-bottom:10px;background:#4CAF50" onclick="this.parentElement.parentElement.remove();window.open(' + JSON.stringify(localUrl) + ',\'_blank\',\'noopener,noreferrer\')">' +
                '🏠 Lokalno (WiFi restorana, brže)' +
            '</button>' +
            '<button class="btn" style="width:100%;margin-bottom:10px;background:#2196F3" onclick="this.parentElement.parentElement.remove();window.open(' + JSON.stringify(remoteUrl) + ',\'_blank\',\'noopener,noreferrer\')">' +
                '🌍 Hik-Connect Cloud (odasvud)' +
            '</button>' +
            '<button class="btn btn-secondary" style="width:100%" onclick="this.parentElement.parentElement.remove()">Otkaži</button>' +
        '</div>';
    document.body.appendChild(modal);
}
if (typeof window !== 'undefined') {
    window.saveCameraSettings = saveCameraSettings;
    window.openCameras = openCameras;
}

function clearWorkday() {
    // Prikaži UI za selektivno čišćenje
    const today = new Date().toISOString().split('T')[0];
    
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'clearWorkdayModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:550px;max-height:90vh;overflow-y:auto">
            <h2 style="color:#FF9800;margin-bottom:16px">🧹 Očisti Radni Dan</h2>
            
            <div style="margin-bottom:16px">
                <label style="color:#FFD700;display:block;margin-bottom:6px;font-weight:bold">📅 Izaberi datum</label>
                <input type="date" id="clearDate" value="${today}" 
                    style="width:100%;padding:12px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:16px"
                    onchange="updateClearSummary()">
            </div>
            
            <div id="clearSummary" style="margin-bottom:16px">
                <div style="text-align:center;padding:20px;color:#888">⏳ Učitavam...</div>
            </div>
            
            <div id="clearOptions" style="display:none;margin-bottom:16px">
                <label style="color:#FFD700;display:block;margin-bottom:10px;font-weight:bold">Šta želiš da očistiš?</label>
                
                <label style="display:flex;align-items:center;gap:10px;padding:10px;background:#16213E;border-radius:8px;margin-bottom:6px;cursor:pointer">
                    <input type="checkbox" id="clearOrders" checked style="width:20px;height:20px;accent-color:#E94560">
                    <div>
                        <div style="color:#FFF;font-weight:bold">💰 Narudžbine</div>
                        <div id="clearOrdersInfo" style="color:#888;font-size:12px">Keš + kartice</div>
                    </div>
                </label>
                
                <label style="display:flex;align-items:center;gap:10px;padding:10px;background:#16213E;border-radius:8px;margin-bottom:6px;cursor:pointer">
                    <input type="checkbox" id="clearShifts" checked style="width:20px;height:20px;accent-color:#E94560">
                    <div>
                        <div style="color:#FFF;font-weight:bold">👥 Smene (istorija)</div>
                        <div id="clearShiftsInfo" style="color:#888;font-size:12px">Depozit, keš, plate</div>
                    </div>
                </label>
                
                <label style="display:flex;align-items:center;gap:10px;padding:10px;background:#16213E;border-radius:8px;margin-bottom:6px;cursor:pointer">
                    <input type="checkbox" id="clearTables" checked style="width:20px;height:20px;accent-color:#E94560">
                    <div>
                        <div style="color:#FFF;font-weight:bold">🍽️ Stolovi</div>
                        <div style="color:#888;font-size:12px">Očisti sve stavke sa stolova</div>
                    </div>
                </label>
                
                <label style="display:flex;align-items:center;gap:10px;padding:10px;background:#16213E;border-radius:8px;margin-bottom:6px;cursor:pointer">
                    <input type="checkbox" id="clearKitchen" checked style="width:20px;height:20px;accent-color:#E94560">
                    <div>
                        <div style="color:#FFF;font-weight:bold">🍳 Kuhinja</div>
                        <div id="clearKitchenInfo" style="color:#888;font-size:12px">Kuhinjske narudžbine</div>
                    </div>
                </label>
                
                <label style="display:flex;align-items:center;gap:10px;padding:10px;background:#16213E;border-radius:8px;margin-bottom:6px;cursor:pointer">
                    <input type="checkbox" id="clearActiveShifts" style="width:20px;height:20px;accent-color:#E94560">
                    <div>
                        <div style="color:#FFF;font-weight:bold">🔓 Aktivne smene</div>
                        <div id="clearActiveInfo" style="color:#888;font-size:12px">Zatvori otvorene smene</div>
                    </div>
                </label>
                
                <label style="display:flex;align-items:center;gap:10px;padding:10px;background:#16213E;border-radius:8px;margin-bottom:6px;cursor:pointer">
                    <input type="checkbox" id="clearRemoved" style="width:20px;height:20px;accent-color:#E94560">
                    <div>
                        <div style="color:#FFF;font-weight:bold">🗑️ Uklonjeni artikli</div>
                        <div id="clearRemovedInfo" style="color:#888;font-size:12px">Stornirane stavke</div>
                    </div>
                </label>
            </div>
            
            <div style="display:flex;gap:10px">
                <button class="btn btn-secondary" style="flex:1" onclick="closeClearWorkdayModal()">Odustani</button>
                <button class="btn" id="clearConfirmBtn" style="flex:1;background:#E94560" onclick="executeClearWorkday()">🧹 Očisti</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    updateClearSummary();
}


function closeClearWorkdayModal() {
    const modal = document.getElementById('clearWorkdayModal');
    if (modal) modal.remove();
}


function updateClearSummary() {
    const dateStr = document.getElementById('clearDate')?.value;
    if (!dateStr) return;
    
    const dayStart = new Date(dateStr + 'T00:00:00');
    const dayEnd = new Date(dateStr + 'T23:59:59');
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    
    // Narudžbine za taj dan
    const dayOrders = DB.orders.filter(o => {
        const t = new Date(o.time);
        return t >= dayStart && t <= dayEnd;
    });
    const cashOrders = dayOrders.filter(o => o.method === 'Cash');
    const cardOrders = dayOrders.filter(o => o.method === 'Card');
    const totalCash = cashOrders.reduce((s, o) => s + o.tot, 0);
    const totalCard = cardOrders.reduce((s, o) => s + o.tot, 0);
    const totalAll = dayOrders.reduce((s, o) => s + o.tot, 0);
    
    // Smene za taj dan
    const dayShifts = (DB.workdayHistory || []).filter(s => {
        const t = new Date(s.loginTime);
        return t >= dayStart && t <= dayEnd;
    });
    const totalSalary = dayShifts.reduce((s, sh) => s + (sh.salary || 0), 0);
    const totalDeposit = dayShifts.reduce((s, sh) => s + (sh.deposit || 0), 0);
    
    // Kuhinja za taj dan
    const dayKitchen = (DB.kitchenOrders || []).filter(ko => {
        const t = new Date(ko.timestamp || ko.time);
        return t >= dayStart && t <= dayEnd;
    });
    
    // Aktivne smene
    const activeShifts = Object.entries(DB.workdays || {}).filter(([u, wd]) => {
        if (!wd || !wd.startTime) return false;
        const t = new Date(wd.startTime);
        return t >= dayStart && t <= dayEnd;
    });
    
    // Uklonjeni artikli
    const dayRemoved = (DB.removedItems || []).filter(r => {
        const t = new Date(r.time || r.timestamp);
        return t >= dayStart && t <= dayEnd;
    });
    
    // Summary
    const summaryEl = document.getElementById('clearSummary');
    const optionsEl = document.getElementById('clearOptions');
    
    if (dayOrders.length === 0 && dayShifts.length === 0 && activeShifts.length === 0 && dayKitchen.length === 0) {
        summaryEl.innerHTML = `<div style="text-align:center;padding:20px;background:#16213E;border-radius:10px">
            <div style="font-size:40px;margin-bottom:8px">📭</div>
            <div style="color:#888">Nema podataka za ovaj datum</div>
        </div>`;
        optionsEl.style.display = 'none';
        return;
    }
    
    optionsEl.style.display = 'block';
    
    summaryEl.innerHTML = `
        <div style="background:#16213E;border-radius:10px;padding:14px">
            <div style="color:#FFD700;font-weight:bold;margin-bottom:10px;font-size:15px">
                📊 ${new Date(dateStr).toLocaleDateString('sr-RS', {weekday:'long', day:'numeric', month:'long'})}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div style="background:#0F3460;padding:10px;border-radius:8px;text-align:center">
                    <div style="color:#888;font-size:11px">Narudžbine</div>
                    <div style="color:#FFF;font-size:20px;font-weight:bold">${dayOrders.length}</div>
                    <div style="color:#4CAF50;font-size:12px">${totalAll.toLocaleString()} din</div>
                </div>
                <div style="background:#0F3460;padding:10px;border-radius:8px;text-align:center">
                    <div style="color:#888;font-size:11px">Smene</div>
                    <div style="color:#FFF;font-size:20px;font-weight:bold">${dayShifts.length}${activeShifts.length > 0 ? ' + ' + activeShifts.length + ' aktiv.' : ''}</div>
                    <div style="color:#9C27B0;font-size:12px">${dayShifts.map(s => s.user).join(', ') || '-'}</div>
                </div>
                <div style="background:#0F3460;padding:10px;border-radius:8px;text-align:center">
                    <div style="color:#888;font-size:11px">💵 Keš</div>
                    <div style="color:#4CAF50;font-size:18px;font-weight:bold">${totalCash.toLocaleString()}</div>
                </div>
                <div style="background:#0F3460;padding:10px;border-radius:8px;text-align:center">
                    <div style="color:#888;font-size:11px">💳 Kartice</div>
                    <div style="color:#2196F3;font-size:18px;font-weight:bold">${totalCard.toLocaleString()}</div>
                </div>
            </div>
        </div>
    `;
    
    // Info labele
    document.getElementById('clearOrdersInfo').textContent = 
        `${dayOrders.length} narudžbina · ${totalCash.toLocaleString()} keš + ${totalCard.toLocaleString()} kartice`;
    document.getElementById('clearShiftsInfo').textContent = 
        `${dayShifts.length} smena · plate: ${totalSalary.toLocaleString()} din`;
    document.getElementById('clearKitchenInfo').textContent = 
        `${dayKitchen.length} kuhinjskih narudžbina`;
    document.getElementById('clearActiveInfo').textContent = 
        activeShifts.length > 0 
            ? `${activeShifts.map(([u]) => u).join(', ')}` 
            : 'Nema aktivnih smena za ovaj dan';
    document.getElementById('clearRemovedInfo').textContent = 
        `${dayRemoved.length} uklonjenih stavki`;
    
    // Auto-check aktivne smene samo ako je danas
    document.getElementById('clearActiveShifts').checked = isToday && activeShifts.length > 0;
    // Stolovi samo ako je danas
    document.getElementById('clearTables').checked = isToday;
    document.getElementById('clearKitchen').checked = isToday;
}


async function executeClearWorkday() {
    const dateStr = document.getElementById('clearDate')?.value;
    if (!dateStr) return;
    
    const dayStart = new Date(dateStr + 'T00:00:00');
    const dayEnd = new Date(dateStr + 'T23:59:59');
    
    const doOrders = document.getElementById('clearOrders')?.checked;
    const doShifts = document.getElementById('clearShifts')?.checked;
    const doTables = document.getElementById('clearTables')?.checked;
    const doKitchen = document.getElementById('clearKitchen')?.checked;
    const doActive = document.getElementById('clearActiveShifts')?.checked;
    const doRemoved = document.getElementById('clearRemoved')?.checked;
    
    if (!doOrders && !doShifts && !doTables && !doKitchen && !doActive && !doRemoved) {
        showAlert('⚠️ Ništa nije označeno!');
        return;
    }
    
    // Napravi listu šta se briše za potvrdu
    const parts = [];
    if (doOrders) parts.push('narudžbine');
    if (doShifts) parts.push('istorija smena');
    if (doTables) parts.push('stolovi');
    if (doKitchen) parts.push('kuhinja');
    if (doActive) parts.push('aktivne smene');
    if (doRemoved) parts.push('uklonjeni artikli');
    
    const dateLabel = new Date(dateStr).toLocaleDateString('sr-RS', {day:'numeric', month:'long'});
    
    showConfirm('🧹 Potvrdi Čišćenje',
        `Brisanje za ${dateLabel}:\n\n• ${parts.join('\n• ')}\n\nOvo se NE MOŽE poništiti!`,
        async (confirmed) => {
            if (!confirmed) return;
            
            let stats = { orders: 0, shifts: 0, kitchen: 0, active: 0, removed: 0 };
            
            try {
                // 1. Narudžbine
                if (doOrders) {
                    const before = DB.orders.length;
                    DB.orders = DB.orders.filter(o => {
                        const t = new Date(o.time);
                        return !(t >= dayStart && t <= dayEnd);
                    });
                    stats.orders = before - DB.orders.length;
                }
                
                // 2. Istorija smena
                if (doShifts) {
                    const before = DB.workdayHistory.length;
                    DB.workdayHistory = DB.workdayHistory.filter(s => {
                        const t = new Date(s.loginTime);
                        return !(t >= dayStart && t <= dayEnd);
                    });
                    stats.shifts = before - DB.workdayHistory.length;
                }
                
                // 3. Stolovi
                if (doTables) {
                    DB.tables.forEach(table => {
                        table.order = [];
                        table.discount = 0;
                        table.discountPercent = 0;
                        table.discountedItems = [];
                        if (typeof markTableDirty === 'function') markTableDirty(table.num);
                    });
                }
                
                // 4. Kuhinja
                if (doKitchen) {
                    const before = DB.kitchenOrders.length;
                    const _delKO = (DB.kitchenOrders || []).filter(ko => {
                        const t = new Date(ko.timestamp || ko.time);
                        return (t >= dayStart && t <= dayEnd);
                    });
                    DB.kitchenOrders = (DB.kitchenOrders || []).filter(ko => {
                        const t = new Date(ko.timestamp || ko.time);
                        return !(t >= dayStart && t <= dayEnd);
                    });
                    if (typeof markDeleted === 'function') _delKO.forEach(ko => markDeleted('kitchenOrders', ko.id));
                    stats.kitchen = before - DB.kitchenOrders.length;
                }
                
                // 5. Aktivne smene
                if (doActive) {
                    const activeForDay = Object.entries(DB.workdays || {}).filter(([u, wd]) => {
                        if (!wd || !wd.startTime) return false;
                        const t = new Date(wd.startTime);
                        return t >= dayStart && t <= dayEnd;
                    });
                    
                    for (const [username, myWorkday] of activeForDay) {
                        if (typeof autoCloseWorkday === 'function') {
                            autoCloseWorkday(username, myWorkday);
                        }
                        await database.ref('/workdays/' + sanitizeFirebaseKey(username)).remove();
                        delete DB.workdays[username];
                        stats.active++;
                    }
                }
                
                // 6. Uklonjeni artikli
                if (doRemoved) {
                    const before = DB.removedItems.length;
                    DB.removedItems = DB.removedItems.filter(r => {
                        const t = new Date(r.time || r.timestamp);
                        return !(t >= dayStart && t <= dayEnd);
                    });
                    stats.removed = before - DB.removedItems.length;
                }

                DB._adminDeleteOverride = true;
                save();
                closeClearWorkdayModal();
                render();
                
                // Rezultat
                const resultParts = [];
                if (stats.orders) resultParts.push(`${stats.orders} narudžbina`);
                if (stats.shifts) resultParts.push(`${stats.shifts} smena`);
                if (doTables) resultParts.push('stolovi očišćeni');
                if (stats.kitchen) resultParts.push(`${stats.kitchen} kuhinjskih`);
                if (stats.active) resultParts.push(`${stats.active} aktivnih smena zatvoreno`);
                if (stats.removed) resultParts.push(`${stats.removed} uklonjenih artikala`);
                
                showAlert(`✅ Očišćeno za ${dateLabel}:\n\n${resultParts.join('\n')}`);
                
            } catch (err) {
                console.error('Greška pri čišćenju:', err);
                showAlert('❌ Greška: ' + err.message);
            }
        }
    );
}


function resetAllData() {
    showConfirm('⚠️ BRISANJE PODATAKA', 'Da li ste POTPUNO sigurni?\n\nOvo će obrisati SVE narudžbine, istoriju i radne dane!\n\nOvo se NE MOŽE poništiti!', (confirmed) => {
        if (!confirmed) return;
        
        showConfirm('🔴 POSLEDNJA ŠANSA', 'Zaista želite da obrišete SVE podatke?\n\nOstaju samo: Meni, Korisnici, Podešavanja, Nabavka', async (confirmed2) => {
            if (!confirmed2) return;
            
            try {
                // ✅ RACE FIX (defensive): pre direktnih Firebase set-ova,
                // obeleži sve postojeće ID-eve u tracked kolekcijama kao
                // obrisane, da paralelni save() sa drugog uređaja ne vrati
                // obrisane stavke kroz merge.
                if (typeof markDeleted === 'function') {
                    (DB.kitchenOrders || []).forEach(o => markDeleted('kitchenOrders', o.id));
                    (DB.guestOrders || []).forEach(o => markDeleted('guestOrders', o.id));
                    (DB.waiterCalls || []).forEach(o => markDeleted('waiterCalls', o.id));
                }
                if (typeof markTableDirty === 'function') {
                    (DB.tables || []).forEach(t => markTableDirty(t.num));
                }

                // Eksplicitno obriši svaki node u Firebase
                await database.ref('orders').set(null);
                await database.ref('removedItems').set(null);
                await database.ref('workdays').set(null);
                await database.ref('workdayHistory').set(null);
                await database.ref('kitchenOrders').set(null);
                await database.ref('guestOrders').set(null);

                // Očisti stolove (samo narudžbine, zadrži imena)
                const cleanTables = DB.tables.map(table => ({
                    ...table,
                    order: [],
                    discountPercent: 0,
                    discountedItems: []
                }));
                await database.ref('tables').set(cleanTables);

                // Ažuriraj lokalni DB
                DB.orders = [];
                DB.removedItems = [];
                DB.workdays = {};
                DB.workdayHistory = [];
                DB.kitchenOrders = [];
                DB.guestOrders = [];
                DB.tables = cleanTables;
                
                // ✅ Obriši workdays sa Firebase (jer ih main save više ne piše)
                await database.ref('/workdays').remove();
                
                render();
                showAlert('✅ Svi podaci su obrisani!\n\nOstali su: Meni, Korisnici, Podešavanja, Nabavka.');
            } catch (error) {
                console.error('❌ Greška pri brisanju:', error);
                showAlert('❌ Greška pri brisanju: ' + error.message);
            }
        });
    });
}


// ============================================
// ADMIN: RUČNO ZATVARANJE TUĐE SMENE
// ============================================
function adminCloseShift(username) {
    if (!DB.currentUser || DB.currentUser.role !== 'admin') {
        showAlert('❌ Samo admin može da zatvori tuđu smenu!');
        return;
    }
    
    var myWorkday = DB.workdays && DB.workdays[username];
    if (!myWorkday) {
        showAlert('❌ ' + username + ' nema otvorenu smenu');
        return;
    }
    
    var startTime = new Date(myWorkday.startTime);
    var startStr = startTime.toLocaleString('sr-RS', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
    
    showConfirm('🔒 Zatvori Smenu', 
        'Konobar: ' + username + '\nPočetak: ' + startStr + '\nDepozit: ' + (myWorkday.deposit || 0) + ' din\n\nDa li ste sigurni da želite da zatvorite ovu smenu?',
        function(confirmed) {
            if (!confirmed) return;
            
            // Koristi autoCloseWorkday jer ne zahteva da smo ulogovani kao taj konobar
            if (typeof autoCloseWorkday === 'function') {
                autoCloseWorkday(username, myWorkday);
                save();
                render();
                showAlert('✅ Smena za ' + username + ' zatvorena!');
            } else {
                showAlert('❌ Greška: funkcija za zatvaranje nije dostupna');
            }
        }
    );
}

