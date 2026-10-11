// ============================================
// 🖨️ ŠTAMPA PORUDŽBINA ZA KUHINJU
//
// Konobar kuca na kompjuteru u lokalu, na kom je i štampač — pa dugme
// štampa odmah, na tom istom uređaju. Nema slanja naloga ni čekanja.
//
// Štampa ide kroz Windows štampač (window.print), a ne na mrežnu adresu:
// web stranica ne može da otvori direktnu vezu ka štampaču. Zato je i staro
// polje "IP Adresa štampača" u Postavkama uklonjeno — nije radilo ništa.
//
// Da ne iskače prozor za štampu pri svakom pritisku, Chrome treba pokrenuti
// sa --kiosk-printing (vidi Postavke → Štampanje za kuhinju).
// ============================================

// 🛵 Dostava se bira na stolu i važi dok se sto ne naplati ili očisti.
// Prelazi i na naplaćen račun (vidi confirmPay) da bi se promet dostave
// mogao izdvojiti u izveštaju — kuhinjski papir ne zna ništa o novcu.
function toggleDelivery(tableNum) {
    const table = (DB.tables || []).find(function(t) { return t.num === tableNum; });
    if (!table) return;
    table.isDelivery = !table.isDelivery;
    if (typeof markTableDirty === 'function') markTableDirty(table.num);
    save();
    render();
}

// Poslednja kuhinjska porudžbina za taj sto koja nije završena.
function _latestKitchenOrderFor(tableNum, username) {
    let naj = null;
    (DB.kitchenOrders || []).forEach(function(ko) {
        if (!ko || ko.status === 'completed') return;
        if (String(ko.tableNum) !== String(tableNum)) return;
        if (username && ko.waiterUsername !== username) return;
        if (!naj || (ko.orderedAt || '') > (naj.orderedAt || '')) naj = ko;
    });
    return naj;
}

// --- Dugme kod konobara ---
function requestKitchenPrint(tableNum) {
    const username = DB.currentUser ? DB.currentUser.username : null;
    const ko = _latestKitchenOrderFor(tableNum, username);
    if (!ko) {
        showAlert('Nema šta da se štampa.\n\nZa ovaj sto nema porudžbine za kuhinju — ' +
                  'piće se ne šalje u kuhinju, a završene porudžbine se ne štampaju ponovo.');
        return;
    }

    // Drugi put je ponovna štampa — kuhinja mora da zna da to nije nova porudžbina.
    const ponovo = !!ko.printedAt;
    const table = (DB.tables || []).find(function(t) { return t.num === tableNum; });
    printKitchenTicket(ko, ponovo, !!(table && table.isDelivery));

    ko.printedAt = new Date().toISOString();
    if (typeof markDirty === 'function') markDirty('kitchenOrders', ko.id);
    save();
}

// --- Sam ispis ---
function printKitchenTicket(ko, ponovo, dostava) {
    const esc = (typeof escapeHtml === 'function') ? escapeHtml : function(x) { return String(x == null ? '' : x); };
    let area = document.getElementById('printArea');
    if (!area) {
        area = document.createElement('div');
        area.id = 'printArea';
        document.body.appendChild(area);
    }

    let items = ko.items || [];
    if (!Array.isArray(items)) items = Object.values(items);

    const vreme = new Date(ko.orderedAt || Date.now())
        .toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });

    let h = '';
    if (ponovo) h += '<div class="pt-ponovo">*** PONOVO ŠTAMPANO ***</div>';
    // Ide IZNAD stola: kuhinja po tome odlučuje pakuje li u kutije ili na tanjir,
    // pa mora da se vidi pre nego što se pročita išta drugo.
    // Bez emoji-ja: termalne glave ih često odštampaju kao crnu mrlju ili
    // prazan kvadrat. Na papiru je bitna reč, ne sličica.
    if (dostava) h += '<div class="pt-dostava">DOSTAVA</div>';
    h += '<div class="pt-sto">' + esc(ko.tableName || ('STO ' + ko.tableNum)) + '</div>';
    h += '<div class="pt-linija"></div>';
    items.forEach(function(it) {
        h += '<div class="pt-stavka"><span class="pt-kol">' + (Number(it.qty) || 1) + 'x</span>' +
             '<span class="pt-naziv">' + esc(it.name) + '</span></div>';
    });
    h += '<div class="pt-linija"></div>';
    h += '<div class="pt-noga">' + vreme + ' &nbsp;·&nbsp; ' + esc(ko.waiterName || ko.waiterUsername || '') + '</div>';

    area.innerHTML = h;
    window.print();
}
