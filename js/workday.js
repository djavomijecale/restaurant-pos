// ============================================
// WORKDAY MANAGEMENT
// ============================================


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


function openWorkday() {
    const username = DB.currentUser.username;
    const businessDayStart = getBusinessDayStart();
    
    // Pronađi depozit za nasleđivanje:
    // 1. Ako neko TRENUTNO radi → preuzmi njegov depozit
    // 2. Ako je neko ZATVORIO smenu danas → preuzmi finalCash
    let inheritDeposit = null;
    let inheritFrom = '';
    
    // Provera 1: Aktivna smena KONOBARA (ne kuvara!)
    const otherActive = Object.entries(DB.workdays || {})
        .find(([user, wd]) => {
            if (user === username) return false;
            if (!wd || !wd.startTime) return false;
            // Preskoči kuvare - oni nemaju veze sa depozitom
            if (wd.role === 'kuvar') return false;
            const userObj = (DB.users || []).find(u => u.username === user);
            if (userObj && userObj.role === 'kuvar') return false;
            return true;
        });
    
    if (otherActive) {
        inheritDeposit = otherActive[1].deposit || 0;
        inheritFrom = otherActive[0];
    }
    
    // Provera 2: Zatvorena smena u ovom radnom danu
    if (inheritDeposit === null && DB.workdayHistory && DB.workdayHistory.length > 0) {
        const sorted = [...DB.workdayHistory].sort((a, b) => 
            new Date(b.logoutTime) - new Date(a.logoutTime)
        );
        for (const shift of sorted) {
            if (new Date(shift.logoutTime) >= businessDayStart) {
                inheritDeposit = Math.max(0, shift.finalCash || 0);
                inheritFrom = shift.user;
                break;
            }
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
            cashReductions: []
        };
        
        DB.workdays[username] = workdayData;
        saveWorkday(username, workdayData);
        page = 'tables';
        render();
        
        showAlert('✅ Smena otvorena!\n\n💰 Depozit: ' + inheritDeposit.toLocaleString() + ' din\n👤 Preuzeto od: ' + inheritFrom);
        return;
    }
    
    // ✅ PRVA SMENA DANAS → ručni unos depozita
    const modal = document.getElementById('depositModal');
    const input = document.getElementById('depositInput');
    const hint = document.getElementById('depositHint');
    
    let suggestedDeposit = 0;
    let lastShiftInfo = '';
    
    if (DB.workdayHistory && DB.workdayHistory.length > 0) {
        const sorted = [...DB.workdayHistory].sort((a, b) => 
            new Date(b.logoutTime) - new Date(a.logoutTime)
        );
        const lastShift = sorted[0];
        
        if (lastShift && lastShift.finalCash !== undefined) {
            suggestedDeposit = Math.max(0, lastShift.finalCash);
            const logoutDate = new Date(lastShift.logoutTime);
            const timeStr = logoutDate.toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            lastShiftInfo = '💡 Poslednja smena (' + lastShift.user + ', ' + timeStr + ') završila sa <strong style="color:#FFD700">' + suggestedDeposit.toLocaleString() + ' din</strong> keša u kasi';
        }
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
    modal.classList.add('show');
    document.getElementById('cashReductionAmount').focus();
}


function closeCashReductionModal() {
    document.getElementById('cashReductionModal').classList.remove('show');
}


function confirmCashReduction() {
    const amount = parseFloat(document.getElementById('cashReductionAmount').value) || 0;
    const reason = document.getElementById('cashReductionReason').value.trim();
    
    // Validacija
    if (amount <= 0) {
        showAlert('Iznos mora biti veći od 0');
        return;
    }
    
    if (!reason) {
        showAlert('Morate uneti razlog!');
        return;
    }
    
    if (reason.length < 5) {
        showAlert('Razlog mora imati najmanje 5 karaktera');
        return;
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


function closeWorkday() {
    const username = DB.currentUser.username;
    const myWorkday = DB.workdays ? DB.workdays[username] : null;
    
    if (!myWorkday) {
        showAlert('❌ Greška: Nema aktivnog radnog dana!');
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
    
    // Druga smena: 4 PM (16h) - 11 PM (23h)
    const isSecondShift = startHour >= 14 && startHour < 20 && endHour >= 22 && endHour <= 23;
    
    let bonusEarned = false;
    let bonusAmount = 0;
    let bonusReason = '';
    
    // PRVA SMENA: 20,000 din → 1,000 din bonus
    if (isFirstShift && totalRevenue >= 20000) {
        bonusEarned = true;
        bonusAmount = 1000;
        bonusReason = 'Prva smena - prihod ≥ 20,000 din.';
    }
    
    // DRUGA SMENA (SVAKI DAN):
    if (isSecondShift) {
        if (totalRevenue >= 60000) {
            bonusEarned = true;
            bonusAmount = 2000;
            bonusReason = 'Druga smena - prihod ≥ 60,000 din.';
        } else if (totalRevenue >= 40000) {
            bonusEarned = true;
            bonusAmount = 1000;
            bonusReason = 'Druga smena - prihod ≥ 40,000 din.';
        }
    }
    
    if (bonusEarned) {
        console.log(`🎁 BONUS OSTVAREN! ${myWorkday.user}: ${bonusAmount} din (${bonusReason})`);
    }
    
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
    
    // Resetuj samo stavke ovog konobara sa stolova
    // ALI NE BRIŠEMO NARUDŽBINE - one ostaju u bazi zauvek!
    DB.tables.forEach(table => {
        if (table.order && table.order.length > 0) {
            // Filtriraj samo stavke drugih konobara (zadrži ih)
            table.order = table.order.filter(item => item.createdBy && item.createdBy !== username);
            
            // Ako je sto prazan nakon filtriranja, resetuj discount
            if (table.order.length === 0) {
                table.discount = 0;
                table.discountPercent = 0;
                table.discountedItems = [];
            }
        }
    });
    
    // Obriši SAMO workday ovog konobara
    // ✅ ATOMIČKI DELETE - briše SAMO /workdays/{username}
    removeWorkday(username);
    console.log('✅ Workday zatvoren za:', username);
    save();
    
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

function checkAndAutoCloseShifts() {
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
        const shiftStart = new Date(wd.startTime);
        // Smena je istekla ako je počela PRE današnjeg cutoff-a (7:00)
        return shiftStart < todayCutoff;
    });
    
    if (expiredShifts.length === 0) return;
    
    console.log('⏰ Presek u 7:00 - zatvaranje ' + expiredShifts.length + ' smena od prethodnog dana');
    
    expiredShifts.forEach(([username, myWorkday]) => {
        autoCloseWorkday(username, myWorkday);
    });
}


function autoCloseWorkday(username, myWorkday) {
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
    
    if (isFirstShift && totalRevenue >= 20000) {
        bonusEarned = true;
        bonusAmount = 1000;
        bonusReason = 'Prva smena - prihod ≥ 20,000 din.';
    }
    if (isSecondShift) {
        if (totalRevenue >= 60000) {
            bonusEarned = true;
            bonusAmount = 2000;
            bonusReason = 'Druga smena - prihod ≥ 60,000 din.';
        } else if (totalRevenue >= 40000) {
            bonusEarned = true;
            bonusAmount = 1000;
            bonusReason = 'Druga smena - prihod ≥ 40,000 din.';
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
    
    // Očisti stavke sa stolova
    DB.tables.forEach(table => {
        if (table.order && table.order.length > 0) {
            table.order = table.order.filter(item => item.createdBy && item.createdBy !== username);
            if (table.order.length === 0) {
                table.discount = 0;
                table.discountPercent = 0;
                table.discountedItems = [];
            }
        }
    });
    
    // Obriši workday
    removeWorkday(username);
    save();
    
    console.log('⏰ Auto-zatvorena smena: ' + username + ' | ' + startTime.toLocaleString('sr-RS') + ' → ' + endTime.toLocaleString('sr-RS') + ' | Prihod: ' + totalRevenue);
}

