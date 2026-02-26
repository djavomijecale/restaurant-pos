// ============================================
// FIREBASE OPERATIONS
// ============================================


// ============================================
// FIREBASE SDK FUNCTIONS (AUTHENTICATED)
// ============================================

// Load data from Firebase
async function loadFromFirebase() {
    isLoading = true;
    
    // Sačekaj autentifikaciju ali ne duže od 3 sekunde
    if (!isFirebaseAuthReady) {
        console.log('⏳ Čekam autentifikaciju (max 3s)...');
        let waited = 0;
        await new Promise(resolve => {
            const checkAuth = setInterval(() => {
                waited += 100;
                if (isFirebaseAuthReady || waited >= 3000) {
                    clearInterval(checkAuth);
                    if (!isFirebaseAuthReady) {
                        console.warn('⚠️ Nastavljam bez autentifikacije (timeout)');
                    }
                    resolve();
                }
            }, 100);
        });
    }
    
    try {
        const snapshot = await database.ref('/').once('value');
        const data = snapshot.val();
        
        console.log('📦 Received data:', data);
        
        if (data && typeof data === 'object') {
            // Load data or use defaults
            DB.menu = data.menu || [
                {id:1,name:'Ćevapi',desc:'Domaće ćevapčići',price:650,cat:'Hrana'},
                {id:2,name:'Pileća šnicla',desc:'Sa krompirom',price:780,cat:'Hrana'},
                {id:3,name:'Šiš Kebab',desc:'Meso sa povrćem',price:920,cat:'Hrana'},
                {id:4,name:'Ayran',desc:'Domaći',price:220,cat:'Piće'},
                {id:5,name:'Coca-Cola',desc:'330ml',price:180,cat:'Piće'},
                {id:6,name:'Pivo 0.5L',desc:'Domaće',price:320,cat:'Piće'},
                {id:7,name:'Baklava',desc:'Sa medom',price:350,cat:'Dezert'},
                {id:8,name:'Tulumba',desc:'Sa sirupom',price:300,cat:'Dezert'}
            ];
            
            DB.tables = data.tables || Array.from({length:10}, (_,i) => ({
                num:i+1, 
                name:`Sto ${i+1}`, 
                order:[], 
                discount:0, 
                discountPercent:0, 
                discountedItems:[]
            }));
            
            // Dodaj šank stolice ako ne postoje (11-14)
            for (let i = 11; i <= 14; i++) {
                if (!DB.tables.find(t => t.num === i)) {
                    DB.tables.push({
                        num: i,
                        name: `Šank ${i - 10}`,
                        order: [],
                        discount: 0,
                        discountPercent: 0,
                        discountedItems: [],
                        isBar: true
                    });
                }
            }
            
            // Dodaj bašta stolove ako ne postoje (21-34)
            const gardenDef = [
                {num:21, name:'Bašta 1'}, {num:22, name:'Bašta 2'},
                {num:23, name:'Bašta 3'}, {num:24, name:'Bašta 4'},
                {num:25, name:'Bašta 5'}, {num:26, name:'Bašta 6'},
                {num:27, name:'Bašta 7'}, {num:28, name:'Bašta 8'},
                {num:29, name:'Bašta 9'}, {num:30, name:'Bašta 10'},
                {num:31, name:'Bašta 11'}, {num:32, name:'Bašta 12'},
                {num:33, name:'Bašta 13'}, {num:34, name:'Bašta 14'}
            ];
            gardenDef.forEach(g => {
                if (!DB.tables.find(t => t.num === g.num)) {
                    DB.tables.push({
                        num: g.num, name: g.name, order: [],
                        discount: 0, discountPercent: 0, discountedItems: [],
                        isGarden: true
                    });
                }
            });
            
            // Očisti korumpirane stavke na stolovima (bez qty ili sa NaN)
            let tablesHadCorrupted = false;
            DB.tables.forEach(t => {
                if (!t.order) { t.order = []; return; }
                if (!Array.isArray(t.order)) t.order = Object.values(t.order);
                const before = t.order.length;
                t.order = t.order.filter(item => {
                    if (!item || !item.name) return false;
                    if (!item.qty || isNaN(item.qty)) item.qty = 1;
                    else item.qty = parseInt(item.qty);
                    if (!item.price || isNaN(item.price)) {
                        const menuItem = (DB.menu || []).find(m => m.id == item.id);
                        if (menuItem) item.price = menuItem.price;
                        else return false;
                    }
                    item.price = parseFloat(item.price);
                    return true;
                });
                if (t.order.length !== before) tablesHadCorrupted = true;
            });
            if (tablesHadCorrupted) {
                console.log('🧹 Očišćene korumpirane stavke sa stolova');
                database.ref('tables').set(DB.tables);
            }
            
            DB.orders = data.orders || [];
            DB.removedItems = data.removedItems || [];
            
            DB.settings = data.settings || {
                name:'MY RESTAURANT',
                addr:'Adresa',
                phone:'+381 XX XXX',
                ip:'192.168.1.100',
                email:''
            };
            
            DB.users = data.users || [
                {username:'admin',password:'admin',role:'admin'},
                {username:'konobar1',password:'konobar1',role:'konobar'},
                {username:'konobar2',password:'konobar2',role:'konobar'},
                {username:'kuvar1',password:'kuvar1',role:'kuvar'}
            ];
            
            DB.workdayHistory = data.workdayHistory || [];
            DB.kitchenOrders = data.kitchenOrders || [];
            // Popravi kuhinjske narudžbine kojima nedostaje tableName/waiterName
            DB.kitchenOrders.forEach(ko => {
                if (!ko.tableName && ko.tableNum) {
                    const t = DB.tables.find(tb => tb.num == ko.tableNum);
                    ko.tableName = t ? t.name : ('Sto ' + ko.tableNum);
                }
                if (!ko.waiterName) {
                    ko.waiterName = ko.orderedBy || ko.waiterUsername || 'Konobar';
                }
                if (!ko.waiterUsername) {
                    ko.waiterUsername = ko.orderedBy || '';
                }
            });
            DB.groceryList = data.groceryList || [
                // Default lista namirnica - HRANA (za kuvare)
                {id:1, name:'Paradajz', category:'Povrće', type:'Hrana', needed:false},
                {id:2, name:'Krastavac', category:'Povrće', type:'Hrana', needed:false},
                {id:3, name:'Paprika', category:'Povrće', type:'Hrana', needed:false},
                {id:4, name:'Luk', category:'Povrće', type:'Hrana', needed:false},
                {id:5, name:'Piletina', category:'Meso', type:'Hrana', needed:false},
                {id:6, name:'Svinjetina', category:'Meso', type:'Hrana', needed:false},
                {id:7, name:'Govedina', category:'Meso', type:'Hrana', needed:false},
                {id:8, name:'Brašno', category:'Suvo', type:'Hrana', needed:false},
                {id:9, name:'Ulje', category:'Suvo', type:'Hrana', needed:false},
                {id:10, name:'So', category:'Začini', type:'Hrana', needed:false},
                {id:11, name:'Biber', category:'Začini', type:'Hrana', needed:false},
                {id:12, name:'Mleko', category:'Mlečno', type:'Hrana', needed:false},
                {id:13, name:'Sir', category:'Mlečno', type:'Hrana', needed:false},
                {id:14, name:'Jaja', category:'Mlečno', type:'Hrana', needed:false},
                // Default lista namirnica - PIĆE (za konobare)
                // Sokovi
                {id:15, name:'Coca-Cola', category:'Sokovi', type:'Piće', needed:false},
                {id:16, name:'Coca-Cola Zero', category:'Sokovi', type:'Piće', needed:false},
                {id:17, name:'Fanta', category:'Sokovi', type:'Piće', needed:false},
                {id:18, name:'Sprite', category:'Sokovi', type:'Piće', needed:false},
                {id:19, name:'Schweppes Limun', category:'Sokovi', type:'Piće', needed:false},
                {id:20, name:'Schweppes Narandža', category:'Sokovi', type:'Piće', needed:false},
                {id:21, name:'Schweppes Tonik', category:'Sokovi', type:'Piće', needed:false},
                {id:22, name:'Next Narandža', category:'Sokovi', type:'Piće', needed:false},
                {id:23, name:'Next Jabuka', category:'Sokovi', type:'Piće', needed:false},
                {id:24, name:'Next Breskva', category:'Sokovi', type:'Piće', needed:false},
                {id:25, name:'Red Bull', category:'Sokovi', type:'Piće', needed:false},
                // Voda
                {id:26, name:'Knjaz Miloš Gazirana', category:'Voda', type:'Piće', needed:false},
                {id:27, name:'Knjaz Miloš Negazirana', category:'Voda', type:'Piće', needed:false},
                {id:28, name:'Rosa Gazirana', category:'Voda', type:'Piće', needed:false},
                {id:29, name:'Aqua Viva', category:'Voda', type:'Piće', needed:false},
                {id:30, name:'Mg Mivela', category:'Voda', type:'Piće', needed:false},
                // Pivo
                {id:31, name:'Jelen Pivo 0.33L', category:'Pivo', type:'Piće', needed:false},
                {id:32, name:'Jelen Pivo 0.5L', category:'Pivo', type:'Piće', needed:false},
                {id:33, name:'Lav Pivo 0.33L', category:'Pivo', type:'Piće', needed:false},
                {id:34, name:'Lav Pivo 0.5L', category:'Pivo', type:'Piće', needed:false},
                {id:35, name:'Zaječarsko Pivo', category:'Pivo', type:'Piće', needed:false},
                {id:36, name:'Heineken', category:'Pivo', type:'Piće', needed:false},
                {id:37, name:'Tuborg', category:'Pivo', type:'Piće', needed:false},
                {id:38, name:'Stella Artois', category:'Pivo', type:'Piće', needed:false},
                // Vino
                {id:39, name:'Vino Bijelo 0.75L', category:'Vino', type:'Piće', needed:false},
                {id:40, name:'Vino Crveno 0.75L', category:'Vino', type:'Piće', needed:false},
                {id:41, name:'Vino Roze 0.75L', category:'Vino', type:'Piće', needed:false},
                {id:42, name:'Vino Bermet', category:'Vino', type:'Piće', needed:false},
                {id:43, name:'Vino Čaša Bijelo', category:'Vino', type:'Piće', needed:false},
                {id:44, name:'Vino Čaša Crveno', category:'Vino', type:'Piće', needed:false},
                // Kafa
                {id:45, name:'Kafa Espresso', category:'Topli Napici', type:'Piće', needed:false},
                {id:46, name:'Kafa Domaća', category:'Topli Napici', type:'Piće', needed:false},
                {id:47, name:'Cappuccino', category:'Topli Napici', type:'Piće', needed:false},
                {id:48, name:'Nescafe', category:'Topli Napici', type:'Piće', needed:false},
                {id:49, name:'Bela Kafa', category:'Topli Napici', type:'Piće', needed:false},
                // Čaj
                {id:50, name:'Čaj Crni', category:'Topli Napici', type:'Piće', needed:false},
                {id:51, name:'Čaj Zeleni', category:'Topli Napici', type:'Piće', needed:false},
                {id:52, name:'Čaj Kamilica', category:'Topli Napici', type:'Piće', needed:false},
                {id:53, name:'Čaj Šumsko Voće', category:'Topli Napici', type:'Piće', needed:false},
                {id:54, name:'Čaj Nana', category:'Topli Napici', type:'Piće', needed:false},
                // Ostalo
                {id:55, name:'Ceđeni Sok Narandža', category:'Svježi Sokovi', type:'Piće', needed:false},
                {id:56, name:'Ceđeni Sok Grejp', category:'Svježi Sokovi', type:'Piće', needed:false},
                {id:57, name:'Ceđeni Sok Limun', category:'Svježi Sokovi', type:'Piće', needed:false},
                {id:58, name:'Limunada Domaća', category:'Svježi Sokovi', type:'Piće', needed:false},
                {id:59, name:'Ledeni Čaj Breskva', category:'Ledeni Čaj', type:'Piće', needed:false},
                {id:60, name:'Ledeni Čaj Limun', category:'Ledeni Čaj', type:'Piće', needed:false},
                {id:61, name:'Ayran', category:'Mlečni Napici', type:'Piće', needed:false},
                {id:62, name:'Jogurt', category:'Mlečni Napici', type:'Piće', needed:false},
                {id:63, name:'Kisela Voda', category:'Voda', type:'Piće', needed:false}
            ];
            
            // Učitaj blacklist obrisanih stavki
            DB.deletedGroceryItems = data.deletedGroceryItems || [];
            
            // Učitaj QR narudžbine gostiju
            DB.guestOrders = data.guestOrders || [];
            if (!Array.isArray(DB.guestOrders)) DB.guestOrders = Object.values(DB.guestOrders);
            // Osiguraj da svaka narudžbina ima items kao niz i očisti korumpirane
            let hadCorrupted = false;
            DB.guestOrders = DB.guestOrders.filter(o => {
                if (!o || !o.id) return false;
                if (o.items && !Array.isArray(o.items)) o.items = Object.values(o.items);
                if (!o.items || !Array.isArray(o.items) || o.items.length === 0) {
                    hadCorrupted = true;
                    return false;
                }
                const hasValidItems = o.items.some(i => i && i.name && !isNaN(parseFloat(i.price)));
                if (!hasValidItems) {
                    hadCorrupted = true;
                    return false;
                }
                if (!o.total || isNaN(o.total)) {
                    o.total = o.items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.qty) || 0), 0);
                }
                return true;
            });
            if (hadCorrupted) {
                database.ref('guestOrders').set(DB.guestOrders);
            }
            
            // Učitaj pozive konobara
            DB.waiterCalls = data.waiterCalls || [];
            if (!Array.isArray(DB.waiterCalls)) DB.waiterCalls = Object.values(DB.waiterCalls);
            
            DB.shoppingList = data.shoppingList || [
                {id: 1, name: 'Piletina (kg)', needed: false, category: 'Meso'},
                {id: 2, name: 'Junećina (kg)', needed: false, category: 'Meso'},
                {id: 3, name: 'Svinjsko meso (kg)', needed: false, category: 'Meso'},
                {id: 4, name: 'Luk (kg)', needed: false, category: 'Povrće'},
                {id: 5, name: 'Paradajz (kg)', needed: false, category: 'Povrće'},
                {id: 6, name: 'Paprika (kg)', needed: false, category: 'Povrće'},
                {id: 7, name: 'Krompir (kg)', needed: false, category: 'Povrće'},
                {id: 8, name: 'Ulje (L)', needed: false, category: 'Namirnice'},
                {id: 9, name: 'Brašno (kg)', needed: false, category: 'Namirnice'},
                {id: 10, name: 'So (kg)', needed: false, category: 'Začini'},
                {id: 11, name: 'Biber (g)', needed: false, category: 'Začini'},
                {id: 12, name: 'Vegeta (g)', needed: false, category: 'Začini'}
            ];
            
            // MIGRACIJA: Ako postoji stari workday format, konvertuj ga
            if (data.workday && !data.workdays) {
                console.log('🔄 Migrating old workday format...');
                DB.workdays = {};
                DB.workdays[data.workday.user] = data.workday;
            } else {
                DB.workdays = data.workdays || {};
            }
            
            const activeWorkdays = Object.keys(DB.workdays).length;
            
            // If no data exists, initialize with defaults
            if (!data || Object.keys(data).length === 0) {
                console.log('📝 Initializing with default data...');
                await saveToFirebase();
            }
        } else {
            console.log('📝 No data found, using defaults');
        }
        
        // Sinhronizuj pića iz menija u groceryList
        syncDrinksToGrocery();
        
        // Sinhronizuj SVOJA PIZZA sastojke u groceryList
        syncPizzaIngredientsToGrocery();
        
        // KLJUČNO: Primeni ručno izmenjene kategorije (da se ne prepisuju sa Firebase)
        applyManualCategoryEdits();
        
        isLoading = false;
        return true;
        
    } catch (error) {
        console.error('❌ Error loading from Firebase:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        isLoading = false;
        throw error;
    }
}


// Save to Firebase
let isSaving = false;
let saveQueued = false;

async function saveToFirebase() {
    if (isLoading) return;
    
    if (isSaving) {
        saveQueued = true;
        return;
    }
    isSaving = true;
    
    if (!isFirebaseAuthReady) {
        console.warn('⚠️ Auth nije spreman - pokušavam save bez auth-a...');
    }
    
    const dataToSave = {
        menu: DB.menu,
        tables: DB.tables,
        orders: DB.orders,
        removedItems: DB.removedItems,
        settings: DB.settings,
        users: DB.users,
        workdays: DB.workdays,
        workdayHistory: DB.workdayHistory,
        kitchenOrders: DB.kitchenOrders,
        groceryList: DB.groceryList,
        shoppingList: DB.shoppingList,
        deletedGroceryItems: DB.deletedGroceryItems || [],
        guestOrders: DB.guestOrders || [],
        waiterCalls: DB.waiterCalls || [],
        lastUpdated: new Date().toISOString()
    };
    
    try {
        await database.ref('/').update(dataToSave);
    } catch (error) {
        console.error('❌ Error saving to Firebase:', error);
    } finally {
        isSaving = false;
        if (saveQueued) {
            saveQueued = false;
            saveToFirebase();
        }
    }
}


// Main save function
function save() {
    localStorage.setItem('currentUser', JSON.stringify(DB.currentUser));
    localStorage.setItem('konobarName', DB.konobarName);
    saveToFirebase();
}


let isCheckingUpdates = false;

async function checkForUpdates() {
    if (!isFirebaseAuthReady || isCheckingUpdates) return;
    isCheckingUpdates = true;
    
    try {
        const snapshot = await database.ref('/lastUpdated').once('value');
        const serverLastUpdate = snapshot.val();
        
        if (serverLastUpdate && serverLastUpdate !== lastUpdate) {
            const oldPendingCount = DB.kitchenOrders ? DB.kitchenOrders.filter(ko => ko.status === 'pending' || ko.status === 'preparing').length : 0;
            lastUpdate = serverLastUpdate;
            await loadFromFirebase();
            
            // Zvučno obaveštenje za kuvara kad stigne nova narudžbina
            if (DB.currentUser && DB.currentUser.role === 'kuvar') {
                const newPendingCount = DB.kitchenOrders.filter(ko => ko.status === 'pending' || ko.status === 'preparing').length;
                if (newPendingCount > oldPendingCount) {
                    playKitchenSound();
                }
            }
            
            // Zvučno obaveštenje za konobara/admina kad stigne nova QR narudžbina
            if (DB.currentUser && DB.currentUser.role !== 'kuvar') {
                const newGuestPending = (DB.guestOrders || []).filter(o => o.status === 'pending').length;
                if (newGuestPending > lastKnownGuestPendingCount && lastKnownGuestPendingCount >= 0) {
                    playKitchenSound();
                }
                lastKnownGuestPendingCount = newGuestPending;
                
                // Poziv konobara
                const newWaiterCalls = (DB.waiterCalls || []).filter(c => c.status === 'pending').length;
                if (newWaiterCalls > lastKnownWaiterCallsCount && lastKnownWaiterCallsCount >= 0) {
                    playWaiterCallSound();
                }
                lastKnownWaiterCallsCount = newWaiterCalls;
            }
            
            render();
        }
    } catch (error) {
        console.error('❌ Error checking updates:', error);
    } finally {
        isCheckingUpdates = false;
    }
}


let autoRefreshTimer = null;

function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(checkForUpdates, 10000);
}

