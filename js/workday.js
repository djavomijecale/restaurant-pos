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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // ✅ PROVERA 1: Da li neko TRENUTNO radi? (preklapanje smena)
    const activeWorkdays = DB.workdays || {};
    const otherActiveShift = Object.entries(activeWorkdays)
        .find(([user, wd]) => user !== username && wd && wd.startTime);
    
    if (otherActiveShift) {
        const [activeUser, activeWd] = otherActiveShift;
        const inheritedDeposit = activeWd.deposit || 0;
        const startDate = new Date(activeWd.startTime);
        const timeStr = startDate.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
        
        if (!DB.workdays) DB.workdays = {};
        
        const workdayData = {
            user: username,
            startTime: new Date().toISOString(),
            startOrders: DB.orders.length,
            deposit: inheritedDeposit,
            inheritedFrom: activeUser,
            cashReductions: []
        };
        
        DB.workdays[username] = workdayData;
        saveWorkday(username, workdayData);
        page = 'tables';
        render();
        
        showAlert(`✅ Smena otvorena!\n\n💰 Preuzeto ${inheritedDeposit.toLocaleString()} din iz kase\n👤 Aktivna smena: ${activeUser} (od ${timeStr})`);
        return;
    }
    
    // ✅ PROVERA 2: Da li je danas već bila ZATVORENA smena?
    let lastTodayShift = null;
    
    if (DB.workdayHistory && DB.workdayHistory.length > 0) {
        const sorted = [...DB.workdayHistory].sort((a, b) => 
            new Date(b.logoutTime) - new Date(a.logoutTime)
        );
        
        for (const shift of sorted) {
            const shiftEnd = new Date(shift.logoutTime);
            if (shiftEnd >= today) {
                lastTodayShift = shift;
                break;
            }
        }
    }
    
    if (lastTodayShift && lastTodayShift.finalCash !== undefined) {
        // Druga smena - automatski preuzmi keš iz prethodne
        const inheritedDeposit = Math.max(0, lastTodayShift.finalCash);
        const shiftUser = lastTodayShift.user;
        const logoutDate = new Date(lastTodayShift.logoutTime);
        const timeStr = logoutDate.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
        
        if (!DB.workdays) DB.workdays = {};
        
        const workdayData = {
            user: username,
            startTime: new Date().toISOString(),
            startOrders: DB.orders.length,
            deposit: inheritedDeposit,
            inheritedFrom: shiftUser,
            cashReductions: []
        };
        
        DB.workdays[username] = workdayData;
        saveWorkday(username, workdayData);
        page = 'tables';
        render();
        
        showAlert(`✅ Druga smena otvorena!\n\n💰 Preuzeto ${inheritedDeposit.toLocaleString()} din iz kase\n👤 Prethodna smena: ${shiftUser} (${timeStr})`);
        return;
    }
    
    // ✅ PRVA SMENA DANAS - ručni unos depozita
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
            lastShiftInfo = `💡 Poslednja smena (${lastShift.user}, ${timeStr}) završila sa <strong style="color:#FFD700">${suggestedDeposit.toLocaleString()} din</strong> keša u kasi`;
        }
    }
    
    input.value = suggestedDeposit > 0 ? suggestedDeposit : '0';
    
    if (hint) {
        if (lastShiftInfo) {
            hint.innerHTML = lastShiftInfo;
        } else {
            hint.innerHTML = '💡 Možete uneti 0 ako nemate depozit';
        }
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
    const totalRevenue = dayOrders.reduce((s,o)=>s+o.tot,0);
    const cash = dayOrders.filter(o=>o.method==='Cash').reduce((s,o)=>s+o.tot,0);
    const card = dayOrders.filter(o=>o.method==='Card').reduce((s,o)=>s+o.tot,0);
    
    // SMANJENJA KEŠA - oduzmi od keša
    const cashReductions = myWorkday.cashReductions || [];
    const totalCashReductions = cashReductions.reduce((sum, r) => sum + r.amount, 0);
    
    // DEPOZIT - dodaj na ukupan učinak
    const deposit = myWorkday.deposit || 0;
    const finalCash = deposit + cash - totalCashReductions; // Stvarno stanje kase: depozit + keš prihod - smanjenja
    const totalPerformance = totalRevenue + deposit; // Ukupan učinak = otkucano + depozit
    
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
        orderCount: dayOrders.length,
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
        orderCount: dayOrders.length,
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
        isSecondShift: isSecondShift
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

