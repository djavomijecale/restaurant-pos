// ============================================
// WORKDAY MANAGEMENT
// ============================================


// ============================================
// BONUS POSTAVKE (admin može da menja u Postavke → Bonusi)
// Defaults se primenjuju ako admin nije podesio (backward-compatible).
// ============================================
function getBonusSettings() {
    const s = (DB && DB.settings) || {};
    function num(v, fallback) {
        const n = parseFloat(v);
        return isNaN(n) || n < 0 ? fallback : n;
    }
    return {
        // Konobari - prva smena (8-14h)
        firstShiftTier1Threshold: num(s.waiterBonusFirst1Threshold, 20000),
        firstShiftTier1Amount:    num(s.waiterBonusFirst1Amount,    1000),
        firstShiftTier2Threshold: num(s.waiterBonusFirst2Threshold, 40000),
        firstShiftTier2Amount:    num(s.waiterBonusFirst2Amount,    2000),
        // Konobari - druga smena (14-22h)
        secondShiftTier1Threshold: num(s.waiterBonusSecond1Threshold, 40000),
        secondShiftTier1Amount:    num(s.waiterBonusSecond1Amount,    1000),
        secondShiftTier2Threshold: num(s.waiterBonusSecond2Threshold, 60000),
        secondShiftTier2Amount:    num(s.waiterBonusSecond2Amount,    2000),
        // Kuvari
        kuvarDishesPerBonus: num(s.kuvarBonusDishesPerBonus, 30),
        kuvarBonusAmount:    num(s.kuvarBonusAmount, 1000)
    };
}
if (typeof window !== 'undefined') window.getBonusSettings = getBonusSettings;


function renderWorkday(c) {
    const username = DB.currentUser.username;
    const myWorkday = DB.workdays ? DB.workdays[username] : null;
    
    if(!myWorkday) {
        c.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh">
                <div style="background:#0F3460;padding:40px;border-radius:16px;max-width:500px;width:100%;text-align:center">
                    <div style="font-size:64px;margin-bottom:16px">📅</div>
                    <h2 style="color:#E94560;margin-bottom:16px">Dobrodošli!</h2>
                    <p style="color:#B0B0B0;margin-bottom:24px">Prijavili ste se kao: <strong style="color:#FFD700">${DB.konobarName || DB.currentUser.username}</strong></p>
                    <p style="color:#FFF;margin-bottom:32px;font-size:18px">Da li želite da otvorite novi radni dan?</p>
                    <button class="btn" onclick="openWorkday()">📅 Otvori Radni Dan</button>
                </div>
            </div>
        `;
    } else {
        const dayOrders = DB.orders.filter(o => o.time >= myWorkday.startTime && o.createdBy === username);
        const totalRevenue = dayOrders.reduce((s,o)=>s+o.tot,0);
        const cash = dayOrders.filter(o=>o.method==='Cash').reduce((s,o)=>s+o.tot,0);
        const card = dayOrders.filter(o=>o.method==='Card').reduce((s,o)=>s+o.tot,0);
        
        // Parse start time properly
        const startTime = new Date(myWorkday.startTime);
        const now = new Date();
        const durationMs = now - startTime;
        const duration = Math.floor(durationMs / 1000 / 60); // minutes
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;
        
        c.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh">
                <div style="background:#0F3460;padding:40px;border-radius:16px;max-width:600px;width:100%">
                    <div style="text-align:center;font-size:64px;margin-bottom:16px">📊</div>
                    <h2 style="color:#E94560;margin-bottom:24px;text-align:center">Zatvaranje Radnog Dana</h2>
                    
                    <div style="background:#16213E;padding:20px;border-radius:12px;margin-bottom:20px">
                        <div style="display:flex;justify-content:space-between;margin:8px 0">
                            <span style="color:#B0B0B0">Konobar:</span>
                            <span style="color:#FFD700;font-weight:bold">${myWorkday.user}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin:8px 0">
                            <span style="color:#B0B0B0">Početak:</span>
                            <span style="color:#FFF">${startTime.toLocaleString('sr-RS')}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin:8px 0">
                            <span style="color:#B0B0B0">Trajanje:</span>
                            <span style="color:#FFF;font-weight:bold">${hours}h ${mins}min</span>
                        </div>
                    </div>
                    
                    <div style="background:#16213E;padding:20px;border-radius:12px;margin-bottom:20px">
                        <h3 style="color:#E94560;margin-bottom:12px">Finansijski Pregled</h3>
                        <div style="display:flex;justify-content:space-between;margin:8px 0">
                            <span style="color:#B0B0B0">Ukupan prihod:</span>
                            <span style="color:#FFD700;font-size:20px;font-weight:bold">${totalRevenue.toFixed(0)} din.</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin:8px 0">
                            <span style="color:#B0B0B0">💵 Cash:</span>
                            <span style="color:#FFF">${cash.toFixed(0)} din.</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin:8px 0">
                            <span style="color:#B0B0B0">💳 Card:</span>
                            <span style="color:#FFF">${card.toFixed(0)} din.</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin:8px 0;padding-top:8px;border-top:1px solid #2A2A4A">
                            <span style="color:#B0B0B0">Broj narudžbi:</span>
                            <span style="color:#FFF;font-weight:bold">${dayOrders.length}</span>
                        </div>
                    </div>
                    
                    <div style="display:flex;gap:12px">
                        <button class="btn btn-secondary" onclick="page='tables';render()">← Nazad</button>
                        <button class="btn" onclick="closeWorkday()">✅ Zatvori Dan</button>
                    </div>
                </div>
            </div>
        `;
    }
}


// Helper: smena koja nije obavila NIKAKVU pravu cash aktivnost (0 narudžbina,
// 0 prihoda, 0 smanjenja keša). Takvoj smeni je finalCash samo depozit
// propagiran kroz - NIJE pravi snimak keša u kasi, već iznos koji je
// nasleđen pri otvaranju.
//
// PRIMER (bug "16011 din svaki dan"): Anja nasledi 16011, ne radi ništa,
// njena auto-close ima deposit=16011, 0 narudžbina, finalCash=16011. Sledeća
// smena ako uzme Anjinu auto-close → opet 16011, čak iako je Nevena posle
// toga zatvorila smenu sa drugim iznosom. Ovde je passthrough smena uljez
// i mora se preskočiti, bez obzira na vrednost depozita.
function _isNoActivityShift(shift) {
    if (!shift) return true;
    const orderCount = Number(shift.orderCount) || 0;
    const revenue = Number(shift.revenue != null ? shift.revenue : shift.totalRevenue) || 0;
    const cashReductions = Number(shift.totalCashReductions) || 0;
    return orderCount === 0 && revenue === 0 && cashReductions === 0;
}

// Helper: stvarno stanje keša u kasi na kraju datog poslovnog dana.
// Računa istovetno kao "Stanje Kase" na dnevnom izveštaju:
//   = depozit NAJRANIJE smene tog poslovnog dana
//   + sve keš prodaje tog dana (od svih konobara)
//   + svi vraćeni dugovi u kešu tog dana
//   − sva smanjenja keša (od svih konobara) tog dana
//
// Zašto ovo treba umesto shift.finalCash:
// Kada VIŠE konobara radi u jednom danu i SVI dobiju isti početni depozit
// (npr. Stefan i Nevena oba 16011), njihov individualni finalCash =
// deposit + njihov_keš − njihova_smanjenja. To DUPLIRA depozit u svakoj
// individualnoj smeni, ne odražava stvarnu kasu. Realna kasa = jedan
// početni depozit + zbir keš efekata kroz CEO dan, što je ova funkcija.
function _computeBusinessDayRegisterCash(referenceDateStr) {
    if (!referenceDateStr) return null;
    const refDate = new Date(referenceDateStr);
    if (isNaN(refDate.getTime())) return null;
    const cutoff = typeof DAILY_CUTOFF_HOUR !== 'undefined' ? DAILY_CUTOFF_HOUR : 7;

    // Granice poslovnog dana koji obuhvata referenceDate
    const bdStart = new Date(refDate);
    bdStart.setHours(cutoff, 0, 0, 0);
    if (refDate < bdStart) bdStart.setDate(bdStart.getDate() - 1);
    const bdEnd = new Date(bdStart);
    bdEnd.setDate(bdEnd.getDate() + 1);
    const bdStartISO = bdStart.toISOString();
    const bdEndISO = bdEnd.toISOString();

    function isKuvarRow(s) {
        if (!s) return false;
        if (s.role === 'kuvar') return true;
        const u = (DB.users || []).find(x => x.username === s.user);
        return !!(u && u.role === 'kuvar');
    }

    // Zatvorene smene u tom poslovnom danu (ne-kuvarske)
    const closedShifts = (DB.workdayHistory || []).filter(s =>
        s && s.loginTime && s.loginTime >= bdStartISO && s.loginTime < bdEndISO && !isKuvarRow(s)
    );

    // Aktivne smene u tom poslovnom danu (ne-kuvarske)
    const activeShifts = Object.entries(DB.workdays || {})
        .filter(([user, wd]) => wd && wd.startTime && wd.startTime >= bdStartISO && wd.startTime < bdEndISO)
        .map(([user, wd]) => Object.assign({ user, loginTime: wd.startTime }, wd))
        .filter(s => !isKuvarRow(s));

    const allShifts = [].concat(closedShifts, activeShifts);
    if (allShifts.length === 0) return null;

    // Najranija smena = početak lanca - njen depozit je starting cash
    allShifts.sort((a, b) => (a.loginTime || '').localeCompare(b.loginTime || ''));
    const firstShift = allShifts[0];
    const firstDeposit = Number(firstShift.deposit) || 0;

    // Sve narudžbine tog poslovnog dana (svi konobari)
    const dayOrders = (DB.orders || []).filter(o =>
        o && o.time && o.time >= bdStartISO && o.time < bdEndISO
    );
    const cashSales = dayOrders.filter(o => !o.isDebtPayment && o.method === 'Cash')
        .reduce((s, o) => s + (o.tot || 0), 0);
    const debtCash = dayOrders.filter(o => o.isDebtPayment && o.method === 'Cash')
        .reduce((s, o) => s + (o.tot || 0), 0);

    // Sva smanjenja keša svih smena tog dana
    let totalReductions = 0;
    closedShifts.forEach(s => {
        totalReductions += Number(s.totalCashReductions) || 0;
    });
    activeShifts.forEach(s => {
        (s.cashReductions || []).forEach(r => { totalReductions += Number(r.amount) || 0; });
    });

    const registerCash = firstDeposit + cashSales + debtCash - totalReductions;
    return {
        registerCash,
        firstDeposit,
        cashSales,
        debtCash,
        totalReductions,
        firstShiftUser: firstShift.user,
        shiftsCount: allShifts.length,
        businessDayStart: bdStartISO,
        businessDayEnd: bdEndISO
    };
}

// Helper: najskorija ZATVORENA smena konobara sa validnim finalCash.
// Preskače: kuvare, orphan prazne smene, smene bez validnog finalCash polja.
// Vraća null ako ne postoji nijedna validna smena u istoriji.
function _findLastValidClosedShift() {
    if (!DB.workdayHistory || DB.workdayHistory.length === 0) return null;
    const sorted = [...DB.workdayHistory].sort((a, b) =>
        new Date(b.logoutTime) - new Date(a.logoutTime)
    );
    for (const shift of sorted) {
        // Preskoči kuvare - oni ne rukuju kešom u kasi
        const userObj = (DB.users || []).find(u => u.username === shift.user);
        if (userObj && userObj.role === 'kuvar') continue;
        // Preskoči orphan prazne smene (ne predstavljaju pravo rukovanje kešom)
        if (_isNoActivityShift(shift)) {
            console.log('⏭️ Preskačem "praznu" smenu ' + shift.user + ' (' + shift.logoutTime + ') - bez cash aktivnosti');
            continue;
        }
        // Preskoči smene bez validnog finalCash
        if (typeof shift.finalCash !== 'number') continue;
        return shift;
    }
    return null;
}


async function openWorkday() {
    const username = DB.currentUser.username;

    // ✅ Učitaj sveze podatke iz Firebase pre otvaranja smene
    // Ovo sprečava korišćenje zastarelih podataka (npr. stari depozit)
    // kad drugi uređaj upravo zatvori smenu
    try {
        if (typeof database !== 'undefined' && (typeof DEMO_MODE === 'undefined' || !DEMO_MODE)) {
            const snap = await database.ref('/').once('value');
            const serverData = snap.val();
            if (serverData) {
                if (serverData.workdays && typeof serverData.workdays === 'object') {
                    DB.workdays = serverData.workdays;
                }
                if (serverData.workdayHistory && Array.isArray(serverData.workdayHistory)) {
                    DB.workdayHistory = serverData.workdayHistory;
                }
                console.log('🔄 Sveži podaci učitani pre otvaranja smene');
            }
        }
    } catch(e) {
        console.warn('⚠️ Nije uspelo učitavanje svežih podataka:', e.message);
    }

    // ✅ RACE FIX: Čekaj da se ISTEKLE smene auto-zatvore PRE izračunavanja
    // depozita. Inače orphan smena (drugi konobar zaboravio da zatvori) daje
    // pogrešan inheritDeposit iz svog starog .deposit polja umesto stvarnog
    // keša u kasi (depozit + keš prodaje − smanjenja).
    try {
        await checkAndAutoCloseShifts();
    } catch(e) {
        console.warn('⚠️ checkAndAutoCloseShifts greška:', e.message);
    }

    // ====== DIAGNOSTIKA ======
    // Dumpuj sve aktivne smene i poslednjih 10 close-ova u tabelu, sa svim
    // poljima koja se računaju. Tako se odmah u Console-u vidi odakle dolazi
    // svaki pogrešan iznos, bez naslepo pogađanja.
    try {
        console.group('🔍 openWorkday: diagnostika nasleđivanja depozita');
        const activeRows = Object.entries(DB.workdays || {}).map(([user, wd]) => {
            if (!wd) return null;
            const orders = (DB.orders || []).filter(o =>
                o && o.createdBy === user && o.time >= (wd.startTime || '')
            );
            const cash = orders.filter(o => !o.isDebtPayment && o.method === 'Cash')
                .reduce((s, o) => s + (o.tot || 0), 0);
            const debtCash = orders.filter(o => o.isDebtPayment && o.method === 'Cash')
                .reduce((s, o) => s + (o.tot || 0), 0);
            const reductions = (wd.cashReductions || []).reduce((s, r) => s + (r.amount || 0), 0);
            const dep = wd.deposit || 0;
            return {
                user, role: wd.role || '?',
                startTime: wd.startTime,
                deposit: dep,
                orders: orders.length,
                cashSales: cash,
                debtCash, reductions,
                live: dep + cash + debtCash - reductions,
                inheritedFrom: wd.inheritedFrom || ''
            };
        }).filter(Boolean);
        console.log('📋 Aktivne smene (DB.workdays):');
        console.table(activeRows);

        const closedRows = [...(DB.workdayHistory || [])]
            .sort((a, b) => (b.logoutTime || '').localeCompare(a.logoutTime || ''))
            .slice(0, 10)
            .map(s => ({
                user: s.user,
                logoutTime: s.logoutTime,
                deposit: s.deposit || 0,
                orderCount: s.orderCount || 0,
                revenue: s.revenue || 0,
                cashRevenue: s.cashRevenue || 0,
                reductions: s.totalCashReductions || 0,
                finalCash: s.finalCash,
                autoClosed: !!s.autoClosed
            }));
        console.log('📋 Poslednjih 10 zatvorenih smena (workdayHistory):');
        console.table(closedRows);

        // 💸 Sva smanjenja keša za TRENUTNI poslovni dan (odakle se vidi gde je
        // npr. 41000 "Uzeo Dule" — na kojoj smeni/sesiji je upisano, ili NIJE).
        try {
            const _now = new Date();
            const _cut = (typeof DAILY_CUTOFF_HOUR !== 'undefined' ? DAILY_CUTOFF_HOUR : 7);
            const _bdStart = new Date(_now); _bdStart.setHours(_cut, 0, 0, 0);
            if (_now < _bdStart) _bdStart.setDate(_bdStart.getDate() - 1);
            const _bdEnd = new Date(_bdStart); _bdEnd.setDate(_bdEnd.getDate() + 1);
            const _s = _bdStart.toISOString(), _e = _bdEnd.toISOString();
            const redRows = [];
            // iz aktivnih smena
            Object.entries(DB.workdays || {}).forEach(([u, wd]) => {
                if (wd && wd.startTime >= _s && wd.startTime < _e) {
                    (wd.cashReductions || []).forEach(r => redRows.push({
                        smena: u, status: 'aktivna', iznos: r.amount, razlog: r.reason, kad: r.timestamp, upisao: r.createdBy || ''
                    }));
                }
            });
            // iz zatvorenih smena danas
            (DB.workdayHistory || []).forEach(s => {
                if (s && s.loginTime >= _s && s.loginTime < _e) {
                    (s.cashReductions || []).forEach(r => redRows.push({
                        smena: s.user, status: 'zatvorena', iznos: r.amount, razlog: r.reason, kad: r.timestamp, upisao: r.createdBy || ''
                    }));
                }
            });
            const redTotal = redRows.reduce((a, r) => a + (Number(r.iznos) || 0), 0);
            console.log('💸 Smanjenja keša DANAS (ukupno ' + redTotal + ' din):');
            console.table(redRows);
        } catch(e2) { console.warn('⚠️ Reductions dump nije uspeo:', e2); }

        console.groupEnd();
    } catch(e) {
        console.warn('⚠️ Diagnostic dump nije uspeo:', e);
    }

    // Pronađi depozit za nasleđivanje (STANJE ZAJEDNIČKE KASE, ne "po konobaru"):
    //   Kasa je JEDAN fond. Novi depozit = stvarno stanje kase poslovnog dana =
    //   depozit NAJRANIJE smene + sve keš prodaje + svi vraćeni dugovi (keš)
    //   − SVA smanjenja keša tog dana (bez obzira na kojoj su sesiji upisana).
    //   PROVERA A: danas je već neko radio (aktivno ili zatvoreno) → stanje danas.
    //   PROVERA B: danas još niko → kraj poslovnog dana poslednje zatvorene smene.
    //   FALLBACK: ručni unos ako nema istorije.
    let inheritDeposit = null;
    let inheritFrom = '';
    let inheritReason = '';
    let inheritBreakdown = null;

    // Poslednja validna zatvorena smena (koristi se za PROVERU B i sugestiju).
    const lastValidClose = _findLastValidClosedShift();

    // PROVERA A: stanje kase za TRENUTNI poslovni dan.
    // BUG FIX (41000 "Uzeo Dule" smanjenje nije oduzeto kod Stefana):
    // Ranije smo, ako je postojala AKTIVNA smena drugog konobara, nasleđivali
    // iz te JEDNE smene (deposit + njen keš − NJENA smanjenja). Smanjenje keša
    // se upisuje na onu sesiju koja je tada bila ulogovana — pa ako 41000 nije
    // bilo na baš toj jednoj smeni (već na drugoj aktivnoj / admin / Anjinoj
    // zatvorenoj), računica ga je promašila.
    // Sada: uvek sabiramo CEO poslovni dan (sve smene: zatvorene + aktivne).
    // Tako se svako smanjenje uračuna bez obzira na kojoj je sesiji upisano.
    const todayCalc = _computeBusinessDayRegisterCash(new Date().toISOString());
    if (todayCalc && todayCalc.shiftsCount > 0 && typeof todayCalc.registerCash === 'number') {
        inheritDeposit = Math.max(0, todayCalc.registerCash);
        inheritFrom = todayCalc.firstShiftUser || '—';
        inheritReason = 'stanje kase danas (' + todayCalc.shiftsCount + ' smena)';
        inheritBreakdown = 'depozit ' + todayCalc.firstDeposit + ' + keš ' + todayCalc.cashSales +
            ' + dug-keš ' + todayCalc.debtCash + ' − smanjenja ' + todayCalc.totalReductions +
            ' = ' + inheritDeposit + ' din (zajednička kasa, ceo dan)';
        console.log('💰 Nasleđen depozit (STANJE KASE DANAS): ' + inheritBreakdown);
    }

    // PROVERA B: danas još niko nije radio → uzmi stanje kase na kraju
    // poslovnog dana poslednje validne zatvorene smene (npr. juče). Ista
    // formula kao "Stanje Kase" na dnevnom izveštaju (ceo dan, ne pojedinačno).
    if (inheritDeposit === null && lastValidClose) {
        const bdCalc = _computeBusinessDayRegisterCash(lastValidClose.logoutTime);
        if (bdCalc && typeof bdCalc.registerCash === 'number') {
            inheritDeposit = Math.max(0, bdCalc.registerCash);
            inheritFrom = lastValidClose.user;
            inheritReason = 'kraj poslovnog dana ' + new Date(bdCalc.businessDayStart).toLocaleDateString('sr-RS') +
                ' (' + bdCalc.shiftsCount + ' smena)';
            inheritBreakdown = 'depozit ' + bdCalc.firstDeposit + ' + keš ' + bdCalc.cashSales +
                ' + dug-keš ' + bdCalc.debtCash + ' − smanjenja ' + bdCalc.totalReductions +
                ' = ' + inheritDeposit + ' din (zajednička kasa, ceo dan)';
            console.log('💰 Nasleđen depozit (POSLOVNI DAN ' + new Date(bdCalc.businessDayStart).toLocaleDateString('sr-RS') + '): ' + inheritBreakdown);
        } else {
            // Fallback ako računica ne uspe - koristi individualni finalCash
            inheritDeposit = Math.max(0, lastValidClose.finalCash);
            inheritFrom = lastValidClose.user;
            inheritReason = 'individualna zatvorena smena (fallback)';
            inheritBreakdown = 'finalCash = ' + inheritDeposit + ' (zatvoreno ' +
                new Date(lastValidClose.logoutTime).toLocaleString('sr-RS') + ')';
            console.log('💰 Nasleđen depozit iz ZATVORENE smene ' + lastValidClose.user +
                ': ' + inheritBreakdown);
        }
    }

    // ✅ NIJE PRVA SMENA → automatski preuzmi, bez pitanja
    if (inheritDeposit !== null) {
        if (!DB.workdays) DB.workdays = {};

        const workdayData = {
            user: username,
            startTime: new Date().toISOString(),
            startOrders: DB.orders.length,
            deposit: inheritDeposit,
            inheritedFrom: inheritFrom,
            inheritReason: inheritReason,
            inheritBreakdown: inheritBreakdown,
            cashReductions: []
        };

        DB.workdays[username] = workdayData;
        saveWorkday(username, workdayData);
        page = 'tables';
        render();

        // Detaljan modal: prikazuje odakle dolazi depozit i kako je izračunat,
        // sa opcijom "Promeni depozit" ako sistem pogreši. Ne čeka da admin
        // ulazi u DevTools - escape hatch je odmah pri ruci.
        showConfirm('✅ Smena Otvorena!',
            '💰 Depozit: <b style="color:#FFD700">' + inheritDeposit.toLocaleString() + ' din</b><br>' +
            '👤 Preuzeto od: <b>' + inheritFrom + '</b> (' + inheritReason + ')<br>' +
            '📊 <span style="font-size:13px;color:#B0B0B0">' + inheritBreakdown + '</span><br><br>' +
            '<span style="font-size:14px">Da li je iznos tačan?</span><br>' +
            '<span style="font-size:12px;color:#888">Klikni "Ne" da uneseš tačan iznos ručno</span>',
            function(confirmed) {
                if (!confirmed) {
                    promptEditDeposit();
                }
            }
        );
        return;
    }

    // ✅ NEMA PRETHODNE SMENE U ISTORIJI (ili samo prazne) → ručni unos
    const modal = document.getElementById('depositModal');
    const input = document.getElementById('depositInput');
    const hint = document.getElementById('depositHint');

    let suggestedDeposit = 0;
    let lastShiftInfo = '';

    // Pokušaj da nađeš MAKAR neku staru smenu kao sugestiju (koristi isti helper
    // - preskače kuvare i prazne). Pošto je provera 2 već probala, ovde smo samo
    // ako nema validne smene - ali helper vraća null pa sugestija ostaje 0.
    const lastShift = _findLastValidClosedShift();
    if (lastShift) {
        suggestedDeposit = Math.max(0, lastShift.finalCash);
        const logoutDate = new Date(lastShift.logoutTime);
        const timeStr = logoutDate.toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        lastShiftInfo = '💡 Poslednja smena (' + lastShift.user + ', ' + timeStr + ') završila sa <strong style="color:#FFD700">' + suggestedDeposit.toLocaleString() + ' din</strong> keša u kasi';
    }

    input.value = suggestedDeposit > 0 ? suggestedDeposit : '0';

    if (hint) {
        hint.innerHTML = lastShiftInfo || '💡 Možete uneti 0 ako nemate depozit';
    }

    modal.classList.add('show');
    input.focus();
    input.select();
}


function closeDepositModal() {
    document.getElementById('depositModal').classList.remove('show');
}


// Ručna izmena depozita trenutne otvorene smene. Koristi se kao escape hatch
// kada auto-nasleđivanje povuče pogrešan iznos (npr. duplo brojanje preko
// stalih aktivnih smena, ili konobar zna tačan keš iz fizičkog prebrojavanja).
function promptEditDeposit() {
    const username = DB.currentUser && DB.currentUser.username;
    if (!username) return;
    const myWd = DB.workdays && DB.workdays[username];
    if (!myWd) {
        showAlert('Nemaš otvorenu smenu.');
        return;
    }
    const current = Number(myWd.deposit) || 0;
    const input = window.prompt(
        'Unesi tačan iznos depozita (din.):\n\n' +
        'Trenutno: ' + current.toLocaleString() + ' din\n' +
        '(Preuzeto od: ' + (myWd.inheritedFrom || '?') + ')',
        String(current)
    );
    if (input === null) return; // odustao
    const newVal = parseFloat(String(input).replace(',', '.'));
    if (isNaN(newVal) || newVal < 0) {
        showAlert('⚠️ Neispravan iznos. Probaj ponovo.');
        return;
    }
    if (newVal === current) {
        showAlert('ℹ️ Iznos je isti, nije promenjen.');
        return;
    }
    const prev = current;
    myWd.deposit = newVal;
    myWd.inheritedFrom = (myWd.inheritedFrom || 'auto') + ' → ručno (' + (DB.currentUser.username) + ')';
    myWd.inheritReason = 'ručna izmena';
    myWd.inheritBreakdown = 'Ručno postavljen: ' + newVal.toLocaleString() + ' din (prethodno ' + prev.toLocaleString() + ')';
    DB.workdays[username] = myWd;
    if (typeof saveWorkday === 'function') saveWorkday(username, myWd);
    else save();
    showAlert('✅ Depozit promenjen na ' + newVal.toLocaleString() + ' din.');
}
if (typeof window !== 'undefined') window.promptEditDeposit = promptEditDeposit;


function confirmDeposit() {
    const depositAmount = parseFloat(document.getElementById('depositInput').value) || 0;
    
    if (depositAmount < 0) {
        showAlert('Depozit ne može biti negativan');
        return;
    }
    
    const username = DB.currentUser.username;
    
    // Inicijalizuj workdays ako ne postoji
    if (!DB.workdays) DB.workdays = {};
    
    // Kreiraj workday sa depozitom
    const workdayData = {
        user: username,
        startTime: new Date().toISOString(),
        startOrders: DB.orders.length,
        deposit: depositAmount,
        cashReductions: [] // Inicijalizuj niz za smanjenja keša
    };
    
    // ✅ ATOMIČKI SAVE - piše SAMO na /workdays/{username}
    // Ne može da prepiše tuđe workday-ove
    DB.workdays[username] = workdayData;
    saveWorkday(username, workdayData);
    closeDepositModal();
    page = 'tables';
    render();
    
    if (depositAmount > 0) {
        showAlert(`✅ Radni dan otvoren sa depozitom: ${depositAmount.toFixed(0)} din.`);
    } else {
        showAlert(`✅ Radni dan otvoren bez depozita`);
    }
}


// SMANJENJE KEŠA
function openCashReductionModal() {
    const username = DB.currentUser.username;
    const myWorkday = DB.workdays && DB.workdays[username];

    if (!myWorkday) {
        showAlert('Niste otvorili radni dan!');
        return;
    }

    const modal = document.getElementById('cashReductionModal');
    document.getElementById('cashReductionAmount').value = '';
    document.getElementById('cashReductionReason').value = '';
    document.getElementById('cashReductionType').value = '';
    var wrap = document.getElementById('cashReductionReasonWrap');
    if (wrap) wrap.style.display = 'none';
    modal.classList.add('show');
    document.getElementById('cashReductionAmount').focus();
}

function onCashReductionTypeChange() {
    var type = document.getElementById('cashReductionType').value;
    var wrap = document.getElementById('cashReductionReasonWrap');
    var reasonInput = document.getElementById('cashReductionReason');
    if (type === 'nabavka' || type === 'ostalo') {
        wrap.style.display = 'block';
        reasonInput.value = '';
        reasonInput.focus();
    } else if (type === 'dule') {
        wrap.style.display = 'none';
        reasonInput.value = 'Uzeo Dule';
    } else if (type === 'mara') {
        wrap.style.display = 'none';
        reasonInput.value = 'Uzela Mara';
    } else {
        wrap.style.display = 'none';
        reasonInput.value = '';
    }
}


function closeCashReductionModal() {
    document.getElementById('cashReductionModal').classList.remove('show');
}


function confirmCashReduction() {
    const amount = parseFloat(document.getElementById('cashReductionAmount').value) || 0;
    const type = document.getElementById('cashReductionType').value;
    var reason = document.getElementById('cashReductionReason').value.trim();

    // Validacija
    if (amount <= 0) {
        showAlert('Iznos mora biti veći od 0');
        return;
    }

    if (!type) {
        showAlert('Izaberite razlog!');
        return;
    }

    // Za nabavku/ostalo mora komentar
    if ((type === 'nabavka' || type === 'ostalo') && !reason) {
        showAlert('Morate uneti komentar!');
        return;
    }

    // Složi finalni razlog
    if (type === 'nabavka') {
        reason = 'Nabavka: ' + reason;
    } else if (type === 'dule') {
        reason = 'Uzeo Dule';
    } else if (type === 'mara') {
        reason = 'Uzela Mara';
    }
    
    const username = DB.currentUser.username;
    const myWorkday = DB.workdays && DB.workdays[username];
    
    if (!myWorkday) {
        showAlert('Niste otvorili radni dan!');
        return;
    }
    
    // Inicijalizuj cashReductions ako ne postoji
    if (!myWorkday.cashReductions) {
        myWorkday.cashReductions = [];
    }
    
    // Dodaj smanjenje
    myWorkday.cashReductions.push({
        amount: amount,
        reason: reason,
        timestamp: new Date().toISOString(),
        createdBy: username
    });
    
    // ✅ ATOMIČKI UPDATE - ažurira SAMO /workdays/{username}/cashReductions
    updateWorkday(username, { cashReductions: myWorkday.cashReductions });
    closeCashReductionModal();
    render();
    
    showAlert(`✅ Keš smanjen za ${amount.toFixed(0)} din.`);
}


async function closeWorkday() {
    // 🔒 ZAŠTITA OD DUPLOG KLIKA - sprečava 6× zatvaranje smene ako je program zaboravio da reaguje
    if (window._closingShiftInProgress) {
        console.warn('⚠️ closeWorkday već u toku - ignorišem dupli klik');
        return;
    }
    window._closingShiftInProgress = true;

    // Disable dugme odmah da se ne može više kliknuti
    try {
        var btn = document.getElementById('closeDayBtn');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
        document.querySelectorAll('button[onclick*="closeWorkday"]').forEach(function(b) {
            b.disabled = true; b.style.opacity = '0.5'; b.style.pointerEvents = 'none';
        });
    } catch(e) {}

    try {
        await _doCloseWorkday();
    } catch(e) {
        console.error('❌ closeWorkday greška:', e);
        showAlert('❌ Greška pri zatvaranju smene: ' + (e.message || e));
    } finally {
        // Oslobodi lock tek nakon 5 sekundi (za slučaj da render nije završio)
        setTimeout(function() { window._closingShiftInProgress = false; }, 5000);
    }
}

async function _doCloseWorkday() {
    const username = DB.currentUser.username;
    const myWorkday = DB.workdays ? DB.workdays[username] : null;

    if (!myWorkday) {
        showAlert('❌ Greška: Nema aktivnog radnog dana!');
        return;
    }

    // ⛔ Provera: Da li konobar ima nenaplaćene stavke na stolovima?
    const openTables = (DB.tables || []).filter(t => {
        if (!t.order || !Array.isArray(t.order)) return false;
        return t.order.some(item => item.createdBy === username);
    });
    if (openTables.length > 0) {
        const tableNames = openTables.map(t => t.name || ('Sto ' + t.num)).join(', ');
        showAlert('❌ Ne možeš zatvoriti smenu!\n\nImaš nenaplaćene narudžbine na:\n' + tableNames + '\n\nNaplati ili obriši stavke pa probaj ponovo.');
        return;
    }

    // Filtriraj samo narudžbine ovog konobara od početka njegovog dana
    const dayOrders = DB.orders.filter(o => 
        o.time >= myWorkday.startTime && 
        o.createdBy === username
    );
    
    // Pravi promet - BEZ vraćenih dugova (dugovi nisu otkucani promet)
    const realOrders = dayOrders.filter(o => !o.isDebtPayment);
    const totalRevenue = realOrders.reduce((s,o)=>s+o.tot,0);
    const cash = realOrders.filter(o=>o.method==='Cash').reduce((s,o)=>s+o.tot,0);
    const card = realOrders.filter(o=>o.method==='Card').reduce((s,o)=>s+o.tot,0);
    const wire = realOrders.filter(o=>o.method==='Wire').reduce((s,o)=>s+o.tot,0);
    
    // Vraćeni dugovi - odvojeno (novac je u kasi ali nije promet)
    const debtOrders = dayOrders.filter(o => o.isDebtPayment);
    const debtCash = debtOrders.filter(o => o.method === 'Cash').reduce((s,o) => s + o.tot, 0);
    
    // SMANJENJA KEŠA - oduzmi od keša
    const cashReductions = myWorkday.cashReductions || [];
    const totalCashReductions = cashReductions.reduce((sum, r) => sum + r.amount, 0);
    
    // DEPOZIT - dodaj na ukupan učinak
    const deposit = myWorkday.deposit || 0;
    const finalCash = deposit + cash + debtCash - totalCashReductions; // Keš u kasi: depozit + keš + vraćeni dugovi keš - smanjenja
    const totalPerformance = totalRevenue + deposit; // Ukupan učinak = otkucano + depozit (bez dugova)
    
    const endTime = new Date().toISOString();
    const startTime = new Date(myWorkday.startTime);
    const duration = Math.floor((new Date(endTime) - startTime) / 1000 / 60); // minutes
    
    // RAČUNANJE PLATE - Koristi satnicu konobara
    const waiterUser = DB.users.find(u => u.username === username);
    const hourlyRate = waiterUser?.hourlyRate || 350; // Default 350 ako nije postavljena
    const hours = duration / 60; // sati (sa decimalama)
    const salary = Math.floor(hours * hourlyRate); // plata (zaokruženo)
    
    const finalReport = {
        user: myWorkday.user,
        startTime: myWorkday.startTime,
        endTime: endTime,
        orders: dayOrders,
        totalRevenue: totalRevenue,
        deposit: deposit,
        totalPerformance: totalPerformance,
        cashRevenue: cash,
        cashReductions: cashReductions,
        totalCashReductions: totalCashReductions,
        finalCash: finalCash,
        cardRevenue: card,
        wireRevenue: wire,
        orderCount: realOrders.length,
        duration: duration,
        salary: salary,
        hourlyRate: hourlyRate
    };
    
    localStorage.setItem('lastWorkdayReport', JSON.stringify(finalReport));
    
    // Inicijalizuj workdayHistory ako ne postoji
    if (!DB.workdayHistory) {
        DB.workdayHistory = [];
        console.log('⚠️ workdayHistory nije postojao, inicijalizovan!');
    }
    
    // BONUS SISTEM - Nova Pravila
    const startDate = new Date(myWorkday.startTime);
    const endDate = new Date(endTime);
    const startHour = startDate.getHours();
    const endHour = endDate.getHours();
    const dayOfWeek = startDate.getDay(); // 0 = nedelja (pazar)
    const isSunday = dayOfWeek === 0;
    
    // Prva smena: 8 AM - 4 PM (16h)
    const isFirstShift = startHour >= 8 && startHour < 14 && endHour >= 15 && endHour <= 17;
    
    // Druga smena: počinje 14-20h, završava 22h-7h sledećeg dana
    const isSecondShift = startHour >= 14 && startHour < 20 && (endHour >= 22 || endHour < 7);
    
    let bonusEarned = false;
    let bonusAmount = 0;
    let bonusReason = '';

    // Bonusi se čitaju iz postavki (admin može da menja u Postavke → Bonusi)
    const bonusCfg = getBonusSettings();

    // PRVA SMENA: dve tier-a (manji prag → manji bonus, veći prag → veći bonus)
    if (isFirstShift) {
        if (totalRevenue >= bonusCfg.firstShiftTier2Threshold) {
            bonusEarned = true;
            bonusAmount = bonusCfg.firstShiftTier2Amount;
            bonusReason = 'Prva smena - prihod ≥ ' + bonusCfg.firstShiftTier2Threshold.toLocaleString() + ' din.';
        } else if (totalRevenue >= bonusCfg.firstShiftTier1Threshold) {
            bonusEarned = true;
            bonusAmount = bonusCfg.firstShiftTier1Amount;
            bonusReason = 'Prva smena - prihod ≥ ' + bonusCfg.firstShiftTier1Threshold.toLocaleString() + ' din.';
        }
    }

    // DRUGA SMENA (SVAKI DAN):
    if (isSecondShift) {
        if (totalRevenue >= bonusCfg.secondShiftTier2Threshold) {
            bonusEarned = true;
            bonusAmount = bonusCfg.secondShiftTier2Amount;
            bonusReason = 'Druga smena - prihod ≥ ' + bonusCfg.secondShiftTier2Threshold.toLocaleString() + ' din.';
        } else if (totalRevenue >= bonusCfg.secondShiftTier1Threshold) {
            bonusEarned = true;
            bonusAmount = bonusCfg.secondShiftTier1Amount;
            bonusReason = 'Druga smena - prihod ≥ ' + bonusCfg.secondShiftTier1Threshold.toLocaleString() + ' din.';
        }
    }
    
    if (bonusEarned) {
        console.log(`🎁 BONUS OSTVAREN! ${myWorkday.user}: ${bonusAmount} din (${bonusReason})`);
    }
    
    // Dodaj bonus u finalReport za email
    finalReport.bonusEarned = bonusEarned;
    finalReport.bonusAmount = bonusAmount;
    finalReport.bonusReason = bonusReason;
    
    console.log(`💰 PLATA: ${myWorkday.user}: ${salary} din (${(duration/60).toFixed(2)} sati × ${hourlyRate} din/sat)`);
    
    if (deposit > 0) {
        console.log(`💵 DEPOZIT: ${myWorkday.user}: ${deposit} din`);
        console.log(`📊 UKUPAN UČINAK: ${myWorkday.user}: ${totalPerformance} din (${totalRevenue} otkucano + ${deposit} depozit)`);
    }
    
    // Dodaj u istoriju sesija
    DB.workdayHistory.push({
        user: myWorkday.user,
        loginTime: myWorkday.startTime,
        logoutTime: endTime,
        duration: duration,
        orderCount: realOrders.length,
        revenue: totalRevenue,
        cashRevenue: cash,
        cardRevenue: card,
        wireRevenue: wire,
        deposit: deposit,
        totalPerformance: totalPerformance,
        cashReductions: cashReductions,
        totalCashReductions: totalCashReductions,
        finalCash: finalCash,
        salary: salary,
        hourlyRate: hourlyRate,
        bonusEarned: bonusEarned,
        bonusAmount: bonusAmount,
        bonusReason: bonusReason,
        isFirstShift: isFirstShift,
        isSecondShift: isSecondShift,
        inheritedFrom: myWorkday.inheritedFrom || null
    });
    
    console.log('✅ Sesija dodata u workdayHistory:', DB.workdayHistory.length, 'sesija ukupno');

    // ✅ KRITIČNO: Sačuvaj workdayHistory ATOMIČKI pre brisanja workday-a
    // Ovo sprečava race condition gde drugi uređaj vidi da je workday obrisan
    // ali workdayHistory još nije ažuriran (pa nasledi pogrešan depozit)
    try {
        await pushWorkdayHistory();
    } catch(e) {
        console.error('⚠️ pushWorkdayHistory greška, nastavljam:', e);
    }

    // Resetuj samo stavke ovog konobara sa stolova
    // ALI NE BRIŠEMO NARUDŽBINE - one ostaju u bazi zauvek!
    DB.tables.forEach(table => {
        if (table.order && table.order.length > 0) {
            const lenBefore = table.order.length;
            // Filtriraj samo stavke drugih konobara (zadrži ih)
            table.order = table.order.filter(item => item.createdBy && item.createdBy !== username);

            // Ako je sto prazan nakon filtriranja, resetuj discount
            if (table.order.length === 0) {
                table.discount = 0;
                table.discountPercent = 0;
                table.discountedItems = [];
            }

            // ✅ RACE FIX: obeleži sto kao dirty samo ako se nešto stvarno
            // izmenilo, da pre-save merge ne vrati očišćene stavke
            if (table.order.length !== lenBefore &&
                typeof markTableDirty === 'function') {
                markTableDirty(table.num);
            }
        }
    });

    // Obriši SAMO workday ovog konobara - TEK NAKON što je history sačuvan
    // ✅ ATOMIČKI DELETE - briše SAMO /workdays/{username}
    await removeWorkday(username);
    console.log('✅ Workday zatvoren za:', username);
    save();
    
    // 📧 Pošalji izveštaj na email (čekaj da se pošalje pre renderovanja)
    if (typeof sendShiftReportEmail === 'function') {
        try {
            await sendShiftReportEmail(finalReport);
        } catch(e) {
            console.error('📧 Email greška:', e);
        }
    }
    
    page = 'finalreport';
    render();
}


// ============================================
// AUTO-PRESEK U 7:00 UJUTRU
// Radni dan traje od 7:00 do 7:00 sledećeg dana.
// Smena od 16h 6/3 do 01h 7/3 = pripada danu 6/3.
// U 7:00 sistem zatvara sve otvorene smene.
// ============================================

const DAILY_CUTOFF_HOUR = 7; // 7:00 ujutru

// Vraća početak trenutnog "radnog dana" (danas u 7:00, ili juče u 7:00 ako je pre 7)
function getBusinessDayStart() {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(DAILY_CUTOFF_HOUR, 0, 0, 0);
    
    if (now < cutoff) {
        // Pre 7 ujutru = još uvek "jučerašnji" radni dan
        cutoff.setDate(cutoff.getDate() - 1);
    }
    return cutoff;
}

async function checkAndAutoCloseShifts() {
    if (!DB.workdays) return;

    const now = new Date();
    const todayCutoff = new Date(now);
    todayCutoff.setHours(DAILY_CUTOFF_HOUR, 0, 0, 0);

    // Ako je pre 7:00, cutoff je juče u 7:00
    if (now < todayCutoff) {
        todayCutoff.setDate(todayCutoff.getDate() - 1);
    }

    const expiredShifts = Object.entries(DB.workdays).filter(([username, wd]) => {
        if (!wd || !wd.startTime) return false;
        // ✋ Kuvari sami zatvaraju svoju smenu — ne diraj ih auto-close-om
        if (wd.role === 'kuvar') return false;
        const userObj = (DB.users || []).find(u => u.username === username);
        if (userObj && userObj.role === 'kuvar') return false;
        const shiftStart = new Date(wd.startTime);
        // Smena je istekla ako je počela PRE današnjeg cutoff-a (7:00)
        return shiftStart < todayCutoff;
    });

    if (expiredShifts.length === 0) return;

    console.log('⏰ Presek u 7:00 - zatvaranje ' + expiredShifts.length + ' smena od prethodnog dana');

    // ✅ RACE FIX: Čekaj da se SVE auto-close operacije završe pre nego što
    // caller (openWorkday) počne da računa depozit. Inače orphan workday sa
    // pogrešnim .deposit-om može da propagira u novu smenu.
    await Promise.all(expiredShifts.map(([username, myWorkday]) =>
        Promise.resolve(autoCloseWorkday(username, myWorkday)).catch(err => {
            console.error('⚠️ autoCloseWorkday greška za ' + username + ':', err);
        })
    ));
}


async function autoCloseWorkday(username, myWorkday) {
    console.log('⏰ Auto-zatvaranje smene za: ' + username);
    
    const startTime = new Date(myWorkday.startTime);
    
    // Kraj smene = sledeći cutoff posle početka (7:00 ujutru sledećeg dana)
    const endTime = new Date(startTime);
    endTime.setDate(endTime.getDate() + 1);
    endTime.setHours(DAILY_CUTOFF_HOUR, 0, 0, 0);
    // Ako je smena počela posle cutoff-a istog dana, kraj je sutradan u 7:00
    // Ako je počela pre cutoff-a, kraj je danas u 7:00
    const sameDayCutoff = new Date(startTime);
    sameDayCutoff.setHours(DAILY_CUTOFF_HOUR, 0, 0, 0);
    if (startTime < sameDayCutoff) {
        endTime.setTime(sameDayCutoff.getTime());
    }
    
    const endTimeISO = endTime.toISOString();
    const durationMin = Math.floor((endTime - startTime) / 1000 / 60);
    
    // Filtriraj narudžbine: samo one između početka smene i cutoff-a
    const dayOrders = DB.orders.filter(o => 
        o.time >= myWorkday.startTime && 
        o.time <= endTimeISO &&
        o.createdBy === username
    );
    const realOrders = dayOrders.filter(o => !o.isDebtPayment);
    const totalRevenue = realOrders.reduce((s, o) => s + o.tot, 0);
    const cash = realOrders.filter(o => o.method === 'Cash').reduce((s, o) => s + o.tot, 0);
    const card = realOrders.filter(o => o.method === 'Card').reduce((s, o) => s + o.tot, 0);
    const wire = realOrders.filter(o => o.method === 'Wire').reduce((s, o) => s + o.tot, 0);
    const debtCash = dayOrders.filter(o => o.isDebtPayment && o.method === 'Cash').reduce((s, o) => s + o.tot, 0);
    
    const cashReductions = myWorkday.cashReductions || [];
    const totalCashReductions = cashReductions.reduce((sum, r) => sum + r.amount, 0);
    
    const deposit = myWorkday.deposit || 0;
    const finalCash = deposit + cash + debtCash - totalCashReductions;
    const totalPerformance = totalRevenue + deposit;
    
    // Plata
    const waiterUser = DB.users.find(u => u.username === username);
    const hourlyRate = waiterUser?.hourlyRate || 350;
    const hours = durationMin / 60;
    const salary = Math.floor(hours * hourlyRate);
    
    // Bonus
    const startHour = startTime.getHours();
    const endHour = endTime.getHours();
    
    const isFirstShift = startHour >= 8 && startHour < 14;
    const isSecondShift = startHour >= 14 && startHour < 22;

    let bonusEarned = false;
    let bonusAmount = 0;
    let bonusReason = '';

    // Bonusi iz postavki (admin može da menja u Postavke → Bonusi)
    const bonusCfg = getBonusSettings();

    if (isFirstShift) {
        if (totalRevenue >= bonusCfg.firstShiftTier2Threshold) {
            bonusEarned = true;
            bonusAmount = bonusCfg.firstShiftTier2Amount;
            bonusReason = 'Prva smena - prihod ≥ ' + bonusCfg.firstShiftTier2Threshold.toLocaleString() + ' din.';
        } else if (totalRevenue >= bonusCfg.firstShiftTier1Threshold) {
            bonusEarned = true;
            bonusAmount = bonusCfg.firstShiftTier1Amount;
            bonusReason = 'Prva smena - prihod ≥ ' + bonusCfg.firstShiftTier1Threshold.toLocaleString() + ' din.';
        }
    }
    if (isSecondShift) {
        if (totalRevenue >= bonusCfg.secondShiftTier2Threshold) {
            bonusEarned = true;
            bonusAmount = bonusCfg.secondShiftTier2Amount;
            bonusReason = 'Druga smena - prihod ≥ ' + bonusCfg.secondShiftTier2Threshold.toLocaleString() + ' din.';
        } else if (totalRevenue >= bonusCfg.secondShiftTier1Threshold) {
            bonusEarned = true;
            bonusAmount = bonusCfg.secondShiftTier1Amount;
            bonusReason = 'Druga smena - prihod ≥ ' + bonusCfg.secondShiftTier1Threshold.toLocaleString() + ' din.';
        }
    }
    
    // Istorija
    if (!DB.workdayHistory) DB.workdayHistory = [];
    
    DB.workdayHistory.push({
        user: myWorkday.user || username,
        loginTime: myWorkday.startTime,
        logoutTime: endTimeISO,
        duration: durationMin,
        orderCount: realOrders.length,
        revenue: totalRevenue,
        cashRevenue: cash,
        cardRevenue: card,
        wireRevenue: wire,
        deposit: deposit,
        totalPerformance: totalPerformance,
        cashReductions: cashReductions,
        totalCashReductions: totalCashReductions,
        finalCash: finalCash,
        salary: salary,
        hourlyRate: hourlyRate,
        bonusEarned: bonusEarned,
        bonusAmount: bonusAmount,
        bonusReason: bonusReason,
        isFirstShift: isFirstShift,
        isSecondShift: isSecondShift,
        autoClosed: true,
        inheritedFrom: myWorkday.inheritedFrom || null
    });
    
    // ✅ KRITIČNO: Sačuvaj workdayHistory ATOMIČKI pre brisanja workday-a
    try {
        await pushWorkdayHistory();
    } catch(e) {
        console.error('⚠️ pushWorkdayHistory greška u auto-close:', e);
    }

    // Očisti stavke sa stolova
    DB.tables.forEach(table => {
        if (table.order && table.order.length > 0) {
            const lenBefore = table.order.length;
            table.order = table.order.filter(item => item.createdBy && item.createdBy !== username);
            if (table.order.length === 0) {
                table.discount = 0;
                table.discountPercent = 0;
                table.discountedItems = [];
            }
            // ✅ RACE FIX: auto-presek radi u pozadini paralelno sa radom —
            // bez markTableDirty pre-save merge vraća već očišćene stavke
            if (table.order.length !== lenBefore &&
                typeof markTableDirty === 'function') {
                markTableDirty(table.num);
            }
        }
    });

    // Obriši workday - TEK NAKON što je history sačuvan
    await removeWorkday(username);
    save();

    console.log('⏰ Auto-zatvorena smena: ' + username + ' | ' + startTime.toLocaleString('sr-RS') + ' → ' + endTime.toLocaleString('sr-RS') + ' | Prihod: ' + totalRevenue);
}


// ============================================
// PODSETNIK ZA ZATVARANJE SMENE
// ============================================
let shiftReminderShown = {};
let adminNotificationSent = {};

function checkShiftReminders() {
    if (!DB.currentUser) return;
    if (!DB.workdays) return;
    
    var now = new Date();
    var username = DB.currentUser.username;
    var role = DB.currentUser.role;
    
    // Za konobara: proveri NJEGOVU smenu
    if (role !== 'admin') {
        var myWd = DB.workdays[username];
        if (!myWd || !myWd.startTime) return;
        if (myWd.role === 'kuvar') return;
        
        var shiftStart = new Date(myWd.startTime);
        var hoursWorked = (now - shiftStart) / 1000 / 3600;
        var startHour = shiftStart.getHours();
        
        // Odredi očekivan kraj smene
        var expectedEnd;
        if (startHour >= 8 && startHour < 14) {
            // Prva smena → kraj oko 16:00
            expectedEnd = new Date(shiftStart);
            expectedEnd.setHours(16, 0, 0, 0);
        } else if (startHour >= 14 && startHour < 22) {
            // Druga smena → kraj oko 23:00
            expectedEnd = new Date(shiftStart);
            expectedEnd.setHours(23, 0, 0, 0);
        } else {
            // Noćna → podseti posle 8h
            expectedEnd = new Date(shiftStart.getTime() + 8 * 3600000);
        }
        
        // Podseti 30min pre kraja
        var reminderTime = new Date(expectedEnd.getTime() - 30 * 60000);
        var reminderId = username + '_' + shiftStart.toISOString().substring(0, 10);
        
        if (now >= reminderTime && !shiftReminderShown[reminderId]) {
            shiftReminderShown[reminderId] = true;
            var minsLeft = Math.max(0, Math.round((expectedEnd - now) / 60000));
            showAlert('⏰ Podsetnik!\n\nVaša smena traje već ' + Math.floor(hoursWorked) + 'h ' + Math.round((hoursWorked % 1) * 60) + 'min.\n' +
                (minsLeft > 0 ? 'Očekivani kraj za ' + minsLeft + ' min.\n\n' : 'Smena je trebalo da se završi.\n\n') +
                'Ne zaboravite da zatvorite radni dan!\nIzveštaj → Zatvori Dan');
            console.log('⏰ Podsetnik za zatvaranje smene: ' + username);
        }
        return;
    }
    
    // Za admina: proveri SVE otvorene smene
    var openShifts = Object.entries(DB.workdays).filter(function(entry) {
        var wd = entry[1];
        if (!wd || !wd.startTime) return false;
        if (wd.role === 'kuvar') return false;
        
        var start = new Date(wd.startTime);
        var hours = (now - start) / 1000 / 3600;
        return hours > 9; // Smena traje više od 9h
    });
    
    if (openShifts.length > 0) {
        openShifts.forEach(function(entry) {
            var user = entry[0];
            var wd = entry[1];
            var start = new Date(wd.startTime);
            var hours = Math.floor((now - start) / 1000 / 3600);
            var notifId = user + '_' + start.toISOString().substring(0, 10);
            
            if (!adminNotificationSent[notifId]) {
                adminNotificationSent[notifId] = true;
                showAlert('⚠️ Otvorena smena!\n\n' + user + ' ima smenu otvorenu ' + hours + 'h!\nPočetak: ' + start.toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'}) + '\n\nMožete je zatvoriti u: Osoblje → 🔒 Zatvori Smenu');
                console.log('⚠️ Admin notifikacija: ' + user + ' ima otvorenu smenu ' + hours + 'h');
                
                // Pošalji email adminu ako je podešeno
                if (typeof sendShiftReportEmail === 'function' && DB.settings && DB.settings.reportEmails) {
                    sendOpenShiftNotification(user, wd, hours);
                }
            }
        });
    }
}

async function sendOpenShiftNotification(username, workday, hours) {
    var settings = DB.settings || {};
    var serviceId = settings.emailjsServiceId || '';
    var templateId = settings.emailjsTemplateId || '';
    var publicKey = settings.emailjsPublicKey || '';
    var recipients = settings.reportEmails || '';
    
    if (!serviceId || !templateId || !publicKey || !recipients) return;
    
    if (typeof emailjs === 'undefined') return;
    emailjs.init(publicKey);
    
    var startTime = new Date(workday.startTime);
    var restName = settings.name || 'Restaurant POS';
    
    var emailList = recipients.split(',').map(function(e) { return e.trim(); }).filter(function(e) { return e.includes('@'); });
    
    for (var i = 0; i < emailList.length; i++) {
        try {
            await emailjs.send(serviceId, templateId, {
                to_email: emailList[i],
                waiter_name: username,
                date: new Date().toLocaleDateString('sr-RS'),
                restaurant_name: restName,
                report_text: '⚠️ UPOZORENJE: NEZATVORENA SMENA\n\n' +
                    'Konobar: ' + username + '\n' +
                    'Početak smene: ' + startTime.toLocaleString('sr-RS') + '\n' +
                    'Trajanje: ' + hours + ' sati\n\n' +
                    'Ova smena nije zatvorena! Ulogujte se kao admin i zatvorite je ručno.\n' +
                    'Osoblje → 🔒 Zatvori Smenu za ' + username,
                total_revenue: '0',
                cash: '0',
                card: '0',
                order_count: '0',
                final_cash: '0',
                salary: '0'
            });
            console.log('📧 Notifikacija o otvorenoj smeni poslata na: ' + emailList[i]);
        } catch (err) {
            console.error('📧 Greška pri slanju notifikacije:', err);
        }
    }
}


// Pokreni proveru svakih 5 min
var shiftReminderInterval = null;
function startShiftReminders() {
    if (shiftReminderInterval) clearInterval(shiftReminderInterval);
    shiftReminderInterval = setInterval(checkShiftReminders, 5 * 60 * 1000);
    // Prva provera posle 1min (da se app učita)
    setTimeout(checkShiftReminders, 60000);
}

