// ============================================
// PRESEK STANJA - Cash Book / Balance Sheet
// ============================================

function getCashbookData(startDate, endDate) {
    if (!startDate || !endDate) return { totalCash: 0, totalCard: 0, totalReductions: 0, reductions: [], manualEntries: [], sessions: [], totalSalary: 0, totalBonus: 0, fiscalTotal: 0, fiscalCount: 0 };

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    const sessions = (DB.workdayHistory || []).filter(s =>
        s.logoutTime >= startISO && s.logoutTime <= endISO
    );

    let totalCash = 0;
    let totalCard = 0;
    let totalWire = 0;
    let totalReductions = 0;
    let totalSalary = 0;
    let totalBonus = 0;
    let reductions = [];
    let staffData = {};

    sessions.forEach(s => {
        if (s.cashRevenue !== undefined) {
            totalCash += s.cashRevenue || 0;
            totalCard += s.cardRevenue || 0;
            totalWire += s.wireRevenue || 0;
        } else {
            const reductionsAmt = s.totalCashReductions || 0;
            const dep = s.deposit || 0;
            totalCash += Math.max(0, (s.finalCash || 0) - dep + reductionsAmt);
            totalCard += Math.max(0, (s.revenue || 0) - Math.max(0, (s.finalCash || 0) - dep + reductionsAmt));
        }
        totalReductions += s.totalCashReductions || 0;
        totalSalary += s.salary || 0;
        totalBonus += s.bonusAmount || 0;
        // Per-person plate i bonusi
        const u = s.user || 'nepoznat';
        if (!staffData[u]) staffData[u] = { salary: 0, bonus: 0, shifts: 0, hours: 0 };
        staffData[u].salary += s.salary || 0;
        staffData[u].bonus += s.bonusAmount || 0;
        staffData[u].shifts += 1;
        staffData[u].hours += (s.duration || 0) / 60;
        if (s.cashReductions && s.cashReductions.length > 0) {
            s.cashReductions.forEach(r => {
                reductions.push({
                    amount: r.amount,
                    reason: r.reason || '',
                    timestamp: r.timestamp || s.logoutTime,
                    user: s.user
                });
            });
        }
    });

    const manualEntries = (DB.cashbook || []).filter(e =>
        e.date >= startISO && e.date <= endISO
    );

    let manualIncome = 0;
    let manualExpense = 0;
    let duleIncome = 0, duleExpense = 0;
    let maraIncome = 0, maraExpense = 0;
    let otherIncome = 0, otherExpense = 0;

    // Smanjenja keša koja sadrže "dule" ili "mara" u razlogu → dodaj na njihov račun
    reductions.forEach(r => {
        const reason = (r.reason || '').toLowerCase();
        if (reason.includes('dule') || reason.includes('duле')) {
            duleExpense += r.amount;
        } else if (reason.includes('mara') || reason.includes('мара')) {
            maraExpense += r.amount;
        }
    });

    manualEntries.forEach(e => {
        const person = (e.person || '').toLowerCase();
        if (e.type === 'income') {
            manualIncome += e.amount;
            if (person === 'dule') duleIncome += e.amount;
            else if (person === 'mara') maraIncome += e.amount;
            else otherIncome += e.amount;
        } else if (e.type === 'expense') {
            manualExpense += e.amount;
            if (person === 'dule') duleExpense += e.amount;
            else if (person === 'mara') maraExpense += e.amount;
            else otherExpense += e.amount;
        }
    });

    // Fiskalni računi - iz narudžbina sa isFiscal flag
    const fiscalOrders = (DB.orders || []).filter(o => {
        if (!o || !o.time || !o.isFiscal) return false;
        return o.time >= startISO && o.time <= endISO;
    });
    const fiscalTotal = fiscalOrders.reduce((s, o) => s + (o.tot || 0), 0);
    const fiscalCount = fiscalOrders.length;

    const totalRevenue = totalCash + totalCard + totalWire;
    const cashAfterAll = totalCash - totalReductions + manualIncome - manualExpense - totalSalary - totalBonus;

    return {
        totalCash, totalCard, totalWire, totalRevenue,
        totalReductions, reductions,
        totalSalary, totalBonus,
        manualEntries, manualIncome, manualExpense,
        duleIncome, duleExpense, duleNet: duleIncome - duleExpense,
        maraIncome, maraExpense, maraNet: maraIncome - maraExpense,
        otherIncome, otherExpense, staffData,
        sessions,
        cashAfterAll,
        fiscalTotal, fiscalCount
    };
}

var cashbookStartDate = null;
var cashbookEndDate = null;

function initCashbookDates() {
    if (!cashbookStartDate) {
        const now = new Date();
        cashbookEndDate = new Date(now);
        cashbookEndDate.setHours(23, 59, 59, 999);
        cashbookStartDate = new Date(now);
        cashbookStartDate.setDate(cashbookStartDate.getDate() - 13);
        cashbookStartDate.setHours(0, 0, 0, 0);
    }
}

function formatDateInput(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function renderCashbook(c) {
    initCashbookDates();
    const data = getCashbookData(cashbookStartDate, cashbookEndDate);

    let h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">';
    h += '<h2>💰 Presek Stanja</h2>';
    h += '<button class="btn" style="width:auto;padding:8px 16px;background:#4CAF50" onclick="addCashbookEntry()">+ Dodaj Unos</button>';
    h += '</div>';

    // Date range selector
    h += '<div style="background:#0F3460;padding:16px;border-radius:12px;margin-bottom:20px">';
    h += '<div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap">';
    h += '<div style="display:flex;align-items:center;gap:8px">';
    h += '<span style="color:#B0B0B0;font-size:13px">Od:</span>';
    h += '<input type="date" id="cashbookFrom" value="' + formatDateInput(cashbookStartDate) + '" onchange="updateCashbookDates()" style="padding:8px 12px;border-radius:8px;border:1px solid #2A2A4A;background:#16213E;color:#FFF;font-size:14px">';
    h += '</div>';
    h += '<div style="display:flex;align-items:center;gap:8px">';
    h += '<span style="color:#B0B0B0;font-size:13px">Do:</span>';
    h += '<input type="date" id="cashbookTo" value="' + formatDateInput(cashbookEndDate) + '" onchange="updateCashbookDates()" style="padding:8px 12px;border-radius:8px;border:1px solid #2A2A4A;background:#16213E;color:#FFF;font-size:14px">';
    h += '</div>';
    h += '</div>';
    h += '<div style="display:flex;justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap">';
    h += '<button class="btn btn-secondary" style="width:auto;padding:6px 12px;font-size:12px" onclick="setCashbookQuick(7)">7 dana</button>';
    h += '<button class="btn btn-secondary" style="width:auto;padding:6px 12px;font-size:12px" onclick="setCashbookQuick(14)">2 nedelje</button>';
    h += '<button class="btn btn-secondary" style="width:auto;padding:6px 12px;font-size:12px" onclick="setCashbookQuick(30)">30 dana</button>';
    h += '<button class="btn btn-secondary" style="width:auto;padding:6px 12px;font-size:12px" onclick="setCashbookMonth()">Ovaj mesec</button>';
    h += '<button class="btn btn-secondary" style="width:auto;padding:6px 12px;font-size:12px" onclick="setCashbookPrevMonth()">Prošli mesec</button>';
    h += '</div>';
    h += '</div>';

    // =============================================
    // KOLONA 1: UKUPAN PRESEK
    // =============================================
    h += '<div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:16px">';
    h += '<h3 style="color:#FFD700;margin-bottom:16px">📊 Ukupan Presek</h3>';

    h += '<div style="display:flex;flex-direction:column;gap:8px">';
    // Keš
    h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1A1A3E">';
    h += '<span style="color:#B0B0B0">💵 Otkucani keš</span>';
    h += '<span style="color:#4CAF50;font-weight:bold">+' + data.totalCash.toFixed(0) + ' din</span></div>';
    // Ručni prihodi
    if (data.manualIncome > 0) {
        h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1A1A3E">';
        h += '<span style="color:#B0B0B0">💰 Ručno dodato</span>';
        h += '<span style="color:#4CAF50;font-weight:bold">+' + data.manualIncome.toFixed(0) + ' din</span></div>';
    }
    // Kartice info
    h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1A1A3E">';
    h += '<span style="color:#B0B0B0">💳 Kartice (info)</span>';
    h += '<span style="color:#2196F3;font-weight:bold">' + data.totalCard.toFixed(0) + ' din</span></div>';

    // Fiskalni računi
    h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1A1A3E">';
    h += '<span style="color:#B0B0B0">🧾 Kucani računi (' + data.fiscalCount + ')</span>';
    h += '<span style="color:#00BCD4;font-weight:bold">' + data.fiscalTotal.toFixed(0) + ' din</span></div>';

    h += '<div style="margin:8px 0;border-top:2px solid #2A2A4A"></div>';

    // Oduzimanja
    if (data.totalReductions > 0) {
        h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1A1A3E">';
        h += '<span style="color:#B0B0B0">💸 Smanjenja keša</span>';
        h += '<span style="color:#E94560;font-weight:bold">-' + data.totalReductions.toFixed(0) + ' din</span></div>';
    }
    if (data.manualExpense > 0) {
        h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1A1A3E">';
        h += '<span style="color:#B0B0B0">💸 Ručno oduzeto</span>';
        h += '<span style="color:#E94560;font-weight:bold">-' + data.manualExpense.toFixed(0) + ' din</span></div>';
    }
    h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1A1A3E">';
    h += '<span style="color:#B0B0B0">👥 Plate</span>';
    h += '<span style="color:#E94560;font-weight:bold">-' + data.totalSalary.toFixed(0) + ' din</span></div>';
    h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1A1A3E">';
    h += '<span style="color:#B0B0B0">🎁 Bonusi</span>';
    h += '<span style="color:#E94560;font-weight:bold">-' + data.totalBonus.toFixed(0) + ' din</span></div>';

    h += '<div style="margin:8px 0;border-top:2px solid #FFD700"></div>';

    // Krajnji rezultat
    h += '<div style="display:flex;justify-content:space-between;padding:8px 0">';
    h += '<span style="color:#FFD700;font-weight:bold;font-size:16px">= Ostaje</span>';
    const remaining = data.cashAfterAll;
    h += '<span style="color:' + (remaining >= 0 ? '#FFD700' : '#E94560') + ';font-weight:bold;font-size:18px">' + remaining.toFixed(0) + ' din</span></div>';

    h += '</div></div>';

    // =============================================
    // KOLONA 2: DULE & MARA
    // =============================================
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';

    // DULE
    h += '<div style="background:#0F3460;padding:16px;border-radius:12px">';
    h += '<h3 style="color:#2196F3;margin-bottom:12px;text-align:center">👤 Dule</h3>';
    h += '<div style="display:flex;flex-direction:column;gap:6px">';
    h += '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:#B0B0B0">Dodao:</span><span style="color:#4CAF50;font-weight:bold">+' + data.duleIncome.toFixed(0) + '</span></div>';
    h += '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:#B0B0B0">Uzeo:</span><span style="color:#E94560;font-weight:bold">-' + data.duleExpense.toFixed(0) + '</span></div>';
    h += '<div style="border-top:1px solid #2A2A4A;padding-top:6px;display:flex;justify-content:space-between;font-size:14px"><span style="color:#FFD700;font-weight:bold">Neto:</span>';
    h += '<span style="color:' + (data.duleNet >= 0 ? '#4CAF50' : '#E94560') + ';font-weight:bold">' + (data.duleNet >= 0 ? '+' : '') + data.duleNet.toFixed(0) + '</span></div>';
    h += '</div></div>';

    // MARA
    h += '<div style="background:#0F3460;padding:16px;border-radius:12px">';
    h += '<h3 style="color:#9C27B0;margin-bottom:12px;text-align:center">👤 Mara</h3>';
    h += '<div style="display:flex;flex-direction:column;gap:6px">';
    h += '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:#B0B0B0">Dodala:</span><span style="color:#4CAF50;font-weight:bold">+' + data.maraIncome.toFixed(0) + '</span></div>';
    h += '<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:#B0B0B0">Uzela:</span><span style="color:#E94560;font-weight:bold">-' + data.maraExpense.toFixed(0) + '</span></div>';
    h += '<div style="border-top:1px solid #2A2A4A;padding-top:6px;display:flex;justify-content:space-between;font-size:14px"><span style="color:#FFD700;font-weight:bold">Neto:</span>';
    h += '<span style="color:' + (data.maraNet >= 0 ? '#4CAF50' : '#E94560') + ';font-weight:bold">' + (data.maraNet >= 0 ? '+' : '') + data.maraNet.toFixed(0) + '</span></div>';
    h += '</div></div>';

    h += '</div>';

    // PODELA - šta ostaje za podelu
    const forSplit = remaining - data.duleNet - data.maraNet;
    const eachGets = forSplit / 2;
    h += '<div style="background:#1A1A3E;padding:16px;border-radius:12px;margin-bottom:16px;border:2px solid #FFD700">';
    h += '<h3 style="color:#FFD700;margin-bottom:12px;text-align:center">💰 Podela</h3>';
    h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #2A2A4A"><span style="color:#B0B0B0">Ostaje posle svega:</span><span style="color:#FFD700;font-weight:bold">' + remaining.toFixed(0) + ' din</span></div>';
    h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #2A2A4A"><span style="color:#B0B0B0">Za podelu (50/50):</span><span style="color:#FFD700;font-weight:bold">' + forSplit.toFixed(0) + ' din</span></div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">';
    // Dule dobija
    const duleFinal = eachGets + data.duleNet;
    h += '<div style="text-align:center;background:#0F3460;padding:12px;border-radius:8px">';
    h += '<div style="color:#2196F3;font-weight:bold;margin-bottom:4px">👤 Dule</div>';
    h += '<div style="color:#888;font-size:11px">' + eachGets.toFixed(0) + ' (polovina) ' + (data.duleNet >= 0 ? '+ ' : '- ') + Math.abs(data.duleNet).toFixed(0) + ' (neto)</div>';
    h += '<div style="color:' + (duleFinal >= 0 ? '#4CAF50' : '#E94560') + ';font-size:20px;font-weight:bold">' + duleFinal.toFixed(0) + ' din</div></div>';
    // Mara dobija
    const maraFinal = eachGets + data.maraNet;
    h += '<div style="text-align:center;background:#0F3460;padding:12px;border-radius:8px">';
    h += '<div style="color:#9C27B0;font-weight:bold;margin-bottom:4px">👤 Mara</div>';
    h += '<div style="color:#888;font-size:11px">' + eachGets.toFixed(0) + ' (polovina) ' + (data.maraNet >= 0 ? '+ ' : '- ') + Math.abs(data.maraNet).toFixed(0) + ' (neto)</div>';
    h += '<div style="color:' + (maraFinal >= 0 ? '#4CAF50' : '#E94560') + ';font-size:20px;font-weight:bold">' + maraFinal.toFixed(0) + ' din</div></div>';
    h += '</div></div>';

    // =============================================
    // PLATE I BONUSI PO OSOBI
    // =============================================
    const staffEntries = Object.entries(data.staffData).sort((a, b) => (b[1].salary + b[1].bonus) - (a[1].salary + a[1].bonus));
    if (staffEntries.length > 0) {
        h += '<div style="background:#0F3460;padding:16px;border-radius:12px;margin-bottom:16px">';
        h += '<h3 style="color:#FF9800;margin-bottom:12px">👥 Plate i Bonusi po Osobi</h3>';
        h += '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:4px;padding:6px 0;border-bottom:2px solid #2A2A4A;font-size:12px;color:#888">';
        h += '<span>Ime</span><span style="text-align:right">Smene</span><span style="text-align:right">Sati</span><span style="text-align:right">Plata</span><span style="text-align:right">Bonus</span></div>';
        staffEntries.forEach(function(entry) {
            var name = entry[0];
            var d = entry[1];
            var total = d.salary + d.bonus;
            h += '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:4px;padding:8px 0;border-bottom:1px solid #1A1A3E;font-size:13px">';
            h += '<span style="color:#FFD700;font-weight:bold">' + name + '</span>';
            h += '<span style="text-align:right;color:#B0B0B0">' + d.shifts + '</span>';
            h += '<span style="text-align:right;color:#B0B0B0">' + d.hours.toFixed(1) + 'h</span>';
            h += '<span style="text-align:right;color:#E94560;font-weight:bold">' + d.salary.toFixed(0) + '</span>';
            h += '<span style="text-align:right;color:#9C27B0;font-weight:bold">' + d.bonus.toFixed(0) + '</span>';
            h += '</div>';
        });
        // Totali
        var totSal = staffEntries.reduce(function(s, e) { return s + e[1].salary; }, 0);
        var totBon = staffEntries.reduce(function(s, e) { return s + e[1].bonus; }, 0);
        var totShifts = staffEntries.reduce(function(s, e) { return s + e[1].shifts; }, 0);
        var totHours = staffEntries.reduce(function(s, e) { return s + e[1].hours; }, 0);
        h += '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:4px;padding:8px 0;border-top:2px solid #FFD700;font-size:13px;font-weight:bold">';
        h += '<span style="color:#FFD700">UKUPNO</span>';
        h += '<span style="text-align:right;color:#FFD700">' + totShifts + '</span>';
        h += '<span style="text-align:right;color:#FFD700">' + totHours.toFixed(1) + 'h</span>';
        h += '<span style="text-align:right;color:#E94560">' + totSal.toFixed(0) + '</span>';
        h += '<span style="text-align:right;color:#9C27B0">' + totBon.toFixed(0) + '</span>';
        h += '</div>';
        h += '</div>';
    }

    // Smanjenja keša detalji
    if (data.reductions.length > 0) {
        h += '<div style="background:#0F3460;padding:16px;border-radius:12px;margin-bottom:16px">';
        h += '<h3 style="color:#E94560;margin-bottom:12px">💸 Smanjenja Keša</h3>';
        data.reductions.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
        data.reductions.forEach(r => {
            const d = new Date(r.timestamp);
            const dateStr = d.toLocaleDateString('sr-RS', { day: 'numeric', month: 'short' });
            h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1A1A3E">';
            h += '<div><span style="color:#FFD700;font-size:13px">' + dateStr + '</span> <span style="color:#888;font-size:12px">(' + (r.user || '') + ')</span>';
            h += '<div style="color:#B0B0B0;font-size:12px">' + (r.reason || 'Bez opisa') + '</div></div>';
            h += '<span style="color:#E94560;font-weight:bold">-' + r.amount.toFixed(0) + ' din</span></div>';
        });
        h += '</div>';
    }

    // Ručni unosi lista
    const entries = data.manualEntries;
    if (entries.length > 0) {
        h += '<div style="background:#0F3460;padding:16px;border-radius:12px;margin-bottom:16px">';
        h += '<h3 style="color:#FFD700;margin-bottom:12px">📝 Ručni Unosi</h3>';
        entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        entries.forEach(e => {
            const d = new Date(e.date);
            const dateStr = d.toLocaleDateString('sr-RS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            const isIncome = e.type === 'income';
            const personLabel = e.person ? ' (' + e.person + ')' : '';
            h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1A1A3E">';
            h += '<div><span style="color:#FFD700;font-size:13px">' + dateStr + '</span><span style="color:#888;font-size:12px">' + personLabel + '</span>';
            h += '<div style="color:#B0B0B0;font-size:12px">' + (e.description || 'Bez opisa') + '</div></div>';
            h += '<div style="display:flex;align-items:center;gap:8px">';
            h += '<span style="color:' + (isIncome ? '#4CAF50' : '#E94560') + ';font-weight:bold">' + (isIncome ? '+' : '-') + e.amount.toFixed(0) + ' din</span>';
            h += '<button onclick="deleteCashbookEntry(\'' + e.id + '\')" style="background:none;border:none;color:#E94560;font-size:16px;cursor:pointer;padding:4px" title="Obriši">🗑️</button>';
            h += '</div></div>';
        });
        h += '</div>';
    }

    // Smene
    if (data.sessions.length > 0) {
        h += '<div style="background:#0F3460;padding:16px;border-radius:12px;margin-bottom:16px">';
        h += '<h3 style="color:#2196F3;margin-bottom:12px">📋 Smene (' + data.sessions.length + ')</h3>';
        data.sessions.sort((a, b) => (b.logoutTime || '').localeCompare(a.logoutTime || ''));
        data.sessions.forEach(s => {
            const d = new Date(s.loginTime);
            const dateStr = d.toLocaleDateString('sr-RS', { day: 'numeric', month: 'short' });
            const timeStr = d.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
            const sCash = s.cashRevenue !== undefined ? (s.cashRevenue || 0) : 0;
            const sCard = s.cardRevenue !== undefined ? (s.cardRevenue || 0) : 0;
            h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #1A1A3E;font-size:13px">';
            h += '<div><span style="color:#FFD700">' + dateStr + '</span> <span style="color:#888">' + timeStr + '</span> <span style="color:#B0B0B0">' + (s.user || '') + '</span></div>';
            h += '<div style="display:flex;gap:8px">';
            h += '<span style="color:#4CAF50">💵' + sCash.toFixed(0) + '</span>';
            h += '<span style="color:#2196F3">💳' + sCard.toFixed(0) + '</span>';
            if ((s.salary || 0) > 0) h += '<span style="color:#FF9800">👤' + (s.salary || 0).toFixed(0) + '</span>';
            if ((s.bonusAmount || 0) > 0) h += '<span style="color:#9C27B0">🎁' + (s.bonusAmount || 0).toFixed(0) + '</span>';
            if (s.totalCashReductions > 0) h += '<span style="color:#E94560">-' + s.totalCashReductions.toFixed(0) + '</span>';
            h += '</div></div>';
        });
        h += '</div>';
    }

    c.innerHTML = h;
}

function updateCashbookDates() {
    const from = document.getElementById('cashbookFrom').value;
    const to = document.getElementById('cashbookTo').value;
    if (from) { cashbookStartDate = new Date(from); cashbookStartDate.setHours(0, 0, 0, 0); }
    if (to) { cashbookEndDate = new Date(to); cashbookEndDate.setHours(23, 59, 59, 999); }
    render();
}

function setCashbookQuick(days) {
    const now = new Date();
    cashbookEndDate = new Date(now); cashbookEndDate.setHours(23, 59, 59, 999);
    cashbookStartDate = new Date(now); cashbookStartDate.setDate(cashbookStartDate.getDate() - (days - 1)); cashbookStartDate.setHours(0, 0, 0, 0);
    render();
}

function setCashbookMonth() {
    const now = new Date();
    cashbookStartDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    cashbookEndDate = new Date(now); cashbookEndDate.setHours(23, 59, 59, 999);
    render();
}

function setCashbookPrevMonth() {
    const now = new Date();
    cashbookStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    cashbookEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    render();
}

function addCashbookEntry() {
    let h = '<div style="text-align:left">';
    h += '<div style="margin-bottom:12px"><label style="color:#B0B0B0;font-size:13px">Osoba:</label><br>';
    h += '<select id="cashbookPerson" style="width:100%;padding:10px;border-radius:8px;border:1px solid #2A2A4A;background:#16213E;color:#FFF;font-size:15px;margin-top:4px">';
    h += '<option value="Dule">Dule</option>';
    h += '<option value="Mara">Mara</option>';
    h += '</select></div>';
    h += '<div style="margin-bottom:12px"><label style="color:#B0B0B0;font-size:13px">Tip:</label><br>';
    h += '<select id="cashbookType" style="width:100%;padding:10px;border-radius:8px;border:1px solid #2A2A4A;background:#16213E;color:#FFF;font-size:15px;margin-top:4px">';
    h += '<option value="expense">💸 Uzeo/la novac</option>';
    h += '<option value="income">💰 Dodao/la novac</option>';
    h += '</select></div>';
    h += '<div style="margin-bottom:12px"><label style="color:#B0B0B0;font-size:13px">Iznos (din):</label><br>';
    h += '<input type="number" id="cashbookAmount" placeholder="0" style="width:100%;padding:10px;border-radius:8px;border:1px solid #2A2A4A;background:#16213E;color:#FFF;font-size:18px;margin-top:4px"></div>';
    h += '<div style="margin-bottom:12px"><label style="color:#B0B0B0;font-size:13px">Opis:</label><br>';
    h += '<input type="text" id="cashbookDesc" placeholder="npr. Nabavka pića, uzeo keš..." style="width:100%;padding:10px;border-radius:8px;border:1px solid #2A2A4A;background:#16213E;color:#FFF;font-size:15px;margin-top:4px"></div>';
    h += '</div>';

    showConfirm('📝 Novi Unos', h, function(confirmed) {
        if (!confirmed) return;

        const person = document.getElementById('cashbookPerson').value;
        const type = document.getElementById('cashbookType').value;
        const amount = parseFloat(document.getElementById('cashbookAmount').value) || 0;
        const desc = document.getElementById('cashbookDesc').value.trim();

        if (amount <= 0) {
            showAlert('❌ Unesite iznos veći od 0');
            return;
        }

        if (!DB.cashbook) DB.cashbook = [];
        DB.cashbook.push({
            id: Date.now().toString(),
            type: type,
            person: person,
            amount: amount,
            description: desc,
            date: new Date().toISOString(),
            createdBy: DB.currentUser ? DB.currentUser.username : 'admin'
        });

        save();
        render();
        showAlert('✅ ' + person + ' - ' + (type === 'income' ? 'dodao/la +' : 'uzeo/la -') + amount.toFixed(0) + ' din');
    });
}

function deleteCashbookEntry(entryId) {
    const entry = (DB.cashbook || []).find(e => e.id === entryId);
    if (!entry) return;

    showConfirm('🗑️ Obriši Unos', 'Da li ste sigurni?\n\n' +
        (entry.person || '') + ' - ' + (entry.type === 'income' ? 'Dodao/la' : 'Uzeo/la') + ': ' + entry.amount.toFixed(0) + ' din\n' +
        (entry.description || 'Bez opisa'), function(confirmed) {
        if (!confirmed) return;

        DB.cashbook = DB.cashbook.filter(e => e.id !== entryId);
        DB._adminDeleteOverride = true;
        save();
        render();
        showAlert('✅ Unos obrisan');
    });
}
