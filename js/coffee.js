// ============================================
// ☕ KAFA SA MLINA
//
// Kontrola da li sve samlevene kafe prođu kroz kasu.
//
// MLIN SE RESETUJE U PONOĆ. Zato očitan broj NIJE stanje brojača koje treba
// oduzimati od prethodnog — on već jeste "sve samleveno od 00:00 danas".
// Poredi se direktno sa kasom za isti period: od ponoći do zatvaranja smene.
//
// Zato se NE računa razlika između dva očitavanja: smena koja radi preko
// ponoći dala bi besmislicu (prethodno 40 u 16h, očitano 12 u 01:30 → −28).
// Iz istog razloga manji broj od prošlog puta nije greška — posle ponoći je
// to normalno.
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

// Doze i šolje otkucane u periodu [fromISO, toISO]. `username` = samo taj konobar.
// Donja granica je UKLJUČUJUĆA jer je to ponoć — kafa otkucana tačno u 00:00
// pripada novom danu mlina.
function countCoffeeDoses(fromISO, toISO, username) {
    let doses = 0, cups = 0;
    const scan = function(list) {
        (list || []).forEach(function(o) {
            if (!o || !o.time) return;
            if (fromISO && o.time < fromISO) return;
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
    const zapis = {
        value: Math.round(Number(value) || 0),
        at: atISO || new Date().toISOString(),
        by: DB.currentUser ? DB.currentUser.username : ''
    };
    DB.settings.grinderLast = zapis;
    // Dnevnik svih očitavanja — treba zbog očitanja u 23h: smena koja radi
    // preko ponoći time dobija i deo PRE ponoći (vidi computeCoffeeCheck).
    if (!Array.isArray(DB.settings.grinderReadings)) DB.settings.grinderReadings = [];
    DB.settings.grinderReadings.push(zapis);
    if (DB.settings.grinderReadings.length > 60) {
        DB.settings.grinderReadings = DB.settings.grinderReadings.slice(-60);
    }
    save();
}

// Poslednje očitavanje u intervalu [odISO, doISO) — koristi se da se nađe
// ono uzeto pred ponoć.
function findGrinderReadingIn(odISO, doISO) {
    const sve = (DB.settings && DB.settings.grinderReadings) || [];
    let naj = null;
    sve.forEach(function(r) {
        if (!r || !r.at) return;
        if (r.at < odISO || r.at >= doISO) return;
        if (!naj || r.at > naj.at) naj = r;
    });
    return naj;
}

// Ponoć pre datog trenutka — trenutak kada se mlin resetovao.
function grinderDayStart(atISO) {
    const d = new Date(atISO);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Uporedi očitano stanje mlina sa onim što je prošlo kroz kasu.
//
// Očitan broj = sve samleveno od ponoći, pa se poredi sa kasom od ponoći do
// zatvaranja smene, i to za SVE konobare — mlin je zajednički, kafe koje je
// otkucao drugi prošle su kroz isti mlin. Zasebno se vodi koliko je otkucao
// konobar koji zatvara smenu.
//
// Smena koja je počela juče a zatvara se posle ponoći: očitanje pokriva samo
// deo POSLE ponoći. Koliko je ta smena otkucala PRE ponoći vodi se posebno,
// kao nepokriveno — mlin je u međuvremenu resetovan i taj deo se iz ovog
// broja ne može proveriti.
function computeCoffeeCheck(reading, shiftStartISO, endISO, username) {
    const ponoc = grinderDayStart(endISO);
    const ponocISO = ponoc.toISOString();
    const preseklaPonoc = new Date(shiftStartISO) < ponoc;

    const svi = countCoffeeDoses(ponocISO, endISO, null);
    const moje = countCoffeeDoses(ponocISO, endISO, username);
    const r = Math.round(Number(reading) || 0);
    const last = getGrinderLast();

    // Deo smene PRE ponoći. Zatvaranje posle ponoći ga ne vidi — mlin je
    // resetovan. Zato aplikacija traži očitanje u 23h: ako ga ima, taj deo
    // se proverava zasebno (očitanje u 23h = sve samleveno od prethodne ponoći).
    const preMidnightISO = new Date(ponoc.getTime() - 1).toISOString();
    const nepokriveno = preseklaPonoc
        ? countCoffeeDoses(shiftStartISO, preMidnightISO, null)
        : { doses: 0, cups: 0 };

    let vece = null;
    if (preseklaPonoc) {
        const oc = findGrinderReadingIn(shiftStartISO, ponocISO);
        if (oc) {
            const prethodnaPonoc = grinderDayStart(oc.at).toISOString();
            const kasa = countCoffeeDoses(prethodnaPonoc, oc.at, null);
            vece = {
                reading: Number(oc.value),
                at: oc.at,
                by: oc.by || '',
                posDoses: kasa.doses,
                posCups: kasa.cups,
                diff: Number(oc.value) - kasa.doses
            };
        }
    }

    return {
        evening: vece,            // provera dela pre ponoći (null = nije očitano u 23h)
        reading: r,
        from: ponocISO,                       // period poređenja: od ponoći
        to: endISO,
        crossedMidnight: preseklaPonoc,
        grinderDoses: r,                      // očitan broj JESTE broj doza od ponoći
        posDoses: svi.doses,
        posCups: svi.cups,
        myDoses: moje.doses,
        myCups: moje.cups,
        uncoveredDoses: nepokriveno.doses,    // pre ponoći, van domašaja ovog očitanja
        uncoveredCups: nepokriveno.cups,
        diff: r - svi.doses,                  // + = mlin pokazuje više nego kasa
        prevReading: last ? Number(last.value) : null,
        prevAt: last ? last.at : null,
        prevBy: last ? last.by : null
    };
}

// ============================================
// ⏰ Podsetnik u 23h
//
// Smena koja radi preko ponoći ne može sa završnog broja da proveri deo PRE
// ponoći — mlin se u međuvremenu resetuje. Zato se stanje traži i u 23h, dok
// brojač još pokriva taj dan.
//
// Ne blokira rad (konobar je u 23h u poslu), ali se vraća svakih 10 minuta
// dok se ne upiše ili dok ne prođe ponoć, posle čega nema svrhe.
// ============================================
const GRINDER_EVENING_HOUR = 23;
let _grinderSnoozeUntil = 0;
let _grinderEveningTimer = null;

// Treba li SADA tražiti večernje očitanje?
function needsEveningGrinderReading() {
    if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) return false;
    if (!DB.currentUser) return false;
    const r = DB.currentUser.role;
    if (r !== 'konobar' && r !== 'waiter') return false;              // kuvar i admin ne diraju mlin
    if (!(DB.workdays && DB.workdays[DB.currentUser.username])) return false;   // nema otvorenu smenu
    if (_grinderResolve) return false;                                // modal je već otvoren
    if (Date.now() < _grinderSnoozeUntil) return false;

    const sada = new Date();
    if (sada.getHours() !== GRINDER_EVENING_HOUR) return false;       // samo u 23h

    // Mlin je zajednički — ako je neko već očitao posle 23h, dosta je.
    const prag = new Date(sada); prag.setHours(GRINDER_EVENING_HOUR, 0, 0, 0);
    return !findGrinderReadingIn(prag.toISOString(), new Date(prag.getTime() + 3600000).toISOString());
}

function checkEveningGrinderReading() {
    if (!needsEveningGrinderReading()) return;
    askGrinderReading({
        title: '⏰ Očitaj mlin pre ponoći',
        subtitle: 'U ponoć se mlin resetuje. Upiši broj koji sada piše na njemu, da se ' +
                  'i večerašnje kafe mogu proveriti.',
        cancelLabel: 'Za 10 minuta'
    }).then(function(v) {
        if (v === null) { _grinderSnoozeUntil = Date.now() + 10 * 60000; return; }
        setGrinderReading(v);
        showAlert('✅ Upisano: ' + v + '\n\nHvala — večerašnje kafe su sada pokrivene.');
    });
}

function startGrinderEveningReminder() {
    if (_grinderEveningTimer) clearInterval(_grinderEveningTimer);
    _grinderEveningTimer = setInterval(checkEveningGrinderReading, 2 * 60000);
    setTimeout(checkEveningGrinderReading, 20000);
}

// ============================================
// Unos pri zatvaranju smene (slep — bez broja iz kase)
// ============================================
let _grinderResolve = null;

function askGrinderReading(opts) {
    return new Promise(function(resolve) {
        _grinderResolve = resolve;
        const o = opts || {};
        const h = document.getElementById('grinderTitle');
        if (h) h.textContent = o.title || '☕ Stanje mlina';
        const sub = document.getElementById('grinderSubtitle');
        if (sub) {
            sub.textContent = o.subtitle ||
                'Pročitaj broj sa brojača na mlinu i upiši ga. Mlin se resetuje u ponoć, pa je to ' +
                'broj kafa samlevenih od ponoći. Bez ovoga se smena ne može zatvoriti.';
        }
        const cx = document.getElementById('grinderCancelBtn');
        if (cx) cx.textContent = o.cancelLabel || 'Odustani';
        const last = getGrinderLast();
        const info = document.getElementById('grinderLastInfo');
        if (info) {
            // Prethodno očitavanje ima smisla pokazati samo ako je od danas —
            // mlin se resetovao u ponoć, pa jučerašnji broj ne znači ništa.
            const istiDan = last && grinderDayStart(last.at).getTime() === grinderDayStart(new Date()).getTime();
            if (istiDan) {
                info.innerHTML = 'Danas je već upisano: <b style="color:#FFF">' + last.value + '</b> — ' +
                    (last.by ? escapeHtml(last.by) + ', ' : '') +
                    new Date(last.at).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
                info.style.display = '';
            } else if (o.subtitle) {
                // Večernji podsetnik već objašnjava reset — ne ponavljaj isto.
                info.innerHTML = '';
                info.style.display = 'none';
            } else {
                info.innerHTML = 'Mlin se resetuje u ponoć — upiši broj koji <b style="color:#FFF">sada</b> piše na njemu.';
                info.style.display = '';
            }
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

    // Manji broj je greška SAMO ako je prethodno očitavanje od ISTOG dana —
    // posle ponoći se mlin resetuje, pa je manji broj tada očekivan.
    const last = getGrinderLast();
    if (last && v < Number(last.value) &&
        grinderDayStart(last.at).getTime() === grinderDayStart(new Date()).getTime()) {
        showConfirm('⚠️ Manji broj nego maločas',
            'Upisao si ' + v + ', a danas je već upisano ' + last.value + '.\n\n' +
            'Mlin se resetuje tek u ponoć, pa u toku dana broj ne ide unazad — verovatno je greška u kucanju.\n\n' +
            'Da upišem ipak ' + v + '?',
            function(da) { if (da) _closeGrinderModal(v); });
        return;
    }
    _closeGrinderModal(v);
}
