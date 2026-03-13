// ============================================
// DEMO MODE - Probna verzija za demonstraciju
// ============================================

var DEMO_MODE = false;

function startDemo() {
    DEMO_MODE = true;
    localStorage.setItem('demoMode', 'true');
    
    // Postavi demo podatke
    DB.settings = {
        name: 'Wood Pizza Bar - DEMO',
        octoposEnabled: false,
        geoEnabled: false
    };
    
    DB.users = [
        { username: 'admin', password: '1234', role: 'admin', hourlyRate: 0 },
        { username: 'Marko', password: '1111', role: 'konobar', hourlyRate: 350 },
        { username: 'Jelisaveta', password: '2222', role: 'konobar', hourlyRate: 350 },
        { username: 'Nevena', password: '3333', role: 'konobar', hourlyRate: 380 },
        { username: 'Raul', password: '4444', role: 'kuvar', hourlyRate: 400 }
    ];
    
    DB.menu = [
        // Pizza
        { id: 1001, name: 'Margherita', desc: 'Sos, mocarela, bosiljak', price: 890, cat: 'Pizza', group: '' },
        { id: 1002, name: 'Capricciosa', desc: 'Šunka, šampinjoni, masline', price: 990, cat: 'Pizza', group: '' },
        { id: 1003, name: 'Quattro Formaggi', desc: 'Četiri sira', price: 1090, cat: 'Pizza', group: '' },
        { id: 1004, name: 'Diavola', desc: 'Ljuta salama, feferoni', price: 990, cat: 'Pizza', group: '' },
        { id: 1005, name: 'Prosciutto e Rucola', desc: 'Pršuta, rukola, parmezan', price: 1190, cat: 'Pizza', group: '' },
        { id: 1006, name: 'BBQ Chicken', desc: 'Piletina, bbq sos, luk', price: 1090, cat: 'Pizza', group: '' },
        
        // Paste
        { id: 2001, name: 'Carbonara', desc: 'Panceta, jaje, parmezan', price: 850, cat: 'Paste', group: '' },
        { id: 2002, name: 'Bolognese', desc: 'Mljeveno meso, paradajz sos', price: 790, cat: 'Paste', group: '' },
        { id: 2003, name: 'Penne Arrabiata', desc: 'Ljuti paradajz sos', price: 690, cat: 'Paste', group: '' },
        
        // Burgeri
        { id: 3001, name: 'Classic Burger', desc: '200g junetina, salata, sos', price: 750, cat: 'Burgeri', group: '' },
        { id: 3002, name: 'Cheese Burger', desc: 'Čedar, slanina, luk', price: 850, cat: 'Burgeri', group: '' },
        { id: 3003, name: 'Smash Burger', desc: 'Dupli smash patty', price: 950, cat: 'Burgeri', group: '' },
        
        // Salate
        { id: 4001, name: 'Cezar salata', desc: 'Piletina, parmezan, dresing', price: 690, cat: 'Salate', group: '' },
        { id: 4002, name: 'Grčka salata', desc: 'Feta, masline, paradajz', price: 590, cat: 'Salate', group: '' },
        
        // Deserti
        { id: 5001, name: 'Palačinke', desc: 'Nutella, banana, šlag', price: 450, cat: 'Deserti', group: '' },
        { id: 5002, name: 'Cheesecake', desc: 'New York style', price: 490, cat: 'Deserti', group: '' },
        { id: 5003, name: 'Tiramisu', desc: 'Klasični italijanski', price: 520, cat: 'Deserti', group: '' },
        
        // Piće
        { id: 6001, name: 'Coca-Cola 0.33', desc: '', price: 200, cat: 'Piće', group: '' },
        { id: 6002, name: 'Fanta 0.33', desc: '', price: 200, cat: 'Piće', group: '' },
        { id: 6003, name: 'Rosa voda 0.5', desc: '', price: 150, cat: 'Piće', group: '' },
        { id: 6004, name: 'Ceđena pomorandža', desc: 'Sveže ceđena', price: 350, cat: 'Piće', group: '' },
        { id: 6005, name: 'Espresso', desc: '', price: 180, cat: 'Piće', group: '' },
        { id: 6006, name: 'Cappuccino', desc: '', price: 250, cat: 'Piće', group: '' },
        { id: 6007, name: 'Zaječarsko 0.5', desc: 'Točeno pivo', price: 300, cat: 'Piće', group: '' },
        { id: 6008, name: 'Jelen 0.33', desc: '', price: 250, cat: 'Piće', group: '' },
        
        // Alkohol
        { id: 7001, name: 'Domaća rakija', desc: '0.05l', price: 250, cat: 'Piće', group: '' },
        { id: 7002, name: 'Vranac čaša', desc: '0.2l', price: 350, cat: 'Piće', group: '' },
        { id: 7003, name: 'Jack Daniels', desc: '0.03l', price: 450, cat: 'Piće', group: '' }
    ];
    
    DB.tables = [
        { num: 1, name: 'Sto 1', order: [], discount: 0, discountPercent: 0, discountedItems: [] },
        { num: 2, name: 'Sto 2', order: [], discount: 0, discountPercent: 0, discountedItems: [] },
        { num: 3, name: 'Sto 3', order: [], discount: 0, discountPercent: 0, discountedItems: [] },
        { num: 4, name: 'Sto 4', order: [], discount: 0, discountPercent: 0, discountedItems: [] },
        { num: 5, name: 'Bašta 1', order: [], discount: 0, discountPercent: 0, discountedItems: [] },
        { num: 6, name: 'Bašta 2', order: [], discount: 0, discountPercent: 0, discountedItems: [] },
        { num: 7, name: 'Šank', order: [], discount: 0, discountPercent: 0, discountedItems: [] },
        { num: 8, name: 'Terasa', order: [], discount: 0, discountPercent: 0, discountedItems: [] }
    ];
    
    // Dodaj neke narudžbine na stolove
    var now = new Date();
    DB.tables[0].order = [
        { id: 1001, name: 'Margherita', price: 890, qty: 1, cat: 'Pizza', createdBy: 'Marko', addedAt: new Date(now - 3600000).toISOString() },
        { id: 6001, name: 'Coca-Cola 0.33', price: 200, qty: 2, cat: 'Piće', createdBy: 'Marko', addedAt: new Date(now - 3600000).toISOString() }
    ];
    
    DB.tables[2].order = [
        { id: 3002, name: 'Cheese Burger', price: 850, qty: 2, cat: 'Burgeri', createdBy: 'Jelisaveta', addedAt: new Date(now - 1800000).toISOString() },
        { id: 4001, name: 'Cezar salata', price: 690, qty: 1, cat: 'Salate', createdBy: 'Jelisaveta', addedAt: new Date(now - 1800000).toISOString() },
        { id: 6007, name: 'Zaječarsko 0.5', price: 300, qty: 3, cat: 'Piće', createdBy: 'Jelisaveta', addedAt: new Date(now - 1800000).toISOString() }
    ];
    
    DB.tables[4].order = [
        { id: 1005, name: 'Prosciutto e Rucola', price: 1190, qty: 1, cat: 'Pizza', createdBy: 'Nevena', addedAt: new Date(now - 900000).toISOString() },
        { id: 2001, name: 'Carbonara', price: 850, qty: 1, cat: 'Paste', createdBy: 'Nevena', addedAt: new Date(now - 900000).toISOString() },
        { id: 6006, name: 'Cappuccino', price: 250, qty: 2, cat: 'Piće', createdBy: 'Nevena', addedAt: new Date(now - 900000).toISOString() }
    ];
    
    // Demo narudžbine (završene)
    var today7am = new Date(now);
    today7am.setHours(7, 0, 0, 0);
    if (now < today7am) today7am.setDate(today7am.getDate() - 1);
    
    DB.orders = [
        { id: Date.now() - 50000, table: 7, tableName: 'Šank', items: [{id:6005,name:'Espresso',price:180,qty:3},{id:6006,name:'Cappuccino',price:250,qty:2}], sub:1040, disc:0, tot:1040, method:'Cash', createdBy:'Marko', time: new Date(today7am.getTime() + 3600000).toISOString() },
        { id: Date.now() - 40000, table: 2, tableName: 'Sto 2', items: [{id:1002,name:'Capricciosa',price:990,qty:2},{id:6001,name:'Coca-Cola 0.33',price:200,qty:2}], sub:2380, disc:0, tot:2380, method:'Card', createdBy:'Jelisaveta', time: new Date(today7am.getTime() + 7200000).toISOString() },
        { id: Date.now() - 30000, table: 4, tableName: 'Sto 4', items: [{id:3001,name:'Classic Burger',price:750,qty:1},{id:6008,name:'Jelen 0.33',price:250,qty:2}], sub:1250, disc:0, tot:1250, method:'Cash', createdBy:'Marko', time: new Date(today7am.getTime() + 10800000).toISOString() },
        { id: Date.now() - 20000, table: 5, tableName: 'Bašta 1', items: [{id:1003,name:'Quattro Formaggi',price:1090,qty:1},{id:4002,name:'Grčka salata',price:590,qty:1},{id:6004,name:'Ceđena pomorandža',price:350,qty:2}], sub:2380, disc:0, tot:2380, method:'Card', createdBy:'Nevena', time: new Date(today7am.getTime() + 14400000).toISOString() },
        { id: Date.now() - 10000, table: 1, tableName: 'Sto 1', items: [{id:5001,name:'Palačinke',price:450,qty:2},{id:6005,name:'Espresso',price:180,qty:2}], sub:1260, disc:0, tot:1260, method:'Cash', createdBy:'Jelisaveta', time: new Date(today7am.getTime() + 18000000).toISOString() }
    ];
    
    // Kuhinjske narudžbine
    DB.kitchenOrders = [
        { id: Date.now() - 5000, tableNum: 1, tableName: 'Sto 1', waiterUsername: 'Marko', waiterName: 'Marko', items: [{id:1001, name:'Margherita', qty:1}], status: 'preparing', orderedAt: new Date(now - 600000).toISOString() },
        { id: Date.now() - 4000, tableNum: 3, tableName: 'Sto 3', waiterUsername: 'Jelisaveta', waiterName: 'Jelisaveta', items: [{id:3002, name:'Cheese Burger', qty:2},{id:4001, name:'Cezar salata', qty:1}], status: 'pending', orderedAt: new Date(now - 300000).toISOString() },
        { id: Date.now() - 3000, tableNum: 5, tableName: 'Bašta 1', waiterUsername: 'Nevena', waiterName: 'Nevena', items: [{id:1005, name:'Prosciutto e Rucola', qty:1},{id:2001, name:'Carbonara', qty:1}], status: 'pending', orderedAt: new Date(now - 120000).toISOString() }
    ];
    
    // Aktivne smene
    DB.workdays = {
        'Marko': { user: 'Marko', startTime: new Date(today7am.getTime() + 3600000).toISOString(), deposit: 5000 },
        'Jelisaveta': { user: 'Jelisaveta', startTime: new Date(today7am.getTime() + 3600000).toISOString(), inheritedFrom: 'Marko', deposit: 5000 },
        'Nevena': { user: 'Nevena', startTime: new Date(today7am.getTime() + 28800000).toISOString(), inheritedFrom: 'Marko', deposit: 5000 },
        'Raul': { user: 'Raul', startTime: new Date(today7am.getTime() + 3600000).toISOString(), role: 'kuvar' }
    };
    
    // Istorija smena
    DB.workdayHistory = [];
    DB.debts = [];
    DB.removedItems = [];
    DB.octoposPending = [];
    DB.inventory = [];
    
    // Sačuvaj u demo localStorage
    localStorage.setItem('restaurantPOS_demo', JSON.stringify(DB));
    
    page = 'login';
    render();
    
    showAlert('🎮 DEMO MODE\n\nDobrodošli u demo verziju!\n\n👨‍🍳 Konobari: Marko (1111), Jelisaveta (2222), Nevena (3333)\n🍳 Kuvar: Raul (4444)\n🔑 Admin: 1234\n\n8 stolova, 30 artikala, 3 aktivne narudžbine na stolovima');
}


function exitDemo() {
    DEMO_MODE = false;
    localStorage.removeItem('demoMode');
    localStorage.removeItem('restaurantPOS_demo');
    location.reload();
}


// Override save/load u demo modu
var _originalSave = null;
var _originalLoad = null;

function initDemoOverrides() {
    // Proveri da li smo u demo modu
    if (localStorage.getItem('demoMode') === 'true') {
        DEMO_MODE = true;
        
        // Učitaj demo podatke
        try {
            var demoData = JSON.parse(localStorage.getItem('restaurantPOS_demo'));
            if (demoData) {
                Object.keys(demoData).forEach(function(key) {
                    DB[key] = demoData[key];
                });
            }
        } catch(e) {
            console.warn('Demo data load error:', e);
        }
    }
}


// Hook u save funkciju da demo čuva u svoj localStorage
function demoSave() {
    if (!DEMO_MODE) return false;
    try {
        localStorage.setItem('restaurantPOS_demo', JSON.stringify({
            menu: DB.menu,
            tables: DB.tables,
            orders: DB.orders,
            users: DB.users,
            settings: DB.settings,
            workdays: DB.workdays,
            workdayHistory: DB.workdayHistory,
            kitchenOrders: DB.kitchenOrders,
            debts: DB.debts,
            removedItems: DB.removedItems,
            inventory: DB.inventory,
            octoposPending: DB.octoposPending
        }));
    } catch(e) {
        console.warn('Demo save error:', e);
    }
    return true;
}
