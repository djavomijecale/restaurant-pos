// ============================================
// 🍞 STANJE TESTA
// Velika testa = pizze 32cm · Mala testa = pizze 26cm, sendviči, fokača
//
// VAŽNO (zašto ovako): stanje se NE umanjuje upisom u bazu na svaku prodaju.
// Kad dva konobara kucaju istovremeno, takvi upisi se gaze i brojka se gubi.
// Umesto toga čuvamo POPIS (koliko je testa bilo u trenutku X) i trenutno
// stanje RAČUNAMO:
//        stanje = popis − (testa potrošena na račune posle X)
// Isti princip kao depozit/kasa — otporno na istovremeni rad više uređaja
// i samo se ispravlja. Popis se upisuje retko (kuvar pri logovanju / dopuna).
// ============================================

// --- Automatsko prepoznavanje (pregazi se po artiklu u Meniju) ---
const DOUGH_BIG_NAMES = [
    'Margarita', 'Vegeteriana', 'Fungi', 'Vezuvio', 'Capocollo', 'Kapricoza',
    'Peperoni', 'Milano', 'Panceta', 'Tuna pizza', 'Prsuta', 'Tartufata pizza',
    '4 sira', 'Guanciale', 'Ventricina pizza', 'red wood', 'Losos pizza',
    'Prsuta rukola', 'mortadela pizza', 'wood', 'Tuna stek'
];
const DOUGH_SMALL_NAMES = [
    // pizze 26cm
    'Margarita 26', 'Vegetariana 26', 'Fungi 26', 'Vezuvio 26', 'Capocollo 26',
    'kapricoza 26', 'Peperoni 26', 'milano 26', 'panceta 26', 'prsuta 26',
    'tartufata 26', '4 sira 26', 'guanciale 26', 'tuna 26', 'ventricina 26',
    'red wood 26', 'losos 26', 'prsuta rukola 26', 'mortadela piz 26',
    'wood 26', 'Tuna stek 26',
    // sendviči
    'Jutarnji sendvic', 'Ljuti sendvic', 'Pizza sendvic', 'Prsuta sendvic', 'IT sendvič',
    // ostalo od testa
    'fokaca', 'Wood pizza'
];

function _doughNorm(s) {
    return String(s || '').toLowerCase()
        .replace(/č|ć/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj')
        .replace(/\s+/g, ' ').trim();
}
const _DOUGH_BIG_SET = new Set(DOUGH_BIG_NAMES.map(_doughNorm));
const _DOUGH_SMALL_SET = new Set(DOUGH_SMALL_NAMES.map(_doughNorm));

// Koje testo troši artikal: 'big' | 'small' | null.
// Prvo gleda izričito podešavanje iz Menija (item.dough), pa tek onda auto-listu.
function getDoughType(item) {
    if (!item) return null;
    // Ako je na samom artiklu izričito podešeno, to je konačno.
    if (item.dough === 'big' || item.dough === 'small') return item.dough;
    if (item.dough === 'none') return null;
    let mi = null;
    if (DB.menu && DB.menu.length) {
        // PRVO PO IMENU, pa tek onda po id-u: u meniju postoje artikli koji
        // dele isti id (npr. "wood" i "beli luk svoja", "losos 26" i "bosiljak"),
        // pa bi pretraga po id-u dodatku dodelila testo od pizze.
        const n0 = _doughNorm(item.name);
        if (n0) mi = DB.menu.find(m => m && _doughNorm(m.name) === n0);
        if (!mi && item.id !== undefined && item.id !== null) {
            // ...i to samo ako je id jednoznačan (npr. artikal preimenovan u Meniju).
            const byId = DB.menu.filter(m => m && String(m.id) === String(item.id));
            if (byId.length === 1) mi = byId[0];
        }
    }
    const src = mi || item;
    if (src.dough === 'big' || src.dough === 'small') return src.dough;
    if (src.dough === 'none') return null;              // izričito isključeno
    const n = _doughNorm(src.name || item.name);
    if (_DOUGH_BIG_SET.has(n)) return 'big';
    if (_DOUGH_SMALL_SET.has(n)) return 'small';
    return null;
}

// Trenutno stanje = popis − potrošnja posle popisa (računi + "Kuća")
function computeDoughStock() {
    const st = (DB.settings && DB.settings.doughStock) || null;
    const baseBig = st ? (Number(st.big) || 0) : 0;
    const baseSmall = st ? (Number(st.small) || 0) : 0;
    const since = st ? st.at : null;
    let usedBig = 0, usedSmall = 0;

    const scan = function(list) {
        (list || []).forEach(function(o) {
            if (!o || !o.time) return;
            if (since && o.time <= since) return;       // samo posle popisa
            let items = o.items || [];
            if (!Array.isArray(items)) items = Object.values(items);
            items.forEach(function(it) {
                const t = getDoughType(it);
                if (!t) return;
                const q = Number(it.qty) || 0;
                if (t === 'big') usedBig += q; else usedSmall += q;
            });
        });
    };
    scan(DB.orders);
    scan(DB.houseOrders);                                // "Kuća" takođe troši testo

    return {
        has: !!st,
        big: baseBig - usedBig,
        small: baseSmall - usedSmall,
        usedBig: usedBig, usedSmall: usedSmall,
        baseBig: baseBig, baseSmall: baseSmall,
        at: since, by: st ? st.by : null
    };
}

// Upiši apsolutno stanje.
//
// `jePopis` razdvaja PREBROJANO STANJE od obične korekcije (dopuna, otpis).
// Bez te razlike bi svaka dopuna izgledala kao nov popis i zaključavanje
// popisa po smeni se ne bi moglo sprovesti — zato se `countedAt` pomera
// samo kad je stvarno prebrojano.
function setDoughStocktake(big, small, jePopis) {
    if (!DB.settings) DB.settings = {};
    const staro = DB.settings.doughStock || {};
    DB.settings.doughStock = {
        big: Math.round(Number(big) || 0),
        small: Math.round(Number(small) || 0),
        at: new Date().toISOString(),
        by: DB.currentUser ? DB.currentUser.username : '',
        countedAt: jePopis ? new Date().toISOString() : (staro.countedAt || null),
        countedBy: jePopis ? (DB.currentUser ? DB.currentUser.username : '') : (staro.countedBy || null)
    };
    save();
}

// Dodaj napravljena testa (stanje = trenutno + dodato)
function addDough(bigDelta, smallDelta) {
    const s = computeDoughStock();
    setDoughStocktake(s.big + (Number(bigDelta) || 0), s.small + (Number(smallDelta) || 0), false);
}

// ============================================
// Popis se upisuje JEDNOM PO SMENI, na početku
//
// Kuvar prebroji zatečeno stanje kad se uloguje; posle toga mu je polje
// zaključano. U toku smene stanje se menja samo kroz dopunu i otpis, pa
// brojka ostaje proverljiva — da može da je prepravlja, "nema testa" ne bi
// značilo ništa. Admin nije ograničen: bez toga pogrešan unos ostaje
// pogrešan do kraja smene.
// ============================================
function kuvarShiftStart() {
    try {
        const ls = localStorage.getItem('kuvarLoginTime');
        if (ls) return ls;
    } catch (e) {}
    const u = DB.currentUser ? DB.currentUser.username : null;
    if (u && DB.workdays && DB.workdays[u] && DB.workdays[u].startTime) return DB.workdays[u].startTime;
    return null;
}

function canWriteDoughStocktake() {
    const role = DB.currentUser ? DB.currentUser.role : '';
    if (role === 'admin') return true;                    // admin uvek može da ispravi
    const st = (DB.settings && DB.settings.doughStock) || null;
    if (!st || !st.countedAt) return true;                // nikad nije prebrojano
    const pocetak = kuvarShiftStart();
    if (!pocetak) return true;                            // nema smene — ne zaključavaj naslepo
    return st.countedAt < pocetak;                        // popis je od pre ove smene
}

// --- Otpis ---
const DOUGH_WRITEOFF_REASONS = ['Pokvarilo se', 'Palo na pod', 'Prekiselo / preraslo', 'Loše umešeno'];

function writeOffDough(bigQty, smallQty, reason) {
    const b = Math.max(0, Math.round(Number(bigQty) || 0));
    const m = Math.max(0, Math.round(Number(smallQty) || 0));
    if (!b && !m) return false;
    const s = computeDoughStock();
    setDoughStocktake(s.big - b, s.small - m, false);
    if (!DB.settings.doughWriteOffs) DB.settings.doughWriteOffs = [];
    DB.settings.doughWriteOffs.push({
        at: new Date().toISOString(),
        by: DB.currentUser ? DB.currentUser.username : '',
        big: b, small: m,
        reason: String(reason || '').trim() || 'Bez razloga'
    });
    if (DB.settings.doughWriteOffs.length > 200) {
        DB.settings.doughWriteOffs = DB.settings.doughWriteOffs.slice(-200);
    }
    save();
    return true;
}

// Otpisi u zadatom periodu (za ekran i za izveštaj smene).
function doughWriteOffsBetween(fromISO, toISO) {
    return ((DB.settings && DB.settings.doughWriteOffs) || []).filter(function(w) {
        if (!w || !w.at) return false;
        if (fromISO && w.at < fromISO) return false;
        if (toISO && w.at > toISO) return false;
        return true;
    });
}

// --- Upozorenje konobaru kad testa nema (ne blokira) ---
let _doughWarnAt = { big: 0, small: 0 };
function doughWarnIfEmpty(item) {
    const t = getDoughType(item);
    if (!t) return;
    const s = computeDoughStock();
    if (!s.has) return;                                  // popis nikad nije unet — ne gnjavi
    const left = (t === 'big') ? s.big : s.small;
    if (left > 0) return;
    const now = Date.now();
    if (now - (_doughWarnAt[t] || 0) < 60000) return;     // najviše jednom u minutu
    _doughWarnAt[t] = now;
    showAlert('⚠️ Nema više ' + (t === 'big' ? 'VELIKIH' : 'MALIH') + ' testa!\n\n' +
        'Stanje: ' + left + (left < 0 ? ' (u minusu)' : '') +
        '\n\nMožeš da nastaviš da kucaš — javi kuhinji da doprave.');
}

// ============================================
// EKRAN: 🍞 Testa
// ============================================
function renderDough(c) {
    const s = computeDoughStock();
    const esc = (typeof escapeHtml === 'function') ? escapeHtml : function(x) { return String(x == null ? '' : x); };
    const role = DB.currentUser ? DB.currentUser.role : '';
    const fromLogin = !!window._doughFromLogin;

    const card = function(naziv, opis, broj, boja) {
        const low = broj <= 0;
        return `<div style="flex:1;min-width:150px;background:#16213E;border-radius:14px;padding:20px;text-align:center;border:2px solid ${low ? '#E94560' : 'transparent'}">
            <div style="color:#B0B0B0;font-size:13px">${naziv}</div>
            <div style="font-size:52px;font-weight:bold;color:${low ? '#E94560' : boja};line-height:1.1;margin:6px 0">${broj}</div>
            <div style="color:#888;font-size:12px">${opis}</div>
            ${low ? '<div style="color:#E94560;font-size:12px;font-weight:bold;margin-top:6px">⚠️ NEMA NA STANJU</div>' : ''}
        </div>`;
    };

    let h = `<div style="max-width:720px;margin:0 auto">
        <h2 style="margin-bottom:6px">🍞 Stanje testa</h2>
        <p style="color:#B0B0B0;font-size:13px;margin-bottom:18px">
            Skida se automatski čim konobar otkuca pizzu ili sendvič.
        </p>

        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
            ${card('VELIKA testa', 'pizze 32cm', s.big, '#FFD700')}
            ${card('MALA testa', 'pizze 26cm · sendviči · fokača', s.small, '#4CAF50')}
        </div>`;

    if (s.has) {
        const kada = s.at ? new Date(s.at).toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
        h += `<div style="background:#0F3460;padding:14px 16px;border-radius:12px;margin-bottom:16px;color:#B0B0B0;font-size:13px;line-height:1.7">
            Poslednji upis: <b style="color:#FFF">${s.baseBig}</b> velikih / <b style="color:#FFF">${s.baseSmall}</b> malih
            — upisao <b style="color:#FFF">${esc(s.by || '?')}</b>, ${kada}<br>
            Od tada potrošeno: <b style="color:#E94560">${s.usedBig}</b> velikih · <b style="color:#E94560">${s.usedSmall}</b> malih
        </div>`;
    } else {
        h += `<div style="background:#16213E;border-left:4px solid #FF9800;padding:14px 16px;border-radius:12px;margin-bottom:16px;color:#FFD700;font-size:13px">
            Stanje još nije upisano. Unesi koliko testa trenutno ima, pa će se dalje samo skidati.
        </div>`;
    }

    // --- Dopuna (kuvar i admin) ---
    h += `<div style="background:#0F3460;padding:18px;border-radius:12px;margin-bottom:14px">
            <h3 style="color:#4CAF50;margin-bottom:4px;font-size:17px">➕ Dodaj napravljena testa</h3>
            <p style="color:#888;font-size:12px;margin-bottom:12px">Koliko si SADA napravio — dodaje se na postojeće stanje.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
                <div style="flex:1;min-width:110px">
                    <label style="color:#B0B0B0;font-size:12px;display:block;margin-bottom:4px">Velikih</label>
                    <input type="number" id="doughAddBig" min="0" step="1" placeholder="0" style="width:100%;font-size:18px;text-align:center">
                </div>
                <div style="flex:1;min-width:110px">
                    <label style="color:#B0B0B0;font-size:12px;display:block;margin-bottom:4px">Malih</label>
                    <input type="number" id="doughAddSmall" min="0" step="1" placeholder="0" style="width:100%;font-size:18px;text-align:center">
                </div>
                <button class="btn" style="background:#4CAF50;flex:1;min-width:130px" onclick="doughAddSubmit()">➕ Dodaj</button>
            </div>
        </div>`;

    // --- Otpis ---
    h += `<div style="background:#0F3460;padding:18px;border-radius:12px;margin-bottom:14px">
            <h3 style="color:#E94560;margin-bottom:4px;font-size:17px">🗑️ Otpiši testa</h3>
            <p style="color:#888;font-size:12px;margin-bottom:12px">Testa koja se ne mogu upotrebiti — skidaju se sa stanja uz razlog.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
                <div style="flex:1;min-width:110px">
                    <label style="color:#B0B0B0;font-size:12px;display:block;margin-bottom:4px">Velikih</label>
                    <input type="number" id="doughOffBig" min="0" step="1" placeholder="0" style="width:100%;font-size:18px;text-align:center">
                </div>
                <div style="flex:1;min-width:110px">
                    <label style="color:#B0B0B0;font-size:12px;display:block;margin-bottom:4px">Malih</label>
                    <input type="number" id="doughOffSmall" min="0" step="1" placeholder="0" style="width:100%;font-size:18px;text-align:center">
                </div>
            </div>
            <label style="color:#B0B0B0;font-size:12px;display:block;margin-bottom:6px">Razlog</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
                ${DOUGH_WRITEOFF_REASONS.map(function(r) {
                    const izabran = window._doughOffReason === r;
                    return `<button class="btn" style="width:auto;flex:1;min-width:120px;font-size:13px;padding:10px;background:${izabran ? '#E94560' : '#16213E'}"
                        onclick="window._doughOffReason=${JSON.stringify(r)};render()">${esc(r)}</button>`;
                }).join('')}
                <button class="btn" style="width:auto;flex:1;min-width:120px;font-size:13px;padding:10px;background:${window._doughOffReason === '__other' ? '#E94560' : '#16213E'}"
                    onclick="window._doughOffReason='__other';render()">Ostalo…</button>
            </div>
            ${window._doughOffReason === '__other'
                ? '<input type="text" id="doughOffText" placeholder="Upiši razlog" style="width:100%;margin-bottom:10px">'
                : ''}
            <button class="btn" style="background:#E94560" onclick="doughWriteOffSubmit()">🗑️ Otpiši</button>
        </div>`;

    // --- Otpisi u ovoj smeni ---
    const pocetakSmene = kuvarShiftStart();
    const otpisi = doughWriteOffsBetween(pocetakSmene, null);
    if (otpisi.length) {
        const zbirB = otpisi.reduce(function(a, w) { return a + (w.big || 0); }, 0);
        const zbirM = otpisi.reduce(function(a, w) { return a + (w.small || 0); }, 0);
        h += `<div style="background:#16213E;padding:14px 16px;border-radius:12px;margin-bottom:14px">
                <div style="color:#E94560;font-weight:bold;font-size:14px;margin-bottom:8px">
                    Otpisano u ovoj smeni: ${zbirB} velikih · ${zbirM} malih
                </div>`;
        otpisi.slice().reverse().forEach(function(w) {
            h += `<div style="color:#B0B0B0;font-size:12px;padding:3px 0;line-height:1.5">
                    ${new Date(w.at).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })} ·
                    ${w.big ? w.big + ' vel' : ''}${w.big && w.small ? ' + ' : ''}${w.small ? w.small + ' mal' : ''} ·
                    <span style="color:#FFF">${esc(w.reason)}</span>
                    ${w.by ? '· ' + esc(w.by) : ''}
                  </div>`;
        });
        h += `</div>`;
    }

    // --- Popis: samo na početku smene (admin uvek) ---
    if (canWriteDoughStocktake()) {
        h += `<div style="background:#0F3460;padding:18px;border-radius:12px">
                <h3 style="color:#FFD700;margin-bottom:4px;font-size:17px">📋 Upiši zatečeno stanje</h3>
                <p style="color:#888;font-size:12px;margin-bottom:12px">
                    Prebroj koliko UKUPNO ima i upiši. ${role === 'admin'
                        ? 'Kao admin ovo možeš bilo kad.'
                        : 'Ovo se upisuje jednom, na početku smene — posle se stanje menja samo dopunom i otpisom.'}
                </p>
                <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
                    <div style="flex:1;min-width:110px">
                        <label style="color:#B0B0B0;font-size:12px;display:block;margin-bottom:4px">Velikih ukupno</label>
                        <input type="number" id="doughSetBig" min="0" step="1" value="${s.has ? Math.max(0, s.big) : ''}" placeholder="0" style="width:100%;font-size:18px;text-align:center">
                    </div>
                    <div style="flex:1;min-width:110px">
                        <label style="color:#B0B0B0;font-size:12px;display:block;margin-bottom:4px">Malih ukupno</label>
                        <input type="number" id="doughSetSmall" min="0" step="1" value="${s.has ? Math.max(0, s.small) : ''}" placeholder="0" style="width:100%;font-size:18px;text-align:center">
                    </div>
                    <button class="btn" style="flex:1;min-width:130px" onclick="doughSetSubmit()">📋 Upiši stanje</button>
                </div>
            </div>`;
    } else {
        const st = DB.settings.doughStock || {};
        h += `<div style="background:#16213E;padding:14px 16px;border-radius:12px;color:#888;font-size:13px;line-height:1.6">
                📋 Stanje je prebrojano na početku smene${st.countedBy ? ' (' + esc(st.countedBy) + ')' : ''}.
                Dalje se menja samo dopunom i otpisom — tako brojka ostaje proverljiva.
              </div>`;
    }

    if (fromLogin && role === 'kuvar') {
        h += `<button class="btn" style="margin-top:18px;background:#FF9800" onclick="window._doughFromLogin=false;nav('kitchen')">✅ Gotovo — idi u kuhinju</button>`;
    }

    h += `</div>`;
    c.innerHTML = h;
}

function doughAddSubmit() {
    const b = parseInt(document.getElementById('doughAddBig').value) || 0;
    const m = parseInt(document.getElementById('doughAddSmall').value) || 0;
    if (b <= 0 && m <= 0) { showAlert('Unesi koliko si testa napravio.'); return; }
    addDough(b, m);
    showAlert('✅ Dodato: ' + b + ' velikih, ' + m + ' malih.');
    render();
}

function doughSetSubmit() {
    const bEl = document.getElementById('doughSetBig');
    const mEl = document.getElementById('doughSetSmall');
    if (bEl.value === '' && mEl.value === '') { showAlert('Unesi stanje (može i 0).'); return; }
    const b = parseInt(bEl.value) || 0;
    const m = parseInt(mEl.value) || 0;
    // Brana i ovde, ne samo u prikazu — da se zaključano polje ne može zaobići.
    if (!canWriteDoughStocktake()) {
        showAlert('Stanje je već upisano na početku smene.\n\n' +
                  'Dalje se menja samo dopunom i otpisom.');
        render();
        return;
    }
    setDoughStocktake(b, m, true);
    showAlert('✅ Stanje upisano: ' + b + ' velikih, ' + m + ' malih.');
    render();
}

function doughWriteOffSubmit() {
    const b = parseInt((document.getElementById('doughOffBig') || {}).value) || 0;
    const m = parseInt((document.getElementById('doughOffSmall') || {}).value) || 0;
    if (b <= 0 && m <= 0) { showAlert('Unesi koliko testa otpisuješ.'); return; }

    let razlog = window._doughOffReason;
    if (!razlog) { showAlert('Izaberi razlog otpisa.'); return; }
    if (razlog === '__other') {
        razlog = ((document.getElementById('doughOffText') || {}).value || '').trim();
        if (!razlog) { showAlert('Upiši razlog otpisa.'); return; }
    }

    showConfirm('🗑️ Otpis testa',
        'Otpisuješ ' + (b ? b + ' velikih' : '') + (b && m ? ' i ' : '') + (m ? m + ' malih' : '') +
        '.\n\nRazlog: ' + razlog + '\n\nOvo se skida sa stanja i ostaje zabeleženo.',
        function(potvrda) {
            if (!potvrda) return;
            writeOffDough(b, m, razlog);
            window._doughOffReason = null;
            showAlert('🗑️ Otpisano.');
            render();
        });
}
