// ============================================
// AUTHENTICATION & LOGIN
// ============================================


function renderLogin(c) {
    const waiters = DB.users.filter(u => u.role === 'konobar' || u.role === 'waiter');
    const cooks = DB.users.filter(u => u.role === 'kuvar');
    const admins = DB.users.filter(u => u.role === 'admin');
    
    c.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh">
            <div style="background:#0F3460;padding:40px;border-radius:16px;max-width:500px;width:100%">
                <h2 style="text-align:center;margin-bottom:32px;color:#E94560">🍽️ Dobrodošli</h2>
                
                <!-- Sekcija za konobara -->
                <div style="margin-bottom:32px">
                    <h3 style="color:#FFD700;margin-bottom:16px;text-align:center">👨‍🍳 Konobari</h3>
                    ${waiters.length > 0 ? `
                        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">
                            ${waiters.map(w => `
                                <div class="card" style="text-align:center;padding:20px;cursor:pointer" onclick="selectUser('${w.username}', 'konobar')">
                                    <div style="font-size:48px;margin-bottom:8px">👨‍🍳</div>
                                    <div style="color:#FFD700;font-weight:bold">${w.username}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p style="color:#B0B0B0;text-align:center;font-size:13px">Nema konobara</p>'}
                </div>
                
                ${cooks.length > 0 ? `
                    <div style="border-top:1px solid #2A2A4A;margin:32px 0"></div>
                    
                    <!-- Sekcija za kuvara -->
                    <div style="margin-bottom:32px">
                        <h3 style="color:#FF9800;margin-bottom:16px;text-align:center">🍳 Kuvari</h3>
                        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">
                            ${cooks.map(w => `
                                <div class="card" style="text-align:center;padding:20px;cursor:pointer" onclick="selectUser('${w.username}', 'kuvar')">
                                    <div style="font-size:48px;margin-bottom:8px">🍳</div>
                                    <div style="color:#FF9800;font-weight:bold">${w.username}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div style="border-top:1px solid #2A2A4A;margin:32px 0"></div>
                
                <!-- Sekcija za admina -->
                <div>
                    <h3 style="color:#E94560;margin-bottom:16px;text-align:center">👑 Administrator</h3>
                    <input type="password" id="adminPassword" placeholder="Unesite admin lozinku" style="margin-bottom:12px">
                    <button class="btn" onclick="loginAdmin()">Prijavi se kao Admin</button>
                </div>
            </div>
        </div>
    `;
}


function selectUser(username, role) {
    selectedWaiterUsername = username;
    const c = document.getElementById('content');
    const user = DB.users.find(u => u.username === username);
    
    // Odaberi ikonicu i boju prema ulozi
    const icon = role === 'kuvar' ? '🍳' : '👨‍🍳';
    const color = role === 'kuvar' ? '#FF9800' : '#FFD700';
    const roleLabel = role === 'kuvar' ? 'Kuvar' : 'Konobar';
    
    c.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh">
            <div style="background:#0F3460;padding:40px;border-radius:16px;max-width:400px;width:100%">
                <button class="btn btn-secondary" style="width:auto;padding:8px 16px;margin-bottom:24px" onclick="page='login';render()">← Nazad</button>
                <div style="text-align:center;margin-bottom:24px">
                    <div style="font-size:64px;margin-bottom:16px">${icon}</div>
                    <h2 style="color:${color};margin-bottom:8px">${username}</h2>
                    <p style="color:#B0B0B0;font-size:14px">${roleLabel} - Unesite vašu šifru</p>
                </div>
                <input type="password" id="waiterPassword" placeholder="Šifra" style="margin-bottom:16px">
                <button class="btn" onclick="loginWaiter()">Prijavi se</button>
            </div>
        </div>
    `;
}


// Backward compatibility
function selectWaiter(username) {
    selectUser(username, 'konobar');
}



async function loginWaiter() {
    const password = document.getElementById('waiterPassword').value.trim();
    const user = DB.users.find(u => u.username === selectedWaiterUsername && u.password === password);
    
    if(user) {
        // Prikaži loading
        document.getElementById('content').innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh">
                <div style="font-size:64px;margin-bottom:20px">🔄</div>
                <h2 style="color:#E94560">Prijavljivanje...</h2>
                <p style="color:#B0B0B0">Proveravam status radnog dana...</p>
            </div>
        `;
        
        DB.currentUser = {username: user.username, role: user.role};
        // Koristi username kao konobarName
        DB.konobarName = user.username;
        save();
        
        console.log('🔄 Učitavam najnovije podatke iz Firebase...');
        // KLJUČNO: Učitaj najnovije podatke PRE provere workday-a!
        await loadFromFirebase();
        
        // Redirect na osnovu uloge
        if(user.role === 'kuvar') {
            // Kuvar IDE DIREKTNO NA KUHINJU + otvori radni dan ako nema
            if (!DB.workdays) DB.workdays = {};
            if (!DB.workdays[user.username]) {
                DB.workdays[user.username] = {
                    user: user.username,
                    startTime: new Date().toISOString(),
                    role: 'kuvar'
                };
                save();
            }
            page = 'kitchen';
        } else {
            // Konobar - proveri workday
            const myWorkday = DB.workdays && DB.workdays[user.username];
            console.log('✅ Workday status za', user.username, ':', myWorkday ? 'AKTIVAN' : 'NEMA');
            
            if(!myWorkday) {
                page = 'workday';
            } else {
                page = 'tables';
            }
        }
        render();
    } else {
        showAlert('Pogrešna šifra');
    }
}


async function loginAdmin() {
    const password = document.getElementById('adminPassword').value.trim();
    const admin = DB.users.find(u => u.role === 'admin' && u.password === password);
    
    if(admin) {
        // Prikaži loading
        document.getElementById('content').innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh">
                <div style="font-size:64px;margin-bottom:20px">🔄</div>
                <h2 style="color:#E94560">Prijavljivanje...</h2>
                <p style="color:#B0B0B0">Učitavam najnovije podatke...</p>
            </div>
        `;
        
        DB.currentUser = {username: admin.username, role: admin.role};
        save();
        
        console.log('🔄 Admin login - učitavam najnovije podatke iz Firebase...');
        // Učitaj najnovije podatke pre nego što admin vidi bilo šta
        await loadFromFirebase();
        
        page = 'tables';
        render();
    } else {
        showAlert('Pogrešna admin lozinka');
    }
}


function openWaiterModal(mode, username = null) {
    editingWaiterUsername = username;
    const modal = document.getElementById('waiterModal');
    const title = document.getElementById('waiterModalTitle');
    const nameInput = document.getElementById('waiterNameInput');
    const passwordInput = document.getElementById('waiterPasswordInput');
    const roleInput = document.getElementById('waiterRoleInput');
    const hourlyRateInput = document.getElementById('waiterHourlyRateInput');
    
    if(mode === 'add') {
        title.textContent = '+ Dodaj Osobu';
        nameInput.value = '';
        passwordInput.value = '';
        roleInput.value = 'konobar'; // Default
        hourlyRateInput.value = '350'; // Default satnica
    } else if(mode === 'edit' && username) {
        const waiter = DB.users.find(u => u.username === username);
        if(waiter) {
            title.textContent = '✏️ Izmeni Korisnika';
            nameInput.value = waiter.username;
            passwordInput.value = waiter.password;
            roleInput.value = waiter.role || 'konobar';
            hourlyRateInput.value = waiter.hourlyRate || 350; // Koristi postojeću ili default
        }
    }
    
    modal.classList.add('show');
    nameInput.focus();
}


function closeWaiterModal() {
    document.getElementById('waiterModal').classList.remove('show');
    editingWaiterUsername = null;
}


function saveWaiter() {
    const username = document.getElementById('waiterNameInput').value.trim();
    const password = document.getElementById('waiterPasswordInput').value.trim();
    const role = document.getElementById('waiterRoleInput').value;
    const hourlyRate = parseFloat(document.getElementById('waiterHourlyRateInput').value) || 350;
    
    const roleLabel = role === 'kuvar' ? 'kuvara' : 'konobara';
    
    if(!username) {
        showAlert('Molimo unesite ime korisnika');
        return;
    }
    
    if(!password) {
        showAlert('Molimo unesite šifru');
        return;
    }
    
    if(hourlyRate <= 0) {
        showAlert('Satnica mora biti veća od 0');
        return;
    }
    
    if(editingWaiterUsername) {
        // Editing existing waiter
        const waiter = DB.users.find(u => u.username === editingWaiterUsername);
        
        // Check if new username already exists (unless it's the same)
        if(username !== editingWaiterUsername && DB.users.find(u => u.username === username)) {
            showAlert('Korisnik sa tim imenom već postoji');
            return;
        }
        
        if(waiter) {
            waiter.username = username;
            waiter.password = password;
            waiter.role = role;
            waiter.hourlyRate = hourlyRate;
            save();
            closeWaiterModal();
            render();
            showAlert(`✅ ${roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)} je ažuriran!`);
        }
    } else {
        // Adding new waiter
        if(DB.users.find(u => u.username === username)) {
            showAlert('Korisnik sa tim imenom već postoji');
            return;
        }
        
        DB.users.push({
            username: username,
            password: password,
            role: role,
            hourlyRate: hourlyRate
        });
        
        save();
        closeWaiterModal();
        render();
        showAlert(`✅ Konobar "${username}" je dodat!`);
    }
}

