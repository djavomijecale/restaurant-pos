// ============================================
// 🌍 JEZIK PO KORISNIKU (srpski / španski)
//
// Jezik se vezuje za KORISNIKA (user.lang), ne za ime — da preimenovanje
// naloga ne pokvari prevod i da se isto može dati bilo kom radniku.
//
// Prevod se radi NAD DOM-om posle iscrtavanja, a ne kroz t('kljuc') po
// izvoru. Razlog: ekrani su već napisani sa srpskim tekstom umetnutim u
// šablone; prepisivanje svakog mesta bi diralo stotine linija žive logike
// i svaka omaška bi obarala kuvarov ekran. Ovako srpski izvor ostaje
// netaknut — što nije prevedeno samo ostane na srpskom, ništa se ne lomi.
//
// Prevode se tekstualni čvorovi i placeholder-i; atributi i onclick se ne
// diraju, pa ne može da se pokvari nijedan poziv.
// ============================================

const I18N_ES = {
    // --- Testa ---
    '🍞 Stanje testa': '🍞 Estado de la masa',
    'Skida se automatski čim konobar otkuca pizzu ili sendvič.':
        'Se descuenta automáticamente cuando el camarero registra una pizza o un bocadillo.',
    'VELIKA testa': 'Masa GRANDE',
    'MALA testa': 'Masa PEQUEÑA',
    'pizze 32cm': 'pizzas 32cm',
    'pizze 26cm · sendviči · fokača': 'pizzas 26cm · bocadillos · focaccia',
    '⚠️ NEMA NA STANJU': '⚠️ SIN EXISTENCIAS',
    'Poslednji upis:': 'Último registro:',
    'velikih /': 'grandes /',
    'malih — upisao': 'pequeñas — registró',
    'Od tada potrošeno:': 'Consumido desde entonces:',
    'velikih ·': 'grandes ·',
    'malih': 'pequeñas',
    'Stanje još nije upisano. Unesi koliko testa trenutno ima, pa će se dalje samo skidati.':
        'El estado aún no está registrado. Introduce cuánta masa hay ahora y después solo se irá descontando.',
    '➕ Dodaj napravljena testa': '➕ Añadir masa preparada',
    'Koliko si SADA napravio — dodaje se na postojeće stanje.':
        'Cuánta has hecho AHORA — se suma al estado actual.',
    'Velikih': 'Grandes',
    'Malih': 'Pequeñas',
    '➕ Dodaj': '➕ Añadir',
    '🗑️ Otpiši testa': '🗑️ Dar de baja masa',
    'Testa koja se ne mogu upotrebiti — skidaju se sa stanja uz razlog.':
        'Masa que no se puede usar — se descuenta indicando el motivo.',
    'Razlog': 'Motivo',
    'Pokvarilo se': 'Se ha estropeado',
    'Palo na pod': 'Se cayó al suelo',
    'Prekiselo / preraslo': 'Fermentó de más',
    'Loše umešeno': 'Mal amasada',
    'Ostalo…': 'Otro…',
    '🗑️ Otpiši': '🗑️ Dar de baja',
    '📋 Upiši zatečeno stanje': '📋 Registrar el estado actual',
    'Velikih ukupno': 'Grandes en total',
    'Malih ukupno': 'Pequeñas en total',
    '📋 Upiši stanje': '📋 Registrar estado',
    '✅ Gotovo — idi u kuhinju': '✅ Listo — ir a la cocina',

    // --- Kuhinja ---
    '🍳 Kuhinja': '🍳 Cocina',
    'Završi smenu': 'Terminar turno',
    'Na čekanju': 'En espera',
    'Spremljeno': 'Preparado',
    'U smeni': 'En el turno',
    '🔥 Počni Pripremu': '🔥 Empezar preparación',
    '✅ Spremno!': '✅ ¡Listo!',
    '✅ Spremno': '✅ Listo',
    '↩️ Vrati u pripremu': '↩️ Volver a preparación',
    '🆕 NOVO': '🆕 NUEVO',
    'SPREMNO': 'LISTO',
    '🆕 Čeka': '🆕 Esperando',
    '👍 Preuzeto': '👍 Recogido',
    '← Nazad': '← Atrás',
    '✅ Spremne Narudžbine': '✅ Pedidos listos',
    'Nema spremnih narudžbina': 'No hay pedidos listos',
    'Kada kuhinja pripremi hranu, pojaviće se ovde':
        'Cuando la cocina prepare la comida, aparecerá aquí',
    'HRANA SPREMNA!': '¡COMIDA LISTA!',
    'Sve narudžbine su spremne': 'Todos los pedidos están listos',
    'Čekamo nove narudžbine...': 'Esperando nuevos pedidos...',

    // --- Izveštaj kuvara ---
    '📊 Izveštaj Kuvara': '📊 Informe del cocinero',
    '⏱️ Vreme smene': '⏱️ Duración del turno',
    '📋 Narudžbine u smeni': '📋 Pedidos del turno',
    '📋 Narudžbine u Smeni': '📋 Pedidos del turno',
    '✅ Završeno': '✅ Completado',
    '🔥 Na čekanju': '🔥 En espera',
    'Procenat završenih': 'Porcentaje completado',
    'Nema podataka': 'Sin datos',
    'Niste prijavljeni': 'No has iniciado sesión',
    'Odjavite se i ponovo se prijavite.': 'Cierra sesión y vuelve a entrar.',

    // --- Nabavka ---
    '🛒 Nabavka Namirnica - Hrana': '🛒 Compras - Comida',
    '💡 Uputstvo:': '💡 Instrucciones:',
    'Označite namirnice za HRANU koje fale. Admin će dobiti obaveštenje.':
        'Marca los ingredientes de COMIDA que faltan. El administrador recibirá un aviso.',
    '➕ Dodaj Namirnicu Koja Fali': '➕ Añadir ingrediente que falta',

    // --- Navigacija ---
    'Testa': 'Masa',
    'Kuhinja': 'Cocina',
    'Nabavka': 'Compras',
    'Izveštaj': 'Informe',

    // --- Poruke ---
    'Unesi koliko si testa napravio.': 'Introduce cuánta masa has hecho.',
    'Unesi koliko testa otpisuješ.': 'Introduce cuánta masa das de baja.',
    'Izaberi razlog otpisa.': 'Elige el motivo de la baja.',
    'Upiši razlog otpisa.': 'Escribe el motivo de la baja.',
    'Unesi stanje (može i 0).': 'Introduce el estado (puede ser 0).',
    '🗑️ Otpisano.': '🗑️ Dado de baja.',
    '🗑️ Otpis testa': '🗑️ Baja de masa',
    '🍳 Završi Smenu': '🍳 Terminar turno',
    'Da li želite da završite smenu?': '¿Quieres terminar el turno?',
    '🍳 Otvaranje Smene': '🍳 Abrir turno',
    'Da li želiš da otvoriš smenu?': '¿Quieres abrir el turno?',
    '⚠️ Obaveštenje': '⚠️ Aviso',
    'Nemate pristup ovoj stranici': 'No tienes acceso a esta página',
    'Potvrda': 'Confirmación',
    'Da': 'Sí',
    'Ne': 'No',
    'Odustani': 'Cancelar',
    'Sačuvaj': 'Guardar'
};

// Tekst sa brojevima — recnik ne moze da ga pogodi doslovno.
// Zamena sme da bude i funkcija, zbog jednine/mnozine: "1 plato" / "2 platos".
const _mn = function(n, jedn, mnoz) { return Number(n) === 1 ? jedn : mnoz; };

const I18N_ES_PATTERNS = [
    [/^Otpisano u ovoj smeni: (\d+) velikih · (\d+) malih$/,
        'Dadas de baja en este turno: $1 grandes · $2 pequeñas'],
    [/^(\d+) aktivnih$/, function(m, n) { return n + ' ' + _mn(n, 'activo', 'activos'); }],
    [/^🏆 Bonus: (\d+)x$/, '🏆 Bono: $1x'],
    [/^(\d+) jela u ovoj smeni$/, function(m, n) { return n + ' ' + _mn(n, 'plato', 'platos') + ' en este turno'; }],
    [/^Još (\d+) jela do sledećeg bonusa$/, 'Faltan $1 platos para el siguiente bono'],
    [/^⏰ U pripremi \((\d+)\)$/, '⏰ En preparación ($1)'],
    [/^✅ Spremno za servisiranje \((\d+)\)$/, '✅ Listo para servir ($1)'],
    // stavka / stavke / stavki
    [/^• (\d+) stavk[aei]$/, function(m, n) { return '• ' + n + ' ' + _mn(n, 'artículo', 'artículos'); }],
    [/^(\d+) jela ukupno$/, function(m, n) { return n + ' ' + _mn(n, 'plato', 'platos') + ' en total'; }],
    [/^(\d+) jela$/, function(m, n) { return n + ' ' + _mn(n, 'plato', 'platos'); }],
    [/^od (\d{1,2}:\d{2})$/, 'desde $1'],
    [/^(\d+) minuta?$/, function(m, n) { return n + ' ' + _mn(n, 'minuto', 'minutos'); }],
    [/^(\d+) sati?$/, function(m, n) { return n + ' ' + _mn(n, 'hora', 'horas'); }],
    [/^Upravo sada$/, 'Ahora mismo'],
    [/^(\d+) namirnice? potrebno$/, function(m, n) { return n + ' ' + _mn(n, 'ingrediente necesario', 'ingredientes necesarios'); }],
    // Red otpisa: "11:20 · 3 vel ·", "14:05 · 2 mal ·", "11:20 · 3 vel + 2 mal ·"
    [/^(\d{1,2}:\d{2}) · (.+) ·$/, function(m, vreme, kol) {
        return vreme + ' · ' + kol.replace(/(\d+) vel/, '$1 gr').replace(/(\d+) mal/, '$1 peq') + ' ·';
    }],
    [/^📋 Stanje je prebrojano na početku smene \((.+)\)\. Dalje se menja samo dopunom i otpisom — tako brojka ostaje proverljiva\.$/,
        '📋 El estado se contó al inicio del turno ($1). Después solo cambia añadiendo o dando de baja — así la cifra sigue siendo comprobable.']
];

// Jezik trenutno prijavljenog korisnika.
function currentLang() {
    if (!DB.currentUser) return 'sr';
    const u = (DB.users || []).find(function(x) { return x && x.username === DB.currentUser.username; });
    return (u && u.lang) || 'sr';
}

function i18nPhrase(txt) {
    const s = String(txt == null ? '' : txt).replace(/\s+/g, ' ').trim();
    if (!s) return null;
    if (I18N_ES[s]) return I18N_ES[s];
    for (let i = 0; i < I18N_ES_PATTERNS.length; i++) {
        const p = I18N_ES_PATTERNS[i];
        if (p[0].test(s)) return s.replace(p[0], p[1]);
    }
    return null;
}

// Prevedi tekstualne cvorove i placeholder-e ispod `root`.
// Atributi i rukovaoci se NE diraju.
function i18nTranslate(root) {
    if (!root || currentLang() !== 'es') return;
    try {
        const hod = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        const zaIzmenu = [];
        let n;
        while ((n = hod.nextNode())) {
            const novo = i18nPhrase(n.nodeValue);
            if (novo !== null) zaIzmenu.push([n, novo]);
        }
        zaIzmenu.forEach(function(par) {
            // sačuvaj razmake oko teksta da se raspored ne pomeri
            const m = par[0].nodeValue.match(/^(\s*)[\s\S]*?(\s*)$/);
            par[0].nodeValue = (m ? m[1] : '') + par[1] + (m ? m[2] : '');
        });
        root.querySelectorAll('[placeholder]').forEach(function(el) {
            const novo = i18nPhrase(el.getAttribute('placeholder'));
            if (novo !== null) el.setAttribute('placeholder', novo);
        });
    } catch (e) {
        console.error('🌍 Greška pri prevodu:', e);   // nikad ne obara ekran
    }
}

// --- Zakačinjanje ---
// Prevodi se POSLE iscrtavanja. Modal za potvrdu se prevodi kad se otvori,
// jer se njegov tekst postavlja mimo render-a.
(function i18nHook() {
    if (typeof render === 'function') {
        const stariRender = render;
        render = function() {
            const r = stariRender.apply(this, arguments);
            if (currentLang() === 'es') {
                i18nTranslate(document.getElementById('content'));
                i18nTranslate(document.querySelector('.nav'));
            }
            return r;
        };
    }
    if (typeof showConfirm === 'function') {
        const stariConfirm = showConfirm;
        showConfirm = function(title, message, cb) {
            const r = stariConfirm.call(this, title, message, cb);
            if (currentLang() === 'es') i18nTranslate(document.getElementById('confirmModal'));
            return r;
        };
    }
})();
