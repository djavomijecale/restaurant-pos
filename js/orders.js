// ============================================
// ORDER OPERATIONS & PAYMENT
// ============================================

// Kategorije koje NE idu u kuhinju (pića, itd.)
// Admin može da podesi u Postavke → Kuhinjske Kategorije
function shouldSendToKitchen(menuItem) {
    if (!menuItem || !menuItem.cat) return false;
    
    // Ako admin definiše listu, koristi nju
    var skipCats = (DB.settings && DB.settings.nonKitchenCategories) || '';
    if (skipCats) {
        var skipList = skipCats.split(',').map(function(c) { return c.trim().toLowerCase(); });
        return !skipList.includes(menuItem.cat.toLowerCase());
    }
    
    // Default: šalji sve osim pića
    var drinkKeywords = ['piće', 'pice', 'pića', 'drink', 'napit', 'sok', 'kafa', 'coffee', 'vino', 'wine', 'pivo', 'beer', 'žestina', 'žestoko', 'koktel', 'cocktail', 'voda', 'water', 'čaj', 'tea'];
    var catLower = menuItem.cat.toLowerCase();
    return !drinkKeywords.some(function(kw) { return catLower.includes(kw); });
}


function addToTable(itemId) {
    const table = DB.tables.find(t=>t.num===DB.selectedTable);
    const menuItem = DB.menu.find(i=>i.id===itemId);
    const existing = table.order.find(i=>i.id===itemId && i.createdBy===DB.currentUser.username);
    
    if(existing) {
        existing.qty++;
        
        // Ako ide u kuhinju, ažuriraj količinu u kuhinjskoj narudžbini
        if(shouldSendToKitchen(menuItem)) {
            // Samo dodaj u PENDING narudzbinu (kuvar je jos nije video)
            // Ako je vec 'preparing', ne diraj je - kreiraj novu dole
            const kitchenOrder = DB.kitchenOrders.find(ko =>
                ko.status === 'pending' &&
                ko.tableNum === table.num &&
                ko.waiterUsername === DB.currentUser.username
            );

            if(kitchenOrder) {
                const kitchenItem = kitchenOrder.items.find(i => i.id === itemId);
                if(kitchenItem) {
                    kitchenItem.qty++;
                } else {
                    kitchenOrder.items.push({
                        id: menuItem.id,
                        name: menuItem.name,
                        qty: 1
                    });
                }
                kitchenOrder.orderedAt = new Date().toISOString();
            }
        }
    } else {
        // Dodaj novu stavku sa createdBy poljem
        table.order.push({
            ...menuItem, 
            qty: 1,
            createdBy: DB.currentUser.username,
            addedAt: new Date().toISOString()
        });
        
        // 🍳 Ako ide u kuhinju, pošalji!
        if(shouldSendToKitchen(menuItem)) {
            console.log('🍳 Slanje u kuhinju:', menuItem.name);
            
            // Pronađi postojeću PENDING narudžbinu (kuvar je jos nije video)
            // Ako je 'preparing' - kuvar vec radi na njoj, ne dodajemo u nju
            let kitchenOrder = DB.kitchenOrders.find(ko =>
                ko.status === 'pending' &&
                ko.tableNum === table.num &&
                ko.waiterUsername === DB.currentUser.username
            );
            
            if(kitchenOrder) {
                // Dodaj u postojeću narudžbinu
                kitchenOrder.items.push({
                    id: menuItem.id,
                    name: menuItem.name,
                    qty: 1
                });
                kitchenOrder.orderedAt = new Date().toISOString();
                console.log('✅ Dodato u postojeću narudžbinu');
            } else {
                // Kreiraj novu kuhinjsku narudžbinu
                const newKitchenOrder = {
                    id: Date.now(),
                    tableNum: table.num,
                    tableName: table.name,
                    waiterUsername: DB.currentUser.username,
                    waiterName: DB.konobarName || DB.currentUser.username,
                    items: [{
                        id: menuItem.id,
                        name: menuItem.name,
                        qty: 1
                    }],
                    status: 'pending', // 'pending', 'preparing', 'ready', 'completed'
                    orderedAt: new Date().toISOString(),
                    readyAt: null,
                    completedAt: null
                };
                
                DB.kitchenOrders.push(newKitchenOrder);
                console.log('✅ Nova kuhinjska narudžbina kreirana');
            }
        }
    }
    
    // ✅ RACE FIX: Obeleži sto kao izmenjen lokalno - sprečava da load sa
    // drugog uređaja prepiše upravo dodate stavke pre nego što se snimi.
    if (typeof markTableDirty === 'function') markTableDirty(table.num);

    // Koristi debounced save za brzo dodavanje stavki (klik-klik-klik)
    // Sprečava 10 brzih klikova = 10 Firebase upisa, umesto toga 1 upis
    if (typeof saveDebounced === 'function') {
        saveDebounced();
    } else {
        save();
    }
    render();
}


function renderTableOrder(c) {
    const table = DB.tables.find(t=>t.num===DB.selectedTable);
    if(!table) { DB.selectedTable=null; render(); return; }

    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    
    // Filtriraj samo stavke trenutnog konobara
    let myOrder = table.order;
    if (isWaiter) {
        myOrder = table.order.filter(item => 
            !item.createdBy || item.createdBy === currentUsername
        );
    }

    // Inicijalizuj discountedItems ako ne postoji
    if(!table.discountedItems) table.discountedItems = [];
    if(table.discountPercent === undefined) table.discountPercent = 0;

    const sub = myOrder.reduce((s,i)=>s+(i.price*i.qty),0);
    
    // Izračunaj popust (SVA KORISNICI MOGU DA KORISTE)
    let discountAmount = 0;
    if(table.discountPercent > 0 && table.discountedItems.length > 0) {
        myOrder.forEach(item => {
            if(table.discountedItems.includes(item.id)) {
                discountAmount += (item.price * item.qty * table.discountPercent / 100);
            }
        });
    }
    
    const tot = Math.max(0, sub - discountAmount);

    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="page='${table.isGarden ? 'garden' : 'tables'}';render()">← ${table.name}</button>
        <h2>${isWaiter ? 'Moja Narudžba' : 'Narudžba'}</h2>
        <div style="width:80px"></div>
    </div>`;

    if(myOrder.length === 0) {
        h += '<div class="empty"><div style="font-size:64px">🍽️</div><h3>Narudžba je prazna</h3><p>Dodajte stavke</p></div>';
    } else {
        myOrder.forEach(i => {
            const isDiscounted = table.discountedItems.includes(i.id);
            const itemDiscount = isDiscounted ? (i.price * i.qty * table.discountPercent / 100) : 0;
            const itemTotal = (i.price * i.qty) - itemDiscount;
            
            h += `<div class="card" style="cursor:default;${isDiscounted ? 'border:2px solid #4CAF50' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="flex:1">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">`;
            
            // Checkbox za discount - SVI MOGU DA KORISTE
            h += `<input type="checkbox" 
                       id="disc_${i.id}" 
                       ${isDiscounted ? 'checked' : ''} 
                       onchange="toggleDiscountItem(${table.num}, ${i.id})"
                       style="width:20px;height:20px;cursor:pointer;accent-color:#4CAF50">`;
            
            h += `<h3>${i.name}</h3>`;
            if(isDiscounted && table.discountPercent > 0) {
                h += `<span style="background:#4CAF50;color:white;padding:2px 8px;border-radius:4px;font-size:11px">-${table.discountPercent}%</span>`;
            }
            h += `</div>
                        <p style="color:#B0B0B0;font-size:13px">${i.price} × ${i.qty} = ${i.price*i.qty} din.`;
            if(itemDiscount > 0) {
                h += ` (-${itemDiscount.toFixed(0)} din.)`;
            }
            h += `</p>
                    </div>`;
            h += `<div style="display:flex;gap:8px;align-items:center">
                        <button onclick="changeTableQty(${table.num},${i.id},-1,'${i.createdBy || ''}')" style="background:#16213E;color:#FFF;border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px">−</button>
                        <span style="color:#FFD700;font-weight:bold;min-width:24px;text-align:center">${i.qty}</span>
                        <button onclick="changeTableQty(${table.num},${i.id},1,'${i.createdBy || ''}')" style="background:#16213E;color:#FFF;border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px">+</button>
                        <button onclick="delTableItem(${table.num},${i.id},'${i.createdBy || ''}')" style="background:transparent;color:#E94560;border:none;cursor:pointer;font-size:20px;padding:4px">🗑️</button>
                    </div>
                </div>
            </div>`;
        });

        h += `<div style="background:#0F3460;padding:20px;border-radius:12px;margin-top:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span>Subtotal:</span>
                <span>${sub.toFixed(0)} din.</span>
            </div>
            
            <!-- Discount sekcija - SVI MOGU DA KORISTE -->
            <div style="margin:16px 0;padding:16px;background:#16213E;border-radius:8px">
                <label style="color:#4CAF50;font-weight:bold;display:block;margin-bottom:8px">
                    💚 Popust (%)
                </label>
`;
                if(table.discountedItems.length > 0) {
                    h += `<span style="color:#B0B0B0;font-size:12px;font-weight:normal"> - ${table.discountedItems.length} ${table.discountedItems.length === 1 ? 'artikal' : 'artikla'} označeno</span>`;
                }
                h += `
                <input type="number" 
                       value="${table.discountPercent}" 
                       onchange="setTableDiscountPercent(${table.num}, this.value)" 
                       placeholder="0"
                       min="0"
                       max="100"
                       style="margin:0">
                <p style="color:#B0B0B0;font-size:12px;margin-top:8px">
                    ${table.discountedItems.length === 0 ? '👆 Prvo označite artikle gore (✓) pa unesite %' : '✓ Označeni artikli dobijaju popust'}
                </p>
            </div>
            
`;
            if(discountAmount > 0) {
                h += `<div style="display:flex;justify-content:space-between;margin-bottom:8px;color:#4CAF50">
                    <span>Popust (${table.discountPercent}%):</span>
                    <span>-${discountAmount.toFixed(0)} din.</span>
                </div>`;
            }
            h += `
            
            <div style="display:flex;justify-content:space-between;font-size:24px;font-weight:bold;border-top:2px solid #2A2A4A;padding-top:12px">
                <span>UKUPNO:</span>
                <span style="color:#FFD700">${tot.toFixed(0)} din.</span>
            </div>
            <div style="display:flex;gap:8px;margin-top:16px">
                <button class="btn btn-secondary" onclick="clearTable(${table.num})">Očisti Sto</button>
                <button class="btn" onclick="proceedToPayment(${table.num})">💳 Naplati</button>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
                <button class="btn btn-secondary" style="flex:1;min-width:120px;font-size:13px" onclick="openSplitBill(${table.num})">✂️ Podeli Račun</button>
                <button class="btn btn-secondary" style="flex:1;min-width:120px;font-size:13px" onclick="openTransferTable(${table.num})">🔄 Prebaci Sto</button>
                <button class="btn btn-secondary" style="flex:1;min-width:120px;font-size:13px" onclick="openTransferWaiter(${table.num})">👤 Predaj Konobaru</button>
            </div>
        </div>`;
    }

    c.innerHTML = h;
}


function toggleDiscountItem(tableNum, itemId) {
    const table = DB.tables.find(t=>t.num===tableNum);
    if(!table.discountedItems) table.discountedItems = [];
    
    const index = table.discountedItems.indexOf(itemId);
    if(index > -1) {
        table.discountedItems.splice(index, 1);
    } else {
        table.discountedItems.push(itemId);
    }

    if (typeof markTableDirty === 'function') markTableDirty(table.num);
    save();
    render();
}


function setTableDiscountPercent(tableNum, val) {
    const table = DB.tables.find(t=>t.num===tableNum);
    const percent = parseFloat(val) || 0;
    table.discountPercent = Math.max(0, Math.min(100, percent)); // Ograniči na 0-100%
    if (typeof markTableDirty === 'function') markTableDirty(table.num);
    save();
    render();
}


function changeTableQty(tableNum, itemId, delta, createdBy) {
    const table = DB.tables.find(t=>t.num===tableNum);
    
    // Pronađi stavku - backward compatible sa starim stavkama bez createdBy
    let item;
    if (createdBy && createdBy !== '') {
        // Nova stavka sa createdBy
        item = table.order.find(i=>i.id===itemId && i.createdBy===createdBy);
    } else {
        // Stara stavka bez createdBy - pronađi bilo koju sa tim ID-em
        item = table.order.find(i=>i.id===itemId && !i.createdBy);
    }
    
    if(item) {
        // Proveri da li trenutni korisnik sme da menja ovu stavku
        const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
        
        // Admin može sve
        // Konobar može samo svoje (ili stare stavke bez createdBy)
        if (isWaiter && item.createdBy && item.createdBy !== DB.currentUser.username) {
            showAlert('Ne možete menjati stavke drugih konobara!');
            return;
        }
        
        item.qty += delta;
        if(item.qty <= 0) delTableItem(tableNum, itemId, createdBy);
        else {
            // Ažuriraj količinu u PENDING kuhinjskoj narudžbini
            if (delta < 0 && shouldSendToKitchen(item)) {
                const kitchenOrder = DB.kitchenOrders.find(ko =>
                    ko.status === 'pending' &&
                    ko.tableNum === tableNum &&
                    ko.waiterUsername === DB.currentUser.username
                );
                if (kitchenOrder) {
                    const kitchenItem = kitchenOrder.items.find(i => i.id === itemId);
                    if (kitchenItem) {
                        kitchenItem.qty += delta;
                        if (kitchenItem.qty <= 0) {
                            kitchenOrder.items = kitchenOrder.items.filter(i => i.id !== itemId);
                        }
                        // Obrisi celu narudzbinu ako nema stavki
                        if (kitchenOrder.items.length === 0) {
                            DB.kitchenOrders = DB.kitchenOrders.filter(ko => ko !== kitchenOrder);
                        }
                    }
                }
            }
            if (typeof markTableDirty === 'function') markTableDirty(tableNum);
            if (typeof saveDebounced === 'function') saveDebounced();
            else save();
            render();
        }
    }
}


function delTableItem(tableNum, itemId, createdBy) {
    const table = DB.tables.find(t=>t.num===tableNum);
    
    // Pronađi stavku - backward compatible sa starim stavkama bez createdBy
    let item;
    if (createdBy && createdBy !== '') {
        // Nova stavka sa createdBy
        item = table.order.find(i=>i.id===itemId && i.createdBy===createdBy);
    } else {
        // Stara stavka bez createdBy - pronađi bilo koju sa tim ID-em
        item = table.order.find(i=>i.id===itemId && !i.createdBy);
    }
    
    if(item) {
        // Proveri da li trenutni korisnik sme da briše ovu stavku
        const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
        
        // Admin može sve
        // Konobar može samo svoje (ili stare stavke bez createdBy)
        if (isWaiter && item.createdBy && item.createdBy !== DB.currentUser.username) {
            showAlert('Ne možete brisati stavke drugih konobara!');
            return;
        }
        
        // Zabeleži uklonjeni artikal
        DB.removedItems.push({
            itemId: item.id,
            itemName: item.name,
            itemPrice: item.price,
            quantity: item.qty,
            tableNum: tableNum,
            tableName: table.name,
            removedBy: DB.konobarName || DB.currentUser.username,
            removedAt: new Date().toISOString(),
            reason: 'Uklonjeno iz narudžbine'
        });
    }
    
    // Obriši iz PENDING kuhinjske narudžbine (kuvar još nije video)
    if (item && shouldSendToKitchen(item)) {
        const kitchenOrder = DB.kitchenOrders.find(ko =>
            ko.status === 'pending' &&
            ko.tableNum === tableNum &&
            ko.waiterUsername === (createdBy || DB.currentUser.username)
        );
        if (kitchenOrder) {
            kitchenOrder.items = kitchenOrder.items.filter(i => i.id !== itemId);
            // Obrisi celu narudzbinu ako nema stavki
            if (kitchenOrder.items.length === 0) {
                DB.kitchenOrders = DB.kitchenOrders.filter(ko => ko !== kitchenOrder);
            }
        }
    }

    // Briši stavku - backward compatible
    if (createdBy && createdBy !== '') {
        table.order = table.order.filter(i=>!(i.id===itemId && i.createdBy===createdBy));
    } else {
        table.order = table.order.filter(i=>!(i.id===itemId && !i.createdBy));
    }

    if (typeof markTableDirty === 'function') markTableDirty(tableNum);
    save();
    render();
}


function setTableDiscount(tableNum, val) {
    const table = DB.tables.find(t=>t.num===tableNum);
    table.discount = parseFloat(val) || 0;
    if (typeof markTableDirty === 'function') markTableDirty(tableNum);
    save();
    render();
}


function clearTable(tableNum) {
    const table = DB.tables.find(t=>t.num===tableNum);
    if(!table) return;
    
    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    
    // Filtriraj samo njegove stavke
    let myOrder = table.order;
    if (isWaiter) {
        myOrder = table.order.filter(item => 
            !item.createdBy || item.createdBy === currentUsername
        );
    }
    
    if(myOrder.length === 0) {
        showAlert(isWaiter ? 'Nemate stavki na ovom stolu' : 'Sto je već prazan');
        return;
    }
    
    const message = isWaiter 
        ? `Sigurno želite da očistite svoje stavke sa ${table.name}?` 
        : `Sigurno želite da očistite ${table.name}?`;
    
    showConfirm('Očisti Sto', message, (confirmed) => {
        if(confirmed) {
            // Zapiši sve uklonjene artikle
            myOrder.forEach(item => {
                DB.removedItems.push({
                    itemId: item.id,
                    itemName: item.name,
                    itemPrice: item.price,
                    quantity: item.qty,
                    tableNum: tableNum,
                    tableName: table.name,
                    removedBy: DB.konobarName || DB.currentUser.username,
                    removedAt: new Date().toISOString(),
                    reason: 'Očišćen ceo sto'
                });
            });
            
            // KONOBAR: Briši samo njegove stavke
            // ADMIN: Briši sve
            if (isWaiter) {
                table.order = table.order.filter(item => item.createdBy !== currentUsername);
            } else {
                table.order = [];
                table.discount = 0;
                table.discountPercent = 0;
                table.discountedItems = [];
            }

            if (typeof markTableDirty === 'function') markTableDirty(tableNum);
            save();

            // Vrati se na stranicu stolova
            DB.selectedTable = null;
            page = 'tables';
            render();
        }
    });
}


function proceedToPayment(tableNum) {
    const table = DB.tables.find(t=>t.num===tableNum);
    
    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    
    // Filtriraj samo njegove stavke
    let myOrder = table.order;
    if (isWaiter) {
        myOrder = table.order.filter(item => 
            !item.createdBy || item.createdBy === currentUsername
        );
    }
    
    if(myOrder.length === 0) { 
        showAlert(isWaiter ? 'Nemate stavki na ovom stolu' : 'Sto je prazan'); 
        return; 
    }
    
    page = 'payment';
    render();
}


function renderPayment(c) {
    const table = DB.tables.find(t=>t.num===DB.selectedTable);
    
    // Postavi default za fiskalni toggle na osnovu admin podešavanja
    if (typeof OCTOPOS_CONFIG !== 'undefined' && OCTOPOS_CONFIG.enabled) {
        if (window._lastPayMethodForOcto !== payMethod) {
            window._lastPayMethodForOcto = payMethod;
            if (payMethod === 'Card') window.octoposSendThis = OCTOPOS_CONFIG.autoSendCard !== false;
            else if (payMethod === 'Wire') window.octoposSendThis = !!DB.settings.octoposAutoWire;
            else if (payMethod === 'Cash') window.octoposSendThis = !!OCTOPOS_CONFIG.autoSendCash;
            else window.octoposSendThis = false;
        }
    }
    
    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    
    // Filtriraj samo njegove stavke
    let myOrder = table.order;
    if (isWaiter) {
        myOrder = table.order.filter(item => 
            !item.createdBy || item.createdBy === currentUsername
        );
    }
    
    const sub = myOrder.reduce((s,i)=>s+(i.price*i.qty),0);
    
    // Izračunaj popust (SVI MOGU DA KORISTE)
    let discountAmount = 0;
    if(table.discountPercent > 0 && table.discountedItems && table.discountedItems.length > 0) {
        myOrder.forEach(item => {
            if(table.discountedItems.includes(item.id)) {
                discountAmount += (item.price * item.qty * table.discountPercent / 100);
            }
        });
    }
    
    const tot = Math.max(0, sub - discountAmount);
    
    let discountInfo = '';
    if(discountAmount > 0) {
        discountInfo = `<div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:12px">
            <div style="color:#4CAF50;font-size:14px;margin-bottom:4px">
                💚 Popust ${table.discountPercent}% na ${table.discountedItems.length} ${table.discountedItems.length === 1 ? 'artikal' : 'artikla'}
            </div>
            <div style="color:#B0B0B0;font-size:12px">
                Subtotal: ${sub.toFixed(0)} din. | Popust: -${discountAmount.toFixed(0)} din.
            </div>
        </div>`;
    }
    
    c.innerHTML = `<div style="margin-bottom:24px"><button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="page='tableorder';render()">← Nazad</button></div>
        <div style="background:#0F3460;padding:20px;border-radius:12px;text-align:center;margin-bottom:24px">
            <p style="color:#B0B0B0">${table.name} - ${isWaiter ? 'Moje' : 'Ukupno'}</p>
            ${discountInfo}
            <h1 style="color:#FFD700;font-size:48px">${tot.toFixed(0)} din.</h1>
            ${isWaiter ? `<p style="color:#B0B0B0;font-size:13px;margin-top:8px">(${myOrder.length} ${myOrder.length === 1 ? 'stavka' : myOrder.length < 5 ? 'stavke' : 'stavki'})</p>` : ''}
        </div>
        <div onclick="window.isFiscalReceipt=!window.isFiscalReceipt;render()" style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:16px;padding:14px;background:#16213E;border-radius:8px;cursor:pointer;border:2px solid ${window.isFiscalReceipt ? '#00BCD4' : '#2A2A4A'}">
            <div style="width:24px;height:24px;border-radius:4px;border:2px solid ${window.isFiscalReceipt ? '#00BCD4' : '#555'};background:${window.isFiscalReceipt ? '#00BCD4' : 'transparent'};display:flex;align-items:center;justify-content:center">
                ${window.isFiscalReceipt ? '<span style="color:#FFF;font-weight:bold;font-size:16px">✓</span>' : ''}
            </div>
            <span style="color:${window.isFiscalReceipt ? '#00BCD4' : '#888'};font-weight:bold;font-size:15px">🧾 Kucani račun (fiskalni)</span>
        </div>
        <h3 style="text-align:center;margin:24px 0;color:#B0B0B0">Način plaćanja</h3>
        <div style="display:flex;gap:16px">
            <div class="payment-option ${payMethod==='Cash'?'selected':''}" onclick="payMethod='Cash';render()">
                <div style="font-size:48px">💵</div><h3>Cash</h3>
            </div>
            <div class="payment-option ${payMethod==='Card'?'selected':''}" onclick="payMethod='Card';render()">
                <div style="font-size:48px">💳</div><h3>Card</h3>
            </div>
            <div class="payment-option ${payMethod==='Wire'?'selected':''}" onclick="payMethod='Wire';render()">
                <div style="font-size:48px">🏦</div><h3>Prenos</h3>
            </div>
        </div>
        ${typeof OCTOPOS_CONFIG !== 'undefined' && OCTOPOS_CONFIG.enabled ? `
        <div onclick="window.octoposSendThis=!window.octoposSendThis;render()" style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:16px;padding:12px;background:#16213E;border-radius:8px;cursor:pointer;border:2px solid ${window.octoposSendThis ? '#4CAF50' : '#2A2A4A'}">
            <div style="width:40px;height:22px;border-radius:11px;background:${window.octoposSendThis ? '#4CAF50' : '#555'};position:relative;transition:0.3s">
                <div style="position:absolute;top:2px;${window.octoposSendThis ? 'right:2px' : 'left:2px'};width:18px;height:18px;border-radius:50%;background:white;transition:0.3s"></div>
            </div>
            <span style="color:${window.octoposSendThis ? '#4CAF50' : '#888'};font-weight:bold;font-size:14px">🧾 Fiskalni račun</span>
        </div>
        ` : ''}
        <button class="btn" style="margin-top:16px" ${!payMethod?'disabled':''} onclick="confirmPay()">Potvrdi</button>
        <div style="display:flex;gap:12px;margin-top:12px">
            <button class="btn" style="flex:1;background:#E94560" onclick="showDebtModal()">📝 Zapiši na Dug</button>
            <button class="btn" style="flex:1;background:#FF9800" onclick="showHouseModal()">🏠 Kuća</button>
        </div>`;
}


function confirmPay() {
    if(!payMethod) return;
    const table = DB.tables.find(t=>t.num===DB.selectedTable);
    
    const isWaiter = DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter');
    const currentUsername = DB.currentUser ? DB.currentUser.username : null;
    
    // Filtriraj samo njegove stavke
    let myOrder = table.order;
    if (isWaiter) {
        myOrder = table.order.filter(item => 
            !item.createdBy || item.createdBy === currentUsername
        );
    }
    
    const sub = myOrder.reduce((s,i)=>s+(i.price*i.qty),0);
    
    // Izračunaj popust (SVI KORISNICI)
    let discountAmount = 0;
    if(table.discountPercent > 0 && table.discountedItems && table.discountedItems.length > 0) {
        myOrder.forEach(item => {
            if(table.discountedItems.includes(item.id)) {
                discountAmount += (item.price * item.qty * table.discountPercent / 100);
            }
        });
    }
    
    const tot = Math.max(0, sub - discountAmount);
    
    const newOrder = {
        id:Date.now(),
        table:table.num,
        tableName: table.name,
        items:[...myOrder],  // Samo njegove stavke!
        sub,
        disc:discountAmount,
        discountPercent: table.discountPercent || 0,
        discountedItems: [...(table.discountedItems || [])],
        tot,
        method:payMethod,
        createdBy: DB.konobarName || DB.currentUser.username,
        time:new Date().toISOString(),
        isFiscal: !!window.isFiscalReceipt
    };
    
    DB.orders.push(newOrder);
    
    // 🧾 OCTOPOS INTEGRACIJA - pošalji fiskalni račun ako je konobar uključio toggle
    if (typeof sendToOctopos === 'function' && OCTOPOS_CONFIG && OCTOPOS_CONFIG.enabled && window.octoposSendThis) {
        newOrder.octoposRequested = true;
        sendToOctopos(newOrder, true).then(result => {
            if (result.success) {
                console.log('✅ OctoPOS fiskalni račun kreiran:', result.receiptId);
                // Ažuriraj order sa OctoPOS ID-jem
                save();
            } else if (result.error && !result.error.includes('isključeno')) {
                console.warn('⚠️ OctoPOS:', result.error);
                // Prikaži upozorenje samo ako je greška (ne ako je isključeno za taj tip)
                if (OCTOPOS_CONFIG.enabled) {
                    setTimeout(() => {
                        showAlert('⚠️ OctoPOS: ' + result.error + '\n\nRačun je sačuvan u aplikaciji.');
                    }, 1500);
                }
            }
        }).catch(err => {
            console.error('❌ OctoPOS error:', err);
        });
    }
    
    // Oduzmi iz lagera
    if (typeof deductInventoryOnPayment === 'function') {
        deductInventoryOnPayment(myOrder);
    }
    
    // KONOBAR: Briši samo njegove stavke
    // ADMIN: Briši sve
    if (isWaiter) {
        table.order = table.order.filter(item => item.createdBy !== currentUsername);
    } else {
        table.order = [];
        table.discount = 0;
        table.discountPercent = 0;
        table.discountedItems = [];
    }

    // ✅ RACE FIX: Obeleži sto kao dirty da drugi uređaji ne vrate staru
    // narudžbinu (pre sync-a) i tako naplatu dupliciraju.
    if (typeof markTableDirty === 'function') markTableDirty(table.num);
    save();

    page='receipt';
    render();
}


function renderReceipt(c) {
    const o = DB.orders[DB.orders.length-1];
    if(!o) { c.innerHTML='<div class="empty">Nema narudžbi</div>'; return; }
    let h = `<div class="success"><div class="success-icon">✅</div><h2 style="color:#4CAF50;margin-bottom:24px">Plaćanje uspešno!</h2>
        <div style="background:#0F3460;padding:20px;border-radius:12px;max-width:400px;margin:0 auto">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>Sto ${o.table}</span><span>#${String(DB.orders.length).padStart(4,'0')}</span></div>
            <hr style="border:none;border-top:1px solid #2A2A4A;margin:12px 0">`;
    o.items.forEach(i => {
        const isDiscounted = o.discountedItems && o.discountedItems.includes(i.id);
        const itemTotal = i.price * i.qty;
        h += `<div style="display:flex;justify-content:space-between;margin:4px 0">
            <span>${i.qty}x ${i.name}${isDiscounted && o.discountPercent ? ` <span style="color:#4CAF50;font-size:11px">(-${o.discountPercent}%)</span>` : ''}</span>
            <span>${itemTotal} din.</span>
        </div>`;
    });
    h += `<hr style="border:none;border-top:1px solid #2A2A4A;margin:12px 0">`;
    if(o.disc>0) h += `<div style="display:flex;justify-content:space-between;color:#4CAF50"><span>Popust${o.discountPercent ? ` (${o.discountPercent}%)` : ''}:</span><span>- ${o.disc.toFixed(0)} din.</span></div>`;
    h += `<div style="display:flex;justify-content:space-between;font-size:20px;font-weight:bold;margin-top:8px">
            <span>UKUPNO:</span><span style="color:#FFD700">${o.tot.toFixed(0)} din.</span>
        </div>
        <hr style="border:none;border-top:1px solid #2A2A4A;margin:12px 0">
        <div style="display:flex;justify-content:space-between"><span>Plaćanje:</span><span>${o.method==='Cash'?'💵':o.method==='Wire'?'🏦':'💳'} ${o.method==='Wire'?'Prenos':o.method}</span></div>
        ${o.isFiscal ? '<div style="display:flex;justify-content:space-between;margin-top:8px;color:#00BCD4"><span>🧾 Kucani račun:</span><span>✅ Da</span></div>' : ''}
        ${o.octoposSent ? '<div style="display:flex;justify-content:space-between;margin-top:8px;color:#4CAF50"><span>🧾 Fiskalni račun:</span><span>✅ #' + (o.octoposId || '') + '</span></div>' : (o.octoposRequested ? '<div style="display:flex;justify-content:space-between;margin-top:8px;color:#FF9800"><span>🧾 Fiskalni račun:</span><span>⏳ Šalje se...</span></div>' : (typeof OCTOPOS_CONFIG !== 'undefined' && OCTOPOS_CONFIG.enabled ? '<div style="display:flex;justify-content:space-between;margin-top:8px;color:#888"><span>🧾 Fiskalni račun:</span><span>— Nije tražen</span></div>' : ''))}
    </div>
    ${o.fiscalReceipt ? '<button class="btn" style="max-width:400px;margin:16px auto 0;background:#00BCD4" onclick="showFiscalReceipt(' + o.id + ')">🧾 Prikaži Fiskalni Račun</button>' : ''}
    <button class="btn" style="max-width:400px;margin:16px auto 0" onclick="newOrder()">Nazad na Stolove</button>
</div>`;
    
    // Ako se fiskalni račun još šalje, proveri ponovo za 2 sekunde
    if (o.octoposRequested && !o.octoposSent) {
        setTimeout(function() { if (page === 'receipt') render(); }, 2000);
    }
    
    c.innerHTML = h;
}


function newOrder() {
    DB.selectedTable = null;
    payMethod = '';
    window.octoposSendThis = false;
    window.isFiscalReceipt = false;
    window._lastPayMethodForOcto = null;
    page = 'tables';
    render();
}


function showFiscalReceipt(orderId) {
    var order = DB.orders.find(function(o) { return o.id === orderId; });
    if (!order || !order.fiscalReceipt) {
        showAlert('❌ Fiskalni račun nije dostupan za ovu narudžbinu');
        return;
    }
    
    var receipt = order.fiscalReceipt;
    var text = '';
    
    // Ako je string (tekstualni prikaz)
    if (typeof receipt === 'string') {
        text = receipt;
    }
    // Ako je objekat sa TextualRepresentation
    else if (receipt.TextualRepresentation) {
        text = receipt.TextualRepresentation;
    }
    // Ako je objekat sa Data.TextualRepresentation
    else if (receipt.Data && receipt.Data.TextualRepresentation) {
        text = receipt.Data.TextualRepresentation;
    }
    // Fallback: JSON prikaz
    else {
        text = JSON.stringify(receipt, null, 2);
    }
    
    var h = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px" onclick="this.remove()">';
    h += '<div onclick="event.stopPropagation()" style="background:#FFF;color:#000;padding:20px;border-radius:8px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto;font-family:monospace;font-size:12px;white-space:pre-wrap;line-height:1.4">';
    h += '<div style="text-align:right;margin-bottom:8px"><button onclick="this.parentElement.parentElement.remove()" style="background:#E94560;color:#FFF;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:14px">✕ Zatvori</button></div>';
    h += text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    h += '</div></div>';
    
    document.body.insertAdjacentHTML('beforeend', h);
}


function renderRemoved(c) {
    const bdRange = typeof getBusinessDayRange === 'function' ? getBusinessDayRange() : { start: new Date().toISOString().split('T')[0] + 'T00:00:00', end: new Date().toISOString().split('T')[0] + 'T23:59:59' };
    const todayRemoved = DB.removedItems.filter(r => r.removedAt && r.removedAt >= bdRange.start && r.removedAt < bdRange.end);
    const allRemoved = DB.removedItems;
    
    // Grupisanje po danima
    const groupedByDate = {};
    allRemoved.forEach(item => {
        const date = new Date(item.removedAt).toLocaleDateString('sr-RS');
        if(!groupedByDate[date]) groupedByDate[date] = [];
        groupedByDate[date].push(item);
    });
    
    // Statistika
    const totalValue = todayRemoved.reduce((sum, item) => sum + (item.itemPrice * item.quantity), 0);
    const totalItems = todayRemoved.reduce((sum, item) => sum + item.quantity, 0);
    
    let h = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
            <h2>🗑️ Uklonjeni Artikli</h2>
            ${DB.removedItems.length > 0 ? `<button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="clearRemovedItems()">Očisti sve</button>` : ''}
        </div>
        
        <p style="color:#B0B0B0;text-align:center;margin:8px 0 20px">${new Date().toLocaleDateString('sr-RS')}</p>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px">
            <div class="stat-card">
                <div class="stat-label">Uklonjeno danas</div>
                <div class="stat-value" style="color:#E94560">${totalItems}</div>
                <div class="stat-label">kom</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Vrednost</div>
                <div class="stat-value" style="color:#FF9800">${totalValue.toFixed(0)}</div>
                <div class="stat-label">din.</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ukupno (svi dani)</div>
                <div class="stat-value" style="color:#B0B0B0">${allRemoved.length}</div>
                <div class="stat-label">unosa</div>
            </div>
        </div>
    `;
    
    if(allRemoved.length === 0) {
        h += '<div class="empty"><div style="font-size:64px">✅</div><h3>Nema uklonjenih artikala</h3><p>Sve je uredu!</p></div>';
    } else {
        // Prikaz po danima (najnoviji prvo)
        const dates = Object.keys(groupedByDate).sort((a, b) => {
            const dateA = new Date(a.split('.').reverse().join('-'));
            const dateB = new Date(b.split('.').reverse().join('-'));
            return dateB - dateA;
        });
        
        dates.forEach(date => {
            const items = groupedByDate[date];
            const isToday = date === new Date().toLocaleDateString('sr-RS');
            
            h += `
                <div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:16px">
                    <h3 style="color:#E94560;margin-bottom:16px">
                        ${isToday ? '📅 Danas' : '📅 ' + date}
                        <span style="color:#B0B0B0;font-size:14px;font-weight:normal;margin-left:12px">
                            (${items.length} ${items.length === 1 ? 'unos' : 'unosa'})
                        </span>
                    </h3>
            `;
            
            items.forEach((item, idx) => {
                const time = new Date(item.removedAt).toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
                h += `
                    <div class="card" style="cursor:default;margin-bottom:${idx === items.length - 1 ? '0' : '8px'}">
                        <div style="display:flex;justify-content:space-between;align-items:start">
                            <div style="flex:1">
                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                                    <h3>${item.itemName}</h3>
                                    <span style="background:#E94560;color:white;padding:2px 8px;border-radius:4px;font-size:11px">
                                        ${item.quantity}x
                                    </span>
                                </div>
                                <p style="color:#B0B0B0;font-size:13px">
                                    🪑 ${item.tableName} · 
                                    👤 ${item.removedBy} · 
                                    🕐 ${time}
                                </p>
                            </div>
                            <div style="text-align:right">
                                <div style="color:#FF9800;font-size:18px;font-weight:bold">
                                    ${(item.itemPrice * item.quantity).toFixed(0)} din.
                                </div>
                                <div style="color:#B0B0B0;font-size:12px">
                                    ${item.itemPrice} × ${item.quantity}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            h += `</div>`;
        });
    }
    
    c.innerHTML = h;
}


function clearRemovedItems() {
    showConfirm('Obriši Evidenciju', 'Obrisati sve uklonjene artikle iz evidencije?', (confirmed) => {
        if(confirmed) {
            DB.removedItems = [];
            save();
            render();
        }
    });
}

