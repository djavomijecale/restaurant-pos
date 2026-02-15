// ============================================
// SHOPPING / GROCERY LIST
// ============================================



function renderShopping(c) {
    const isKuvar = DB.currentUser && DB.currentUser.role === 'kuvar';
    const isKonobar = DB.currentUser && DB.currentUser.role === 'konobar';
    const isAdmin = DB.currentUser && DB.currentUser.role === 'admin';
    
    // MIGRACIJA: Dodaj type polje ako ne postoji
    DB.groceryList.forEach(item => {
        if(!item.type) {
            // Default: ako je u kategorijama za hranu, stavi Hrana, inače Piće
            const foodCategories = ['Povrće', 'Meso', 'Suvo', 'Začini', 'Mlečno'];
            item.type = foodCategories.includes(item.category) ? 'Hrana' : 'Piće';
        }
    });
    
    // FILTRIRAJ PREMA ULOZI
    let filteredList = DB.groceryList;
    if(isKuvar) {
        filteredList = DB.groceryList.filter(item => item.type === 'Hrana');
    } else if(isKonobar) {
        filteredList = DB.groceryList.filter(item => item.type === 'Piće');
    }
    // Admin vidi sve
    
    // Grupiši namirnice po kategorijama
    const categories = {};
    filteredList.forEach(item => {
        if(!categories[item.category]) {
            categories[item.category] = [];
        }
        categories[item.category].push(item);
    });
    
    // Broj potrebnih namirnica
    const neededCount = filteredList.filter(item => item.needed).length;
    
    // Naslov prema ulozi
    let title = '🛒 Nabavka Namirnica';
    if(isKuvar) {
        title = '🛒 Nabavka Namirnica - Hrana';
    } else if(isKonobar) {
        title = '🛒 Nabavka Namirnica - Piće';
    }
    
    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h2>${title}</h2>
        <div style="font-size:14px;color:#B0B0B0">
            ${neededCount} ${neededCount === 1 ? 'namirnica' : neededCount < 5 ? 'namirnice' : 'namirnica'} potrebno
        </div>
    </div>`;
    
    if(isKuvar) {
        h += `<div style="background:#0F3460;padding:16px;border-radius:12px;margin-bottom:20px;border-left:4px solid #FFD700">
            <p style="color:#FFD700;font-weight:bold;margin-bottom:8px">💡 Uputstvo:</p>
            <p style="color:#B0B0B0;font-size:13px;line-height:1.6">
                Označite namirnice za HRANU koje fale. Admin će dobiti obaveštenje.
            </p>
        </div>`;
    }
    
    if(isKonobar) {
        h += `<div style="background:#0F3460;padding:16px;border-radius:12px;margin-bottom:20px;border-left:4px solid #FFD700">
            <p style="color:#FFD700;font-weight:bold;margin-bottom:8px">💡 Uputstvo:</p>
            <p style="color:#B0B0B0;font-size:13px;line-height:1.6">
                Označite PIĆE koje fali. Admin će dobiti obaveštenje.
            </p>
        </div>`;
    }
    
    if(isAdmin && neededCount > 0) {
        h += `<div style="background:#E94560;padding:20px;border-radius:12px;margin-bottom:20px">
            <div style="text-align:center;margin-bottom:16px">
                <div style="font-size:48px;margin-bottom:8px">🔔</div>
                <h3 style="color:#FFF;margin:0">POTREBNE NAMIRNICE!</h3>
                <p style="color:#FFF;opacity:0.9;margin-top:8px">
                    ${neededCount} ${neededCount === 1 ? 'namirnica treba' : neededCount < 5 ? 'namirnice treba' : 'namirnica treba'} da se nabavi
                </p>
            </div>
            <button class="btn" style="background:#FFF;color:#E94560" onclick="markAllAsOrdered()">
                ✅ Označi Sve Kao Nabavljeno
            </button>
        </div>`;
    }
    
    // Prikaz po kategorijama
    Object.keys(categories).sort().forEach(category => {
        const items = categories[category];
        const neededInCategory = items.filter(i => i.needed).length;
        
        h += `<div style="margin-bottom:24px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h3 style="color:#FFD700;margin:0">📁 ${category}</h3>
                ${neededInCategory > 0 ? `<span style="background:#E94560;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold">${neededInCategory}</span>` : ''}
            </div>`;
        
        items.forEach(item => {
            const bgColor = item.needed ? '#E94560' : '#0F3460';
            const borderColor = item.needed ? '#E94560' : '#2A2A4A';
            
            h += `<div class="card" style="background:${bgColor};border:2px solid ${borderColor};margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="flex:1;display:flex;align-items:center;gap:12px">`;
            
            if(isKuvar || isKonobar) {
                h += `<input type="checkbox" 
                           ${item.needed ? 'checked' : ''} 
                           onchange="toggleGroceryItem(${item.id})"
                           style="width:24px;height:24px;cursor:pointer;accent-color:#FFD700">`;
            } else if(isAdmin && item.needed) {
                h += `<input type="checkbox" 
                           checked
                           onchange="markAsOrdered(${item.id})"
                           style="width:24px;height:24px;cursor:pointer;accent-color:#4CAF50">`;
            }
            
            h += `<div>
                            <h3 style="margin:0">${item.name}</h3>`;
            
            if(item.needed && item.requestedBy) {
                const timeAgo = getTimeAgo(item.requestedAt);
                h += `<p style="color:#B0B0B0;font-size:12px;margin-top:4px">
                                👨‍🍳 Zatražio: ${item.requestedBy} • ${timeAgo}
                            </p>`;
            }
            
            h += `</div>
                    </div>
                    
                    <div style="display:flex;align-items:center;gap:12px">`;
            
            if(item.needed) {
                h += `<div style="background:#FFF;color:#E94560;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:bold">
                    FALI
                </div>`;
            }
            
            // Admin može da menja i briše stavke
            if(isAdmin) {
                h += `<button onclick="openEditGroceryModal(${item.id})" 
                              style="background:transparent;border:none;color:#FFD700;cursor:pointer;font-size:20px;padding:8px;line-height:1"
                              title="Izmeni kategoriju">
                    ✏️
                </button>
                <button onclick="deleteGroceryItem(${item.id})" 
                              style="background:transparent;border:none;color:#E94560;cursor:pointer;font-size:20px;padding:8px;line-height:1"
                              title="Obriši namirnicu">
                    🗑️
                </button>`;
            }
            
            h += `</div>
            </div>
            </div>`;
        });
        
        h += `</div>`;
    });
    
    // Dodaj novu namirnicu (samo admin)
    if(isAdmin) {
        h += `<div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap">
            <button class="btn" style="background:#0F3460" onclick="openAddGroceryModal()">
                ➕ Dodaj Novu Namirnicu
            </button>
            <button class="btn" style="background:#E94560" onclick="syncDrinksFromMenu()">
                📥 Uvezi Pića Iz Menija
            </button>
            <button class="btn" style="background:#4CAF50" onclick="syncPizzaIngredientsFromMenu()">
                🍕 Uvezi SVOJA PIZZA Sastojke
            </button>`;
        
        // Prikaži dugme za blacklist ako ima obrisanih stavki
        if(DB.deletedGroceryItems && DB.deletedGroceryItems.length > 0) {
            h += `<button class="btn" style="background:#533;" onclick="openBlacklistModal()">
                🚫 Obrisane Stavke (${DB.deletedGroceryItems.length})
            </button>`;
        }
        
        // Prikaži dugme za ručne izmene ako ih ima
        const manualEditsCount = Object.keys(DB.manuallyEditedCategories).length;
        if(manualEditsCount > 0) {
            h += `<button class="btn" style="background:#FF6B35;" onclick="clearManualCategoryEdits()">
                ✏️ Resetuj Ručne Izmene (${manualEditsCount})
            </button>`;
        }
        
        h += `</div>`;
    }
    
    // Kuvar može dodati novu namirnicu za Hranu
    if(isKuvar) {
        h += `<div style="margin-top:20px">
            <button class="btn" style="background:#FF9800" onclick="openKuvarAddGroceryModal()">
                ➕ Dodaj Namirnicu Koja Fali
            </button>
        </div>`;
    }
    
    c.innerHTML = h;
}


function toggleGroceryItem(itemId) {
    const item = DB.groceryList.find(i => i.id === itemId);
    if(item) {
        item.needed = !item.needed;
        
        if(item.needed) {
            // Označeno kao potrebno
            item.requestedBy = DB.konobarName || DB.currentUser.username;
            item.requestedAt = new Date().toISOString();
            
            // Ažuriraj badge za admina
            updateShoppingBadge();
        } else {
            // Ukloni zahtev
            item.requestedBy = null;
            item.requestedAt = null;
        }
        
        save();
        render();
    }
}


function markAsOrdered(itemId) {
    const item = DB.groceryList.find(i => i.id === itemId);
    if(item) {
        item.needed = false;
        item.requestedBy = null;
        item.requestedAt = null;
        
        save();
        render();
        updateShoppingBadge();
    }
}


function markAllAsOrdered() {
    DB.groceryList.forEach(item => {
        if(item.needed) {
            item.needed = false;
            item.requestedBy = null;
            item.requestedAt = null;
        }
    });
    
    save();
    render();
    updateShoppingBadge();
    showAlert('✅ Sve namirnice označene kao nabavljene!');
}


function deleteGroceryItem(itemId) {
    const item = DB.groceryList.find(i => i.id === itemId);
    if(!item) return;
    
    // Potvrda brisanja
    showConfirm('🗑️ Brisanje', `Da li sigurno želiš da obrišeš "${item.name}" iz nabavke?\n\nAko je ovo piće iz menija, neće se automatski vraćati.`, (confirmed) => {
        if(!confirmed) return;
        
        // Dodaj u blacklist ako je piće (da se ne vraća automatski)
        if(item.type === 'Piće') {
            if(!DB.deletedGroceryItems.includes(item.name)) {
                DB.deletedGroceryItems.push(item.name);
                console.log(`🚫 Dodato u blacklist: ${item.name}`);
            }
        }
        
        // Obriši stavku
        DB.groceryList = DB.groceryList.filter(i => i.id !== itemId);
        
        save();
        render();
        updateShoppingBadge();
        showAlert(`🗑️ "${item.name}" obrisano iz nabavke!`);
    });
}


function updateShoppingBadge() {
    const badge = document.getElementById('shoppingBadge');
    if(badge && DB.currentUser && DB.currentUser.role === 'admin') {
        const neededCount = DB.groceryList.filter(i => i.needed).length;
        if(neededCount > 0) {
            badge.style.display = 'flex';
            badge.textContent = neededCount;
        } else {
            badge.style.display = 'none';
        }
    }
}


function openAddGroceryModal() {
    document.getElementById('addGroceryModal').style.display = 'flex';
    document.getElementById('groceryNameInput').value = '';
    document.getElementById('groceryCategoryInput').value = 'Povrće';
    setTimeout(() => document.getElementById('groceryNameInput').focus(), 100);
}


function closeAddGroceryModal() {
    document.getElementById('addGroceryModal').style.display = 'none';
}


function openKuvarAddGroceryModal() {
    document.getElementById('kuvarGroceryModal').style.display = 'flex';
    document.getElementById('kuvarGroceryNameInput').value = '';
    document.getElementById('kuvarGroceryCategoryInput').value = 'Povrće';
    setTimeout(() => document.getElementById('kuvarGroceryNameInput').focus(), 100);
}


function closeKuvarGroceryModal() {
    document.getElementById('kuvarGroceryModal').style.display = 'none';
}


function saveKuvarGroceryItem() {
    const name = document.getElementById('kuvarGroceryNameInput').value.trim();
    const category = document.getElementById('kuvarGroceryCategoryInput').value;
    
    if(!name) {
        showAlert('⚠️ Unesite naziv namirnice!');
        return;
    }
    
    // Proveri da li već postoji
    const exists = DB.groceryList.find(i => i.name.toLowerCase() === name.toLowerCase());
    if(exists) {
        // Ako postoji ali nije označena, označi je
        if(!exists.needed) {
            exists.needed = true;
            exists.requestedBy = DB.konobarName || DB.currentUser.username;
            exists.requestedAt = new Date().toISOString();
            save();
            closeKuvarGroceryModal();
            render();
            showAlert(`✅ "${name}" već postoji — označena kao potrebna!`);
        } else {
            showAlert(`⚠️ "${name}" je već označena kao potrebna!`);
        }
        return;
    }
    
    // Kreiraj novu namirnicu — automatski tip Hrana, automatski needed
    const newItem = {
        id: Date.now(),
        name: name,
        type: 'Hrana',
        category: category,
        needed: true,
        requestedBy: DB.konobarName || DB.currentUser.username,
        requestedAt: new Date().toISOString()
    };
    
    DB.groceryList.push(newItem);
    save();
    closeKuvarGroceryModal();
    render();
    updateShoppingBadge();
    showAlert(`✅ "${name}" dodata i označena kao potrebna!`);
}


function saveGroceryItem() {
    const name = document.getElementById('groceryNameInput').value.trim();
    const type = document.getElementById('groceryTypeInput').value;
    const category = document.getElementById('groceryCategoryInput').value;
    
    if(!name) {
        showAlert('⚠️ Unesite naziv namirnice!');
        return;
    }
    
    // Proveri da li već postoji
    const exists = DB.groceryList.find(i => i.name.toLowerCase() === name.toLowerCase());
    if(exists) {
        showAlert('⚠️ Namirnica već postoji u listi!');
        return;
    }
    
    // Kreiraj novu namirnicu
    const newItem = {
        id: Date.now(),
        name: name,
        type: type,
        category: category,
        needed: false
    };
    
    DB.groceryList.push(newItem);
    save();
    closeAddGroceryModal();
    render();
    
    const roleText = type === 'Hrana' ? '🍳 kuvari' : '🍺 konobari';
    showAlert(`✅ Namirnica "${name}" dodata! Vidljiva za ${roleText}.`);
}


function openBlacklistModal() {
    const modal = document.getElementById('blacklistModal');
    const container = document.getElementById('blacklistItemsContainer');
    
    if(!DB.deletedGroceryItems || DB.deletedGroceryItems.length === 0) {
        container.innerHTML = '<div class="empty"><p>Nema obrisanih stavki</p></div>';
    } else {
        let h = '';
        DB.deletedGroceryItems.forEach(itemName => {
            h += `<div class="card" style="margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <h3 style="margin:0">${itemName}</h3>
                        <p style="color:#B0B0B0;font-size:12px;margin-top:4px">
                            Neće se automatski vraćati pri sinhronizaciji
                        </p>
                    </div>
                    <button class="btn" style="background:#4CAF50;font-size:14px;padding:8px 16px" 
                            onclick="restoreFromBlacklist('${itemName.replace(/'/g, "\\'")}')">
                        ↩️ Vrati
                    </button>
                </div>
            </div>`;
        });
        container.innerHTML = h;
    }
    
    modal.style.display = 'flex';
}


function closeBlacklistModal() {
    document.getElementById('blacklistModal').style.display = 'none';
}


function restoreFromBlacklist(itemName) {
    // Ukloni iz blacklist-a
    DB.deletedGroceryItems = DB.deletedGroceryItems.filter(name => name !== itemName);
    
    // Sačuvaj
    save();
    
    // Zatvori modal
    closeBlacklistModal();
    
    // Render
    render();
    
    showAlert(`✅ "${itemName}" vraćeno! Biće ponovo dodato pri sledećoj sinhronizaciji.`);
}


function clearManualCategoryEdits() {
    const count = Object.keys(DB.manuallyEditedCategories).length;
    
    showConfirm('⚠️ Reset Kategorija', `Da li sigurno želiš da resetuješ ${count} ručnih izmena kategorija?\n\nSve kategorije će se vratiti na automatski određene kategorije pri sledećem učitavanju.`, (confirmed) => {
        if(!confirmed) return;
        
        // Obriši sve ručne izmene
        DB.manuallyEditedCategories = {};
        localStorage.setItem('manuallyEditedCategories', '{}');
        
        console.log('🗑️ Obrisane sve ručne izmene kategorija');
        
        // Refresh stranice da se učitaju default kategorije
        showAlert(`✅ Resetovano ${count} ručnih izmena!\n\nOsvežavam stranicu da se primene automatske kategorije...`);
        
        setTimeout(() => {
            location.reload();
        }, 1500);
    });
}


function openEditGroceryModal(itemId) {
    const item = DB.groceryList.find(i => i.id === itemId);
    if(!item) return;
    
    editingGroceryItemId = itemId;
    
    // Popuni polja
    document.getElementById('editGroceryNameDisplay').value = item.name;
    document.getElementById('editGroceryTypeDisplay').value = item.type === 'Hrana' ? '🍽️ Hrana (za kuvare)' : '🍺 Piće (za konobare)';
    document.getElementById('editGroceryCategoryInput').value = item.category;
    
    // Otvori modal
    document.getElementById('editGroceryModal').style.display = 'flex';
}


function closeEditGroceryModal() {
    document.getElementById('editGroceryModal').style.display = 'none';
    editingGroceryItemId = null;
}


function saveGroceryEdit() {
    if(!editingGroceryItemId) return;
    
    const item = DB.groceryList.find(i => i.id === editingGroceryItemId);
    if(!item) return;
    
    const newCategory = document.getElementById('editGroceryCategoryInput').value;
    const oldCategory = item.category;
    
    // Promeni kategoriju
    item.category = newCategory;
    
    // KLJUČNO: Sačuvaj ručnu izmenu lokalno (da se ne prepiše sa Firebase)
    DB.manuallyEditedCategories[item.name.toLowerCase()] = newCategory;
    localStorage.setItem('manuallyEditedCategories', JSON.stringify(DB.manuallyEditedCategories));
    console.log('✏️ Ručno izmenjena kategorija:', item.name, '→', newCategory);
    
    // Sačuvaj
    save();
    
    // Zatvori modal
    closeEditGroceryModal();
    
    // Render
    render();
    
    showAlert(`✅ "${item.name}" premešteno iz "${oldCategory}" u "${newCategory}"!`);
}

