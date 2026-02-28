// ============================================
// NAVIGATION & RENDERING
// ============================================


function nav(p) {
    // Provera pristupa za konobare
    if(DB.currentUser && (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter') && (p === 'edit' || p === 'settings' || p === 'removed' || p === 'users')) {
        showAlert('Nemate pristup ovoj stranici');
        return;
    }
    
    // Provera pristupa za kuvare
    if(DB.currentUser && DB.currentUser.role === 'kuvar' && (p === 'menu' || p === 'tables' || p === 'edit' || p === 'settings' || p === 'removed' || p === 'users' || p === 'report' || p === 'history' || p === 'inventory' || p === 'debts')) {
        showAlert('Nemate pristup ovoj stranici');
        return;
    }
    
    page = p;
    DB.selectedTable = null;
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
    });
    const navMap = {
        'menu': 0, 'tables': 1, 'kitchen': 'navKitchen', 'shopping': 'navShopping,navShoppingAdmin',
        'kuvarreport': 'navKuvarReport', 'report': 'navReport', 'history': 'navHistory',
        'guestorders': 'navGuestOrders', 'removed': 'navRemoved', 'users': 'navUsers',
        'edit': 'navEdit', 'settings': 'navSettings', 'inventory': 'navInventory', 'debts': 'navDebts'
    };
    const target = navMap[p];
    if (typeof target === 'number') {
        const items = document.querySelectorAll('.nav-item');
        if (items[target]) items[target].classList.add('active');
    } else if (typeof target === 'string') {
        target.split(',').forEach(id => {
            const el = document.getElementById(id.trim());
            if (el) el.classList.add('active');
        });
    }
    render();
}


function render() {
    const c = document.getElementById('content');
    
    // Dodaj/ukloni role klase na body u zavisnosti od uloge korisnika
    if (DB.currentUser && DB.currentUser.role === 'waiter') {
        document.body.classList.add('waiter-role');
        document.body.classList.remove('kuvar-role');
    } else if (DB.currentUser && DB.currentUser.role === 'kuvar') {
        document.body.classList.add('kuvar-role');
        document.body.classList.remove('waiter-role');
    } else {
        document.body.classList.remove('waiter-role');
        document.body.classList.remove('kuvar-role');
    }
    
    if(page==='login') renderLogin(c);
    else if(page==='workday') renderWorkday(c);
    else if(page==='finalreport') renderFinalReport(c);
    else if(page==='menu') renderMenu(c);
    else if(page==='edittables') renderEditTables(c);
    else if(page==='tables' && DB.selectedTable===null) renderTableSelect(c);
    else if(page==='tables' && DB.selectedTable!==null) renderTableMenu(c);
    else if(page==='tableorder') renderTableOrder(c);
    else if(page==='report') renderReport(c);
    else if(page==='history') renderHistory(c);
    else if(page==='removed') renderRemoved(c);
    else if(page==='users') renderUsers(c);
    else if(page==='edit') renderEdit(c);
    else if(page==='settings') renderSettings(c);
    else if(page==='payment') renderPayment(c);
    else if(page==='receipt') renderReceipt(c);
    else if(page==='kitchen') renderKitchen(c);
    else if(page==='kitchenready') renderKitchenReady(c);
    else if(page==='kuvarreport') renderKuvarReport(c);
    else if(page==='shopping') renderShopping(c);
    else if(page==='guestorders') renderGuestOrders(c);
    else if(page==='garden') renderGarden(c);
    else if(page==='inventory') renderInventory(c);
    else if(page==='debts') renderDebts(c);
    
    updateBadge();
    setTimeout(() => updateUserInfo(), 0);
}


function updateUserInfo() {
    const userInfo = document.getElementById('userInfo');
    const navBar = document.querySelector('.nav');
    
    if(DB.currentUser) {
        // Prikaži navigaciju samo kada je korisnik ulogovan
        if(navBar) navBar.classList.add('show');
        
        const roleIcon = DB.currentUser.role === 'admin' ? '👑' : (DB.currentUser.role === 'kuvar' ? '👨‍🍳' : '🧑‍💼');
        const displayName = (DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter') && DB.konobarName ? DB.konobarName : DB.currentUser.username;
        let html = `<div class="user-badge">${roleIcon} ${displayName}</div>`;
        
        // Proveri da li konobar/waiter ima aktivan radni dan
        const hasWorkday = DB.workdays && DB.workdays[DB.currentUser.username];
        
        if((DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter') && hasWorkday) {
            html += `<div class="workday-badge">📅 Radni dan otvoren</div>`;
        }
        
        if(DB.currentUser.role === 'kuvar' && hasWorkday) {
            const kuvarStart = new Date(hasWorkday.startTime);
            const kuvarMins = Math.floor((new Date() - kuvarStart) / 60000);
            const kuvarH = Math.floor(kuvarMins / 60);
            const kuvarM = kuvarMins % 60;
            html += `<div class="workday-badge">🍳 Smena: ${kuvarH}h ${kuvarM}min</div>`;
        }
        
        // Dugme za spremne narudžbine iz kuhinje
        if(DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter') {
            const readyCount = DB.kitchenOrders ? DB.kitchenOrders.filter(ko => 
                ko.status === 'ready' && ko.waiterUsername === DB.currentUser.username
            ).length : 0;
            if(readyCount > 0) {
                html += `<button class="logout-btn" id="kitchenReadyBtn" style="background:#4CAF50;position:relative">
                    ✅ Spremno (${readyCount})
                </button>`;
            }
        }
        
        if((DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter') && hasWorkday) {
            html += `<button class="logout-btn" id="closeDayBtn" style="background:#FF9800">Zatvori dan</button>`;
        }
        
        if(DB.currentUser.role === 'kuvar' && hasWorkday) {
            html += `<button class="logout-btn" id="closeKuvarDayBtn" style="background:#FF9800">Zatvori smenu</button>`;
        }
        
        html += `<button class="logout-btn" id="logoutBtn">Odjavi se</button>`;
        userInfo.innerHTML = html;
        
        const logoutBtn = document.getElementById('logoutBtn');
        if(logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Logout korisnika ALI workdays OSTAJU u Firebase!
                DB.currentUser = null;
                DB.selectedTable = null;
                DB.konobarName = null;
                
                // Očisti samo lokalne podatke
                localStorage.removeItem('currentUser');
                localStorage.removeItem('konobarName');
                
                // VAŽNO: NE brišemo DB.workdays - oni ostaju u Firebase!
                // Workday se briše samo kada konobar ZATVORI radni dan
                
                console.log('✅ Logout uspešan - workdays ostaju aktivni');
                
                page = 'login';
                render();
            });
        }
        
        const closeDayBtn = document.getElementById('closeDayBtn');
        if(closeDayBtn) {
            closeDayBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                // Direktno pozovi closeWorkday funkciju
                closeWorkday();
            });
        }
        
        const closeKuvarDayBtn = document.getElementById('closeKuvarDayBtn');
        if(closeKuvarDayBtn) {
            closeKuvarDayBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                closeKuvarWorkday();
            });
        }
        
        const kitchenReadyBtn = document.getElementById('kitchenReadyBtn');
        if(kitchenReadyBtn) {
            kitchenReadyBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                page = 'kitchenready';
                render();
            });
        }
        
        const navReport = document.getElementById('navReport');
        const navRemoved = document.getElementById('navRemoved');
        const navUsers = document.getElementById('navUsers');
        const navEdit = document.getElementById('navEdit');
        const navSettings = document.getElementById('navSettings');
        
        if(navReport && navRemoved && navUsers && navEdit && navSettings) {
            if(DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter') {
                navReport.style.display = 'flex';
                navRemoved.style.display = 'none';
                navUsers.style.display = 'none';
                navEdit.style.display = 'none';
                navSettings.style.display = 'none';
            } else {
                navReport.style.display = 'flex';
                navRemoved.style.display = 'flex';
                navUsers.style.display = 'flex';
                navEdit.style.display = 'flex';
                navSettings.style.display = 'flex';
            }
        }
    } else {
        // Sakrij navigaciju kada korisnik nije ulogovan
        if(navBar) navBar.classList.remove('show');
        userInfo.innerHTML = '';
    }
}


function updateBadge() {
    if (!DB.tables || !Array.isArray(DB.tables)) return;
    const occupied = DB.tables.filter(t => t && t.order && t.order.length > 0).length;
    const badgeEl = document.getElementById('badge');
    if (badgeEl) {
        badgeEl.textContent = `${occupied} stolova`;
    }
    
    // Kitchen badge za kuvare i konobare
    const kitchenBadgeEl = document.getElementById('kitchenBadge');
    if(kitchenBadgeEl && DB.currentUser) {
        if(DB.currentUser.role === 'kuvar') {
            // Kuvar vidi broj pending i preparing narudžbina
            const activeOrders = DB.kitchenOrders.filter(ko => 
                ko.status === 'pending' || ko.status === 'preparing'
            ).length;
            
            if(activeOrders > 0) {
                kitchenBadgeEl.style.display = 'inline-block';
                kitchenBadgeEl.textContent = `${activeOrders}`;
            } else {
                kitchenBadgeEl.style.display = 'none';
            }
        } else if(DB.currentUser.role === 'konobar' || DB.currentUser.role === 'waiter') {
            // Konobar vidi broj spremnih narudžbina ZA NJEGA
            const myReadyOrders = DB.kitchenOrders.filter(ko => 
                ko.status === 'ready' && 
                ko.waiterUsername === DB.currentUser.username
            ).length;
            
            if(myReadyOrders > 0) {
                kitchenBadgeEl.style.display = 'inline-block';
                kitchenBadgeEl.textContent = `${myReadyOrders}`;
                kitchenBadgeEl.style.background = '#4CAF50'; // Zeleno za gotovo
            } else {
                kitchenBadgeEl.style.display = 'none';
            }
        }
    }
    
    // Shopping badge za admina
    updateShoppingBadge();
    
    // Guest orders badge
    updateGuestOrdersBadge();
    
    // Debts badge
    const debtsBadgeEl = document.getElementById('debtsBadge');
    if (debtsBadgeEl) {
        const activeDebts = (DB.debts || []).filter(d => d.remaining > 0 && !d.deleted).length;
        if (activeDebts > 0) {
            debtsBadgeEl.style.display = 'inline-block';
            debtsBadgeEl.textContent = activeDebts;
        } else {
            debtsBadgeEl.style.display = 'none';
        }
    }
}

