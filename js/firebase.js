// ============================================
// FIREBASE OPERATIONS
// ============================================


// ============================================
// DIRTY-TABLE TRACKING
// Svaka lokalna promena stola postavlja "dirty" flag. Pri učitavanju podataka
// sa servera NE prepisujemo stolove koji su lokalno izmenjeni (jer promene još
// nisu sačuvane). Pri save-u za NE-dirty stolove uzimamo verziju sa servera
// (jer je neki drugi uređaj možda u međuvremenu pisao), tako da ne overwriteujemo
// tuđe izmene. Rešava race-condition probleme:
//  - narudžbina se vraća na sto nakon naplate (drugi uređaj prepiše cleared sto)
//  - stavke nestaju pre naplate (load overwrita lokalne dodate stavke)
// ============================================
// Monotonički brojač - svaki markDirty/markDeleted dobija jedinstvenu verziju.
// Ovo dozvoljava da znamo da li je marker postavljen PRE ili POSLE trenutnog
// save-a. Ako klik stigne tokom save-a, verzija raste i sledeći save
// prepoznaje da marker ne treba obrisati.
let _dirtyVersion = 0;
function _nextDirtyVersion() { _dirtyVersion += 1; return _dirtyVersion; }

function markTableDirty(tableNum) {
    if (tableNum === null || tableNum === undefined) return;
    if (typeof DB === 'undefined' || !DB) return;
    if (!DB._dirtyTables) DB._dirtyTables = {};
    DB._dirtyTables[String(tableNum)] = _nextDirtyVersion();
}
if (typeof window !== 'undefined') window.markTableDirty = markTableDirty;

// Generička verzija za ostale kolekcije (kitchenOrders, guestOrders, waiterCalls,
// inventory, cashbook...). Ako je item lokalno izmenjen -> ne sme server
// verzija da ga prepiše pri save/load. Ako je lokalno obrisan -> ne sme da se
// vrati sa servera. Ovo rešava iste cross-device race bugove kao i za stolove.
function markDirty(collection, id) {
    if (!collection || id === null || id === undefined) return;
    if (typeof DB === 'undefined' || !DB) return;
    if (!DB._dirtyItems) DB._dirtyItems = {};
    if (!DB._dirtyItems[collection]) DB._dirtyItems[collection] = {};
    DB._dirtyItems[collection][String(id)] = _nextDirtyVersion();
}
function markDeleted(collection, id) {
    if (!collection || id === null || id === undefined) return;
    if (typeof DB === 'undefined' || !DB) return;
    if (!DB._deletedItems) DB._deletedItems = {};
    if (!DB._deletedItems[collection]) DB._deletedItems[collection] = {};
    DB._deletedItems[collection][String(id)] = _nextDirtyVersion();
}
// Dirty-svesni merge: server kao baza, lokalni dirty items prepisuju server,
// lokalno obrisani se uklanjaju, local-only (još nesnimljeni) dodaju na kraj.
function mergeDirtyCollection(local, server, collection, idField) {
    local = Array.isArray(local) ? local : [];
    server = Array.isArray(server) ? server : [];
    const dirty = (DB._dirtyItems && DB._dirtyItems[collection]) || {};
    const deleted = (DB._deletedItems && DB._deletedItems[collection]) || {};
    const byId = {};
    server.forEach(item => {
        if (!item || item[idField] === undefined || item[idField] === null) return;
        const k = String(item[idField]);
        if (deleted[k]) return;
        byId[k] = item;
    });
    local.forEach(item => {
        if (!item || item[idField] === undefined || item[idField] === null) return;
        const k = String(item[idField]);
        if (deleted[k]) return;
        if (dirty[k]) {
            byId[k] = item;
        } else if (!(k in byId)) {
            byId[k] = item;
        }
    });
    return Object.values(byId);
}
if (typeof window !== 'undefined') {
    window.markDirty = markDirty;
    window.markDeleted = markDeleted;
    window.mergeDirtyCollection = mergeDirtyCollection;
}


// ============================================
// FIREBASE SDK FUNCTIONS (AUTHENTICATED)
// ============================================

// Load data from Firebase
async function loadFromFirebase() {
    if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) return false;
    // ✅ ZAŠTITA: Ne učitavaj dok se čuva - prepisalo bi lokalne promene
    if (isSaving || saveQueued) {
        console.log('⏳ loadFromFirebase odložen - save u toku');
        return false;
    }
    
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
            // ✅ RACE FIX: Snapshot lokalno-dirty stolova PRE overwrite-a.
            // Ako je korisnik upravo dodao/obrisao/naplatio stavke ali save još nije
            // završen (ili je listener odložen), učitavanje sa servera ne sme
            // prepisati te promene.
            const _dirtyTableNums = DB._dirtyTables ? Object.keys(DB._dirtyTables) : [];
            const _localDirtyTablesSnap = {};
            if (_dirtyTableNums.length > 0 && Array.isArray(DB.tables)) {
                _dirtyTableNums.forEach(n => {
                    const lt = DB.tables.find(t => t && String(t.num) === String(n));
                    if (lt) _localDirtyTablesSnap[String(n)] = lt;
                });
                console.log('🛡️ Load: čuvam dirty stolove', _dirtyTableNums);
            }

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
                // Firebase konvertuje nizove u objekte - UVEK konvertuj nazad
                if (!Array.isArray(t.order)) {
                    console.log(`🔧 Sto ${t.num}: Konvertujem order iz objekta u niz`);
                    t.order = Object.values(t.order);
                }
                const before = t.order.length;
                t.order = t.order.filter(item => {
                    if (!item || !item.name) return false;
                    // ✅ POPRAVKA: Sačuvaj qty kao broj, ali NE resetuj na 1 ako je validan
                    if (item.qty === undefined || item.qty === null || item.qty === '' || isNaN(Number(item.qty))) {
                        console.warn(`⚠️ Sto ${t.num}, ${item.name}: qty bio '${item.qty}', resetujem na 1`);
                        item.qty = 1;
                    } else {
                        item.qty = parseInt(item.qty);
                        // Zaštita od qty=0 ili negativnog
                        if (item.qty <= 0) item.qty = 1;
                    }
                    if (!item.price || isNaN(item.price)) {
                        const menuItem = (DB.menu || []).find(m => m.id == item.id);
                        if (menuItem) item.price = menuItem.price;
                        else return false;
                    }
                    item.price = parseFloat(item.price);
                    return true;
                });
                if (t.order.length !== before) tablesHadCorrupted = true;
                
                // Firebase ne čuva prazne nizove - osiguraj da discountedItems postoji
                if (!t.discountedItems) t.discountedItems = [];
                if (!Array.isArray(t.discountedItems)) t.discountedItems = Object.values(t.discountedItems);
            });
            if (tablesHadCorrupted) {
                console.log('🧹 Očišćene korumpirane stavke sa stolova');
                database.ref('tables').set(DB.tables);
            }

            // ✅ RACE FIX: Vrati lokalno-dirty stolove iz snapshot-a (ne dozvoli
            // serveru da prepiše pending promene).
            if (Object.keys(_localDirtyTablesSnap).length > 0) {
                DB.tables = DB.tables.map(t => {
                    if (t && _localDirtyTablesSnap[String(t.num)]) {
                        return _localDirtyTablesSnap[String(t.num)];
                    }
                    return t;
                });
            }

            // ✅ MERGE umesto overwrite - čuva offline podatke sa ovog uređaja
            // Ali filtriraj narudžbine koje je admin obrisao
            DB.deletedOrderIds = data.deletedOrderIds || [];
            const deletedIds = new Set((DB.deletedOrderIds).map(String));
            const filteredServerOrders = (data.orders || []).filter(o => !deletedIds.has(String(o.id)));
            DB.orders = mergeArraysById(DB.orders || [], filteredServerOrders, 'id');
            DB.orders = DB.orders.filter(o => !deletedIds.has(String(o.id)));
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
            
            DB.workdayHistory = mergeWorkdayHistory(DB.workdayHistory || [], data.workdayHistory || []);
            DB.kuvarBonus = data.kuvarBonus || {};
            // ✅ RACE FIX: Dirty-svesni merge umesto wholesale overwrite.
            // Štiti lokalne promene statusa/qty/etc. koje još nisu sačuvane.
            DB.kitchenOrders = mergeDirtyCollection(DB.kitchenOrders || [], data.kitchenOrders || [], 'kitchenOrders', 'id');
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
            
            // Lager — dirty-svesni merge (admin izmene vs auto-deduct na naplati)
            DB.inventory = mergeDirtyCollection(DB.inventory || [], data.inventory || [], 'inventory', 'id');
            DB.invoices = mergeDirtyCollection(DB.invoices || [], data.invoices || [], 'invoices', 'id');
            DB.debts = mergeArraysById(DB.debts || [], data.debts || [], 'id');
            DB.houseOrders = data.houseOrders || [];
            DB.cashbook = mergeDirtyCollection(DB.cashbook || [], data.cashbook || [], 'cashbook', 'id');
            DB.deletedOrderIds = data.deletedOrderIds || [];
            // Popravi dugovanja kojima nedostaje payments niz (Firebase ne čuva prazne nizove)
            DB.debts.forEach(debt => {
                if (!debt.payments) debt.payments = [];
                if (typeof debt.remaining !== 'number') debt.remaining = debt.originalTotal || 0;
                if (typeof debt.originalTotal !== 'number') debt.originalTotal = debt.remaining || 0;
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
            
            // Učitaj QR narudžbine gostiju (dirty-svesni merge - konobar potvrda
            // sa jednog uređaja ne sme biti prepisana sa drugog)
            let _serverGuestOrders = data.guestOrders || [];
            if (!Array.isArray(_serverGuestOrders)) _serverGuestOrders = Object.values(_serverGuestOrders);
            DB.guestOrders = mergeDirtyCollection(DB.guestOrders || [], _serverGuestOrders, 'guestOrders', 'id');
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
            
            // Učitaj pozive konobara (dirty-svesni merge)
            let _serverWaiterCalls = data.waiterCalls || [];
            if (!Array.isArray(_serverWaiterCalls)) _serverWaiterCalls = Object.values(_serverWaiterCalls);
            DB.waiterCalls = mergeDirtyCollection(DB.waiterCalls || [], _serverWaiterCalls, 'waiterCalls', 'id');
            
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
                // ✅ Mapiraj sanitizovane Firebase ključeve nazad na originalne username-ove
                const rawWorkdays = data.workdays || {};
                const mappedWorkdays = {};
                const allUsers = DB.users || [];
                
                for (const [firebaseKey, workdayData] of Object.entries(rawWorkdays)) {
                    if (workdayData && workdayData.user) {
                        mappedWorkdays[workdayData.user] = workdayData;
                    } else {
                        const matchedUser = allUsers.find(u => sanitizeFirebaseKey(u.username) === firebaseKey);
                        if (matchedUser) {
                            mappedWorkdays[matchedUser.username] = workdayData;
                        } else {
                            mappedWorkdays[firebaseKey] = workdayData;
                        }
                    }
                }
                DB.workdays = mappedWorkdays;
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
let hasPendingChanges = false; // Flag: imamo lokalne promene koje čekaju save

// Merge nizova po ID-ju - nikad ne gubi podatke, samo dodaje
// Merge workdayHistory po user+loginTime (nema id polje)
function mergeWorkdayHistory(local, server) {
    if (!server || !Array.isArray(server)) return local || [];
    if (!local || !Array.isArray(local)) return server;

    const merged = [...server];
    const serverKeys = new Set(server.map(s => (s.user || '') + '|' + (s.loginTime || '')));

    local.forEach(item => {
        const key = (item.user || '') + '|' + (item.loginTime || '');
        if (!serverKeys.has(key)) {
            merged.push(item);
        }
    });

    return merged;
}

function mergeArraysById(local, server, idField) {
    if (!server || !Array.isArray(server)) return local || [];
    if (!local || !Array.isArray(local)) return server;

    const merged = [...server];
    const serverIds = new Set(server.map(item => item[idField]));

    local.forEach(item => {
        if (!serverIds.has(item[idField])) {
            merged.push(item);
        }
    });

    // Azuriraj postojece stavke iz lokala (npr. debt.remaining se menjao)
    merged.forEach((item, idx) => {
        const localItem = local.find(l => l[idField] === item[idField]);
        if (localItem) {
            // Uzmi noviji podatak (po vremenu izmene)
            const serverTime = item.clearedAt || item.deletedAt || item.time || '';
            const localTime = localItem.clearedAt || localItem.deletedAt || localItem.time || '';
            if (localTime > serverTime) {
                merged[idx] = localItem;
            }
        }
    });

    return merged;
}

async function saveToFirebase() {
    if (isLoading) return;

    if (isSaving) {
        saveQueued = true;
        return;
    }
    isSaving = true;
    hasPendingChanges = true;

    // ✅ RACE FIX: Snapshot dirty/deleted markera na početku save-a. Na kraju
    // ćemo obrisati SAMO one markere koji se nisu promenili tokom save-a.
    // Ako klik stigne tokom save-a, marker dobija novu verziju i ostaje, pa
    // queued re-invoke pravilno prepozna da je sto/item još dirty.
    const _savingDirtyTables = Object.assign({}, DB._dirtyTables || {});
    const _savingDirtyItems = {};
    const _savingDeletedItems = {};
    Object.keys(DB._dirtyItems || {}).forEach(col => {
        _savingDirtyItems[col] = Object.assign({}, DB._dirtyItems[col]);
    });
    Object.keys(DB._deletedItems || {}).forEach(col => {
        _savingDeletedItems[col] = Object.assign({}, DB._deletedItems[col]);
    });

    if (!isFirebaseAuthReady) {
        console.warn('⚠️ Auth nije spreman - pokušavam save bez auth-a...');
    }

    // ✅ ZAŠTITA: Pre save-a, učitaj kritične podatke sa servera i mergeuj
    // Ovo sprečava da stariji localStorage prepiše novije podatke
    // ALI: Preskoči merge ako admin namerno briše podatke
    const isAdminDelete = DB._adminDeleteOverride;
    if (isAdminDelete) {
        DB._adminDeleteOverride = false;
        console.log('🛡️ Admin override - preskačem merge, direktan save');
    }

    try {
        const criticalSnapshot = await database.ref('/').once('value');
        const serverData = criticalSnapshot.val();

        if (serverData && !isAdminDelete) {
            // Učitaj listu obrisanih narudžbina sa servera (admin ih je obrisao)
            const serverDeletedIds = serverData.deletedOrderIds || [];
            const localDeletedIds = DB.deletedOrderIds || [];
            // Spoji obe liste
            DB.deletedOrderIds = [...new Set([...localDeletedIds, ...serverDeletedIds].map(String))];
            const deletedIds = new Set(DB.deletedOrderIds);

            // Merge orders - nikad ne brisemo narudzbine, ALI preskoči obrisane od admina
            const serverOrders = (serverData.orders || []).filter(o => !deletedIds.has(String(o.id)));
            DB.orders = mergeArraysById(DB.orders || [], serverOrders, 'id');
            // Filtriraj i lokalne obrisane
            DB.orders = DB.orders.filter(o => !deletedIds.has(String(o.id)));

            // Merge debts - nikad ne brisemo dugove
            DB.debts = mergeArraysById(DB.debts || [], serverData.debts || [], 'id');

            // Merge workdayHistory - koristi loginTime kao jedinstven kljuc (nema id polje)
            DB.workdayHistory = mergeWorkdayHistory(DB.workdayHistory || [], serverData.workdayHistory || []);

            // Merge houseOrders
            DB.houseOrders = mergeArraysById(DB.houseOrders || [], serverData.houseOrders || [], 'id');

            // ✅ RACE FIX: Dirty-svesni merge za mutable kolekcije.
            // Bez ovoga bi stale uređaj prepisao status promene sa drugog uređaja
            // (npr. kuvar pomerio pending→preparing, konobarov save vratio pending).
            DB.kitchenOrders = mergeDirtyCollection(DB.kitchenOrders || [], serverData.kitchenOrders || [], 'kitchenOrders', 'id');
            DB.guestOrders   = mergeDirtyCollection(DB.guestOrders || [],   serverData.guestOrders || [],   'guestOrders',   'id');
            DB.waiterCalls   = mergeDirtyCollection(DB.waiterCalls || [],   serverData.waiterCalls || [],   'waiterCalls',   'id');
            DB.inventory     = mergeDirtyCollection(DB.inventory || [],     serverData.inventory || [],     'inventory',     'id');
            DB.cashbook      = mergeDirtyCollection(DB.cashbook || [],      serverData.cashbook || [],      'cashbook',      'id');
            DB.invoices      = mergeDirtyCollection(DB.invoices || [],      serverData.invoices || [],      'invoices',      'id');

            // ✅ RACE FIX: Merge tables - za NE-dirty stolove uzmi server verziju
            // (drugi uređaj je možda pisao). Za dirty stolove čuvaj lokalne promene.
            // Tako cross-device saves ne overwriteuju jedni druge na različitim stolovima.
            if (Array.isArray(serverData.tables) && Array.isArray(DB.tables)) {
                const _dirty = DB._dirtyTables || {};
                DB.tables = DB.tables.map(localT => {
                    if (!localT) return localT;
                    if (_dirty[String(localT.num)]) return localT; // dirty - zadrži lokalni
                    const serverT = serverData.tables.find(st => st && String(st.num) === String(localT.num));
                    if (!serverT) return localT;
                    // Sanitize server table (order kao niz, ne objekat)
                    if (!Array.isArray(serverT.order)) serverT.order = serverT.order ? Object.values(serverT.order) : [];
                    if (!Array.isArray(serverT.discountedItems)) serverT.discountedItems = serverT.discountedItems ? Object.values(serverT.discountedItems) : [];
                    return serverT;
                });
            }

            // Merge removedItems (nemaju uvek ID, koristi timestamp)
            if (serverData.removedItems && Array.isArray(serverData.removedItems)) {
                const localTimes = new Set((DB.removedItems || []).map(r => r.removedAt));
                serverData.removedItems.forEach(item => {
                    if (!localTimes.has(item.removedAt)) {
                        DB.removedItems.push(item);
                    }
                });
            }

            console.log('🔀 Merge završen - orders:', DB.orders.length, 'debts:', DB.debts.length, 'history:', DB.workdayHistory.length);

            // 🛡️ FINALNA ZAŠTITA: Blokiraj save ako bi obrisao podatke
            const serverOrdersLen = Array.isArray(serverData.orders) ? serverData.orders.length : 0;
            const serverDebtsLen = Array.isArray(serverData.debts) ? serverData.debts.length : 0;
            const serverHistoryLen = Array.isArray(serverData.workdayHistory) ? serverData.workdayHistory.length : 0;

            if (DB.orders.length < serverOrdersLen) {
                console.error('🛡️ BLOKIRANO: Lokalno ima ' + DB.orders.length + ' narudžbina, server ima ' + serverOrdersLen + '. Save otkazan.');
                isSaving = false;
                return;
            }
            if (DB.debts.length < serverDebtsLen) {
                console.error('🛡️ BLOKIRANO: Lokalno ima ' + DB.debts.length + ' dugova, server ima ' + serverDebtsLen + '. Save otkazan.');
                isSaving = false;
                return;
            }
            if (DB.workdayHistory.length < serverHistoryLen) {
                console.error('🛡️ BLOKIRANO: Lokalno ima ' + DB.workdayHistory.length + ' sesija, server ima ' + serverHistoryLen + '. Save otkazan.');
                isSaving = false;
                return;
            }
        }
    } catch (mergeErr) {
        console.warn('⚠️ Merge pre save-a nije uspeo, nastavljam sa lokalnim podacima:', mergeErr.message);
    }

    // VAŽNO: Generišemo timestamp PRE slanja i čuvamo ga lokalno
    const saveTimestamp = new Date().toISOString();

    const dataToSave = {
        menu: DB.menu,
        tables: DB.tables,
        orders: DB.orders,
        removedItems: DB.removedItems,
        settings: DB.settings,
        users: DB.users,
        // ✅ WORKDAYS SE NE ČUVAJU OVDE - čuvaju se atomički po korisniku
        // kroz saveWorkday() / removeWorkday() da se ne bi prepisivali
        workdayHistory: DB.workdayHistory,
        kitchenOrders: DB.kitchenOrders,
        groceryList: DB.groceryList,
        shoppingList: DB.shoppingList,
        deletedGroceryItems: DB.deletedGroceryItems || [],
        guestOrders: DB.guestOrders || [],
        waiterCalls: DB.waiterCalls || [],
        inventory: DB.inventory || [],
        invoices: DB.invoices || [],
        debts: DB.debts || [],
        houseOrders: DB.houseOrders || [],
        cashbook: DB.cashbook || [],
        deletedOrderIds: DB.deletedOrderIds || [],
        kuvarBonus: DB.kuvarBonus || {},
        lastUpdated: saveTimestamp
    };

    try {
        await database.ref('/').update(dataToSave);
        // ✅ KLJUČNA POPRAVKA: Ažuriraj lokalni lastUpdate POSLE uspešnog save-a
        // Tako checkForUpdates neće misliti da je neko drugi promenio podatke
        lastUpdate = saveTimestamp;
        hasPendingChanges = false;
        // ✅ RACE FIX: Očisti SAMO markere čije verzije nisu rasle tokom save-a.
        // Ako je korisnik kliknuo tokom save-a, marker je dobio novu verziju
        // (veći broj) i treba da ostane da ga queued re-invoke pokupi.
        Object.keys(_savingDirtyTables).forEach(k => {
            if (DB._dirtyTables && DB._dirtyTables[k] === _savingDirtyTables[k]) {
                delete DB._dirtyTables[k];
            }
        });
        Object.keys(_savingDirtyItems).forEach(col => {
            if (!DB._dirtyItems || !DB._dirtyItems[col]) return;
            Object.keys(_savingDirtyItems[col]).forEach(id => {
                if (DB._dirtyItems[col][id] === _savingDirtyItems[col][id]) {
                    delete DB._dirtyItems[col][id];
                }
            });
        });
        Object.keys(_savingDeletedItems).forEach(col => {
            if (!DB._deletedItems || !DB._deletedItems[col]) return;
            Object.keys(_savingDeletedItems[col]).forEach(id => {
                if (DB._deletedItems[col][id] === _savingDeletedItems[col][id]) {
                    delete DB._deletedItems[col][id];
                }
            });
        });
        console.log('✅ Saved to Firebase, lastUpdate synced:', saveTimestamp);
    } catch (error) {
        console.error('❌ Error saving to Firebase:', error);
        hasPendingChanges = false;
    } finally {
        isSaving = false;
        if (saveQueued) {
            saveQueued = false;
            saveToFirebase();
        }
    }
}


// Main save function
let _saveDebounceTimer = null;

function save() {
    localStorage.setItem('currentUser', JSON.stringify(DB.currentUser));
    localStorage.setItem('konobarName', DB.konobarName);
    
    // Demo mode: čuvaj lokalno, ne u Firebase
    if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) {
        if (typeof demoSave === 'function') demoSave();
        return;
    }
    
    hasPendingChanges = true;
    saveToFirebase();
}

// Debounced save - za brzo dodavanje stavki (klik-klik-klik)
function saveDebounced() {
    localStorage.setItem('currentUser', JSON.stringify(DB.currentUser));
    localStorage.setItem('konobarName', DB.konobarName);
    
    // Demo mode
    if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) {
        if (typeof demoSave === 'function') demoSave();
        return;
    }
    
    hasPendingChanges = true;
    
    if (_saveDebounceTimer) clearTimeout(_saveDebounceTimer);
    _saveDebounceTimer = setTimeout(() => {
        _saveDebounceTimer = null;
        saveToFirebase();
    }, 500);
}


let isCheckingUpdates = false;

async function checkForUpdates() {
    if (!isFirebaseAuthReady || isCheckingUpdates) return;
    
    // ✅ KLJUČNA POPRAVKA: Ne učitavaj dok imamo nesačuvane lokalne promene
    // ili dok je save u toku - to bi prepisalo naše podatke
    if (isSaving || saveQueued || hasPendingChanges) {
        console.log('⏳ Preskačem update check - save u toku ili pending changes');
        return;
    }
    
    isCheckingUpdates = true;
    
    try {
        const snapshot = await database.ref('/lastUpdated').once('value');
        const serverLastUpdate = snapshot.val();
        
        // Ponovo proveri da save nije počeo dok smo čekali odgovor
        if (isSaving || saveQueued || hasPendingChanges) {
            console.log('⏳ Save započeo tokom check-a, preskačem load');
            return;
        }
        
        if (serverLastUpdate && serverLastUpdate !== lastUpdate) {
            const oldPendingCount = DB.kitchenOrders ? DB.kitchenOrders.filter(ko => ko.status === 'pending' || ko.status === 'preparing').length : 0;
            lastUpdate = serverLastUpdate;
            await loadFromFirebase();
            checkAndPlayNotificationSounds(oldPendingCount);
            render();
        }
    } catch (error) {
        console.error('❌ Error checking updates:', error);
    } finally {
        isCheckingUpdates = false;
    }
}

// Pomoćna funkcija - proverava da li treba pustiti zvučno obaveštenje
// Pozivamo je iz checkForUpdates I iz real-time /lastUpdated listener-a
function checkAndPlayNotificationSounds(oldPendingCount) {
    // Zvučno obaveštenje za kuvara kad stigne nova narudžbina
    if (DB.currentUser && DB.currentUser.role === 'kuvar') {
        const newPendingCount = DB.kitchenOrders ? DB.kitchenOrders.filter(ko => ko.status === 'pending' || ko.status === 'preparing').length : 0;
        if (newPendingCount > (oldPendingCount || 0)) {
            playKitchenSound();
        }
        return;
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
}

let autoRefreshTimer = null;
let autoCloseTimer = null;

function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(checkForUpdates, 10000);

    // ⏰ Provera isteklih smena svaka 5 minuta
    if (autoCloseTimer) clearInterval(autoCloseTimer);
    autoCloseTimer = setInterval(() => {
        if (typeof checkAndAutoCloseShifts === 'function') {
            checkAndAutoCloseShifts();
        }
    }, 5 * 60 * 1000);

    // ✅ REAL-TIME LISTENER za workday-ove
    // Svaki uređaj odmah vidi kad neko otvori/zatvori smenu
    startWorkdayListener();

    // ⚡ REAL-TIME LISTENER za /lastUpdated - momentalno povlači sveže podatke
    // (čim bilo koji uređaj nešto upiše, svi ostali odmah dobijaju)
    startLastUpdatedListener();

    // 🔄 Refresh on focus - kad korisnik vrati prozor u prvi plan, povuci sveže
    startFocusRefresh();

    // 🆕 Auto-reload na novu verziju aplikacije (preko version.json)
    startVersionChecker();
}

// ============================================
// REAL-TIME /lastUpdated LISTENER
// ============================================
let lastUpdatedListenerActive = false;
function startLastUpdatedListener() {
    if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) return;
    if (lastUpdatedListenerActive) return;
    lastUpdatedListenerActive = true;

    database.ref('/lastUpdated').on('value', (snapshot) => {
        const serverLastUpdate = snapshot.val();
        if (!serverLastUpdate || serverLastUpdate === lastUpdate) return;

        // Ne učitavaj ako je save u toku - to bi prepisalo naše promene
        if (isSaving || saveQueued || hasPendingChanges) {
            console.log('⏳ Real-time listener: save u toku, preskačem');
            return;
        }

        console.log('⚡ Real-time update detektovan, povlačim sveže podatke');
        // Snimi staru pending count za kuvara PRE load-a
        const oldPendingCount = DB.kitchenOrders ? DB.kitchenOrders.filter(ko => ko.status === 'pending' || ko.status === 'preparing').length : 0;
        lastUpdate = serverLastUpdate;
        loadFromFirebase().then(() => {
            checkAndPlayNotificationSounds(oldPendingCount);
            render();
        }).catch(err => console.error('❌ Real-time load error:', err));
    });

    console.log('👂 Real-time /lastUpdated listener pokrenut');
}

// ============================================
// REFRESH ON FOCUS
// ============================================
let focusRefreshSetup = false;
function startFocusRefresh() {
    if (focusRefreshSetup) return;
    focusRefreshSetup = true;

    const handler = function() {
        if (document.visibilityState === 'visible') {
            console.log('🔄 Tab vraćen u fokus, povlačim sveže podatke');
            checkForUpdates();
        }
    };

    window.addEventListener('focus', handler);
    document.addEventListener('visibilitychange', handler);

    console.log('🔄 Focus refresh aktivan');
}

// ============================================
// AUTO-RELOAD NA NOVU VERZIJU
// version.json u root-u sadrži {"v":"..."}
// Pri svakom deploy-u promeni vrednost - svi uređaji se sami refreshuju
// ============================================
let _initialAppVersion = null;
let _versionCheckTimer = null;
let _versionReloadInProgress = false;

async function fetchAppVersion() {
    try {
        const res = await fetch('version.json?_=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        return data && data.v ? String(data.v) : null;
    } catch (e) {
        return null;
    }
}

async function startVersionChecker() {
    if (_versionCheckTimer) return;

    // Prvo učitavanje - zapamti trenutnu verziju
    _initialAppVersion = await fetchAppVersion();
    console.log('🆕 App verzija: ' + (_initialAppVersion || 'nepoznato'));

    // Provera svakih 60 sekundi
    _versionCheckTimer = setInterval(async function() {
        if (_versionReloadInProgress) return;
        const current = await fetchAppVersion();
        if (current && _initialAppVersion && current !== _initialAppVersion) {
            _versionReloadInProgress = true;
            console.log('🔄 Nova verzija detektovana (' + current + '), reload za 3 sekunde...');
            // Mali delay da se eventualne pending operacije završe
            setTimeout(function() {
                window.location.reload(true);
            }, 3000);
        }
    }, 60000);
}


// ============================================
// ATOMIČKO ČUVANJE WORKDAY-OVA
// Svaki korisnik piše SAMO svoj workday na /workdays/{safeKey}
// Nijedan uređaj ne može da prepiše tuđi workday
// ============================================

// Firebase ne radi dobro sa razmacima/specijalnim znacima u ključevima
// Sanitizujemo username za upotrebu kao Firebase path
function sanitizeFirebaseKey(str) {
    if (!str) return 'unknown';
    // Zameni sve što Firebase ne voli: . $ # [ ] / i razmake
    return str.replace(/[\.\$\#\[\]\/\s]/g, '_');
}

let workdayListenerActive = false;

function startWorkdayListener() {
    if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) return;
    if (workdayListenerActive) return;
    workdayListenerActive = true;
    
    database.ref('/workdays').on('value', (snapshot) => {
        const serverWorkdays = snapshot.val() || {};
        const oldCount = Object.keys(DB.workdays || {}).length;
        
        // ✅ Mapiraj sanitizovane Firebase ključeve nazad na originalne username-ove
        // Firebase čuva kao /workdays/vukasin_n ali DB.workdays treba da bude pod "vukasin n"
        const mappedWorkdays = {};
        const allUsers = DB.users || [];
        
        for (const [firebaseKey, workdayData] of Object.entries(serverWorkdays)) {
            // Probaj da nađeš originalni username: prvo preko workday.user polja
            if (workdayData && workdayData.user) {
                mappedWorkdays[workdayData.user] = workdayData;
            } else {
                // Fallback: probaj da nađeš usera čiji sanitized key matchuje
                const matchedUser = allUsers.find(u => sanitizeFirebaseKey(u.username) === firebaseKey);
                if (matchedUser) {
                    mappedWorkdays[matchedUser.username] = workdayData;
                } else {
                    // Koristi Firebase key kao fallback
                    mappedWorkdays[firebaseKey] = workdayData;
                }
            }
        }
        
        DB.workdays = mappedWorkdays;
        const newCount = Object.keys(DB.workdays).length;
        
        // ⏰ Auto-zatvori istekle smene kad se podaci osvеže
        if (typeof checkAndAutoCloseShifts === 'function') {
            checkAndAutoCloseShifts();
        }
        
        // Re-renderuj samo ako se nešto promenilo
        if (newCount !== oldCount) {
            console.log('👥 Workdays ažurirani u realnom vremenu:', Object.keys(DB.workdays));
            render();
        }
    });
    
    console.log('👂 Workday real-time listener pokrenut');
}


// Otvori smenu za korisnika - piše SAMO na /workdays/{safeKey}
async function saveWorkday(username, workdayData) {
    if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) return;
    const safeKey = sanitizeFirebaseKey(username);
    try {
        // Uvek čuvaj originalni username u podacima
        workdayData.user = username;
        await database.ref('/workdays/' + safeKey).set(workdayData);
        
        // ✅ Obriši stari ključ ako je bio sa razmakom (migracija)
        if (safeKey !== username) {
            database.ref('/workdays/' + username).remove().catch(() => {});
        }
        
        DB.workdays[username] = workdayData;
        console.log('✅ Workday sačuvan za:', username, '(key:', safeKey + ')');
    } catch (err) {
        console.error('❌ Greška pri čuvanju workday-a:', err);
        throw err;
    }
}


// Atomički dodaj zapis u workdayHistory na Firebase
// Ovo je KRITIČNO - mora se sacuvati PRE brisanja workday-a
// jer drugi uredjaji citaju workdayHistory za nasleđivanje depozita
async function pushWorkdayHistory(historyEntry) {
    if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) return;
    try {
        await database.ref('/workdayHistory').set(DB.workdayHistory);
        console.log('✅ WorkdayHistory atomički sačuvan, ukupno:', DB.workdayHistory.length);
    } catch (err) {
        console.error('❌ Greška pri čuvanju workdayHistory:', err);
        throw err;
    }
}


// Zatvori smenu za korisnika - briše SAMO /workdays/{safeKey}
async function removeWorkday(username) {
    if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) {
        delete DB.workdays[username];
        return;
    }
    const safeKey = sanitizeFirebaseKey(username);
    try {
        await database.ref('/workdays/' + safeKey).remove();
        delete DB.workdays[username];
        console.log('✅ Workday obrisan za:', username, '(key:', safeKey + ')');
    } catch (err) {
        console.error('❌ Greška pri brisanju workday-a:', err);
        throw err;
    }
}


// Ažuriraj workday podatke (npr. cashReductions) - piše SAMO na /workdays/{safeKey}
async function updateWorkday(username, updates) {
    if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) {
        if (DB.workdays[username]) Object.assign(DB.workdays[username], updates);
        return;
    }
    const safeKey = sanitizeFirebaseKey(username);
    try {
        await database.ref('/workdays/' + safeKey).update(updates);
        if (DB.workdays[username]) {
            Object.assign(DB.workdays[username], updates);
        }
        console.log('✅ Workday ažuriran za:', username, '(key:', safeKey + ')');
    } catch (err) {
        console.error('❌ Greška pri ažuriranju workday-a:', err);
        throw err;
    }
}

