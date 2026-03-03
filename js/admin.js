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
            
            // Statistika kuvara - broj kuhinjskih narudžbina
            const cookOrders = DB.kitchenOrders.filter(ko => ko.status === 'completed');
            const groceryRequests = DB.groceryList.filter(g => g.needed && g.requestedBy && g.requestedBy.includes(w.username));
            
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
            save();
            render();
            showAlert(`✅ ${roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)} je obrisan`);
        }
    });
}


function renderEdit(c) {
    let h = '<div style="display:flex;justify-content:space-between;margin-bottom:16px"><h2>✏️ Izmeni Menu</h2><div><button class="btn btn-secondary" style="width:auto;padding:8px 16px;margin-right:8px" onclick="importCSV()">⬆ Import</button><button class="btn" style="width:auto;padding:8px 16px" onclick="addMenuItem()">+ Dodaj</button></div></div>';
    DB.menu.forEach(i => {
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
        showAlert(`✅ Stavka "${name}" je dodata! ${cat === 'Hrana' ? '🍳 Biće slana u kuhinju.' : ''}`);
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
            
            <button class="btn" style="margin-top:16px" onclick="saveSettings()">Sačuvaj Postavke</button>
            
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

function resetAllData() {
    showConfirm('⚠️ BRISANJE PODATAKA', 'Da li ste POTPUNO sigurni?\n\nOvo će obrisati SVE narudžbine, istoriju i radne dane!\n\nOvo se NE MOŽE poništiti!', (confirmed) => {
        if (!confirmed) return;
        
        showConfirm('🔴 POSLEDNJA ŠANSA', 'Zaista želite da obrišete SVE podatke?\n\nOstaju samo: Meni, Korisnici, Podešavanja, Nabavka', async (confirmed2) => {
            if (!confirmed2) return;
            
            try {
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
                
                render();
                showAlert('✅ Svi podaci su obrisani!\n\nOstali su: Meni, Korisnici, Podešavanja, Nabavka.');
            } catch (error) {
                console.error('❌ Greška pri brisanju:', error);
                showAlert('❌ Greška pri brisanju: ' + error.message);
            }
        });
    });
}

