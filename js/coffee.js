// ============================================
// ☕ KAFA SA MLINA
//
// Kontrola da li sve samlevene kafe prođu kroz kasu. Brojač na mlinu je
// KUMULATIVAN — samo raste — pa se pamti poslednje očitano stanje, a
// potrošnja u smeni je razlika: očitano − prethodno očitano.
//
// Konobar NE vidi broj iz kase dok ne unese svoj (slep unos). Da vidi
// unapred, samo bi prekucao taj isti broj i provera bi izgubila smisao.
//
// Poređenje ide po DOZAMA, ne po šoljama: "dupli espreso" troši dve doze.
// Bez toga bi mlin uvek pokazivao više od kase i svaka smena bi lažno
// "falila". Koliko koji artikal troši admin podešava u Postavkama.
// ============================================

// Podrazumevano dok admin ne podesi (Postavke → Kafa sa mlina).
const COFFEE_DEFAULT_DOSES = {
    'espresso': 1,
    'dupli espreso': 2,
    'espresso m': 1,
    'cappuccino': 1,
    'latte': 1,
    'iced c': 1
};

function _coffeeNorm(s) {
    return String(s || '').toLowerCase()
        .replace(/č|ć/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj')
        .replace(/\s+/g, ' ').trim();
}

// Koliko doza mlevene kafe troši artikal. 0 = ne dira mlin.
function getCoffeeDoses(item) {
    if (!item) return 0;
    let mi = null;
    if (DB.menu && DB.menu.length) {
        // Ime pre id-a: u meniju postoje artikli koji dele id (vidi js/dough.js).
        const n0 = _coffeeNorm(item.name);
        if (n0) mi = DB.menu.find(m => m && _coffeeNorm(m.name) === n0);
        if (!mi && item.id !== undefined && item.id !== null) {
            const byId = DB.menu.filter(m => m && String(m.id) === String(item.id));
            if (byId.length === 1) mi = byId[0];
        }
    }
    const src = mi || item;
    if (src.coffeeDoses !== undefined && src.coffeeDoses !== null && src.coffeeDoses !== '') {
        return Math.max(0, Number(src.coffeeDoses) || 0);
    }
    const n = _coffeeNorm(src.name || item.name);
    return COFFEE_DEFAULT_DOSES[n] || 0;
}

// Doze i šolje otkucane u periodu (fromISO, toISO]. `username` = samo taj konobar.
function countCoffeeDoses(fromISO, toISO, username) {
    let doses = 0, cups = 0;
    const scan = function(list) {
        (list || []).forEach(function(o) {
            if (!o || !o.time) return;
            if (fromISO && o.time <= fromISO) return;
            if (toISO && o.time > toISO) return;
            if (username && o.createdBy !== username) return;
            if (o.isDebtPayment) return;                  // vraćen dug nije nova kafa
            let items = o.items || [];
            if (!Array.isArray(items)) items = Object.values(items);
            items.forEach(function(it) {
                const d = getCoffeeDoses(it);
                if (!d) return;
                const q = Number(it.qty) || 0;
                doses += d * q;
                cups += q;
            });
        });
    };
    scan(DB.orders);
    scan(DB.houseOrders);        // kafa "na kuću" takođe prolazi kroz mlin
    return { doses: doses, cups: cups };
}

// Poslednje očitano stanje mlina: { value, at, by } ili null.
function getGrinderLast() {
    const g = DB.settings && DB.settings.grinderLast;
    if (!g || g.value === undefined || g.value === null) return null;
    return g;
}

function setGrinderReading(value, atISO) {
    if (!DB.settings) DB.settings = {};
    DB.settings.grinderLast = {
        value: Math.round(Number(value) || 0),
        at: atISO || new Date().toISOString(),
        by: DB.currentUser ? DB.currentUser.username : ''
    };
    save();
}

// Uporedi očitano stanje mlina sa onim što je prošlo kroz kasu.
//
// Razlika sa mlina pokriva period od POSLEDNJEG OČITAVANJA, pa se poredi sa
// kasom za isti period i za SVE konobare — ako su dvoje radili, kafe koje je
// otkucao drugi su takođe prošle kroz taj isti mlin. Zasebno se vodi i koliko
// je otkucao konobar koji zatvara smenu.
function computeCoffeeCheck(reading, shiftStartISO, endISO, username) {
    const last = getGrinderLast();
    const from = last ? last.at : shiftStartISO;
    const svi = countCoffeeDoses(from, endISO, null);
    const moje = countCoffeeDoses(shiftStartISO, endISO, username);
    const delta = last ? (Math.round(Number(reading) || 0) - Number(last.value)) : null;
    return {
        reading: Math.round(Number(reading) || 0),
        prevReading: last ? Number(last.value) : null,
        prevAt: last ? last.at : null,
        prevBy: last ? last.by : null,
        from: from,
        grinderDoses: delta,                                  // null = prvo očitavanje
        posDoses: svi.doses,
        posCups: svi.cups,
        myDoses: moje.doses,
        myCups: moje.cups,
        diff: (delta === null ? null : delta - svi.doses)     // + = mlin pokazuje više nego kasa
    };
}

// ============================================
// Unos pri zatvaranju smene (slep — bez broja iz kase)
// ============================================
let _grinderResolve = null;

function askGrinderReading() {
    return new Promise(function(resolve) {
        _grinderResolve = resolve;
        const last = getGrinderLast();
        const info = document.getElementById('grinderLastInfo');
        if (info) {
            info.innerHTML = last
                ? 'Poslednje upisano: <b style="color:#FFF">' + last.value + '</b> — ' +
                  (last.by ? escapeHtml(last.by) + ', ' : '') +
                  new Date(last.at).toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : 'Ovo je prvo očitavanje — upisuje se kao početno stanje.';
        }
        const inp = document.getElementById('grinderInput');
        if (inp) { inp.value = ''; }
        const err = document.getElementById('grinderError');
        if (err) err.textContent = '';
        const modal = document.getElementById('grinderModal');
        if (modal) modal.classList.add('show');
        if (inp) setTimeout(function() { inp.focus(); }, 100);
    });
}

function _closeGrinderModal(value) {
    const modal = document.getElementById('grinderModal');
    if (modal) modal.classList.remove('show');
    const r = _grinderResolve;
    _grinderResolve = null;
    if (r) r(value);
}

function grinderCancel() { _closeGrinderModal(null); }

function grinderSubmit() {
    const inp = document.getElementById('grinderInput');
    const err = document.getElementById('grinderError');
    const raw = inp ? inp.value.trim() : '';
    const setErr = function(m) { if (err) err.textContent = m; };

    if (raw === '') { setErr('Unesi broj sa mlina.'); return; }
    const v = Math.round(Number(raw));
    if (!isFinite(v) || v < 0) { setErr('Unesi ispravan broj.'); return; }

    // Brojač je kumulativan — manji broj znači grešku u kucanju ili zamenjen/
    // resetovan mlin. Ne odbijamo, ali tražimo potvrdu da ne prođe greškom.
    const last = getGrinderLast();
    if (last && v < Number(last.value)) {
        showConfirm('⚠️ Manji broj nego prošli put',
            'Upisao si ' + v + ', a poslednje stanje je bilo ' + last.value + '.\n\n' +
            'Brojač na mlinu ne ide unazad — ako nije resetovan ili zamenjen, verovatno je greška u kucanju.\n\n' +
            'Da upišem ipak ' + v + '?',
            function(da) { if (da) _closeGrinderModal(v); });
        return;
    }
    _closeGrinderModal(v);
}
