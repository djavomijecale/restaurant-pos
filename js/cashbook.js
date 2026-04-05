// ============================================
// PRESEK STANJA - Cash Book / Balance Sheet
// ============================================

function getCashbookPeriods() {
    // Generiši dvonedeljne periode od početka podataka do danas
    const periods = [];
    const now = new Date();

    // Nađi najraniji datum iz workdayHistory
    let earliest = new Date();
    if (DB.workdayHistory && DB.workdayHistory.length > 0) {
        DB.workdayHistory.forEach(s => {
            const d = new Date(s.loginTime);
            if (d < earliest) earliest = d;
        });
    }
    // Zaokruži na ponedeljak te nedelje
    earliest.setHours(0, 0, 0, 0);
    const dayOfWeek = earliest.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    earliest.setDate(earliest.getDate() - diff);

    let start = new Date(earliest);
    while (start <= now) {
        const end = new Date(start);
        end.setDate(end.getDate() + 13); // 14 dana (0-13)
        end.setHours(23, 59, 59, 999);
        periods.push({ start: new Date(start), end: new Date(end) });
        start.setDate(start.getDate() + 14);
    }
    return periods;
}

function getCurrentPeriod() {
    const periods = getCashbookPeriods();
    return periods.length > 0 ? periods[periods.length - 1] : null;
}

function getCashbookData(period) {
    if (!period) return { totalCash: 0, totalCard: 0, totalReductions: 0, reductions: [], manualEntries: [], sessions: [] };

    const startISO = period.start.toISOString();
    const endISO = period.end.toISOString();

    // Sesije u ovom periodu
    const sessions = (DB.workdayHistory || []).filter(s =>
        s.logoutTime >= startISO && s.logoutTime <= endISO
    );

    let totalCash = 0;
    let totalCard = 0;
    let totalWire = 0;
    let totalReductions = 0;
    let reductions = [];

    sessions.forEach(s => {
        totalCash += s.cashRevenue || 0;
        totalCard += s.cardRevenue || 0;
        totalWire += s.wireRevenue || 0;
        totalReductions += s.totalCashReductions || 0;
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

    // Ručni unosi za ovaj period
    const manualEntries = (DB.cashbook || []).filter(e =>
        e.date >= startISO && e.date <= endISO
    );

    let manualIncome = 0;
    let manualExpense = 0;
    manualEntries.forEach(e => {
        if (e.type === 'income') manualIncome += e.amount;
        else if (e.type === 'expense') manualExpense += e.amount;
    });

    return {
        totalCash,
        totalCard,
        totalWire,
        totalReductions,
        reductions,
        manualEntries,
        manualIncome,
        manualExpense,
        sessions,
        balance: totalCash - totalReductions + manualIncome - manualExpense
    };
}

var selectedCashbookPeriod = null;

function renderCashbook(c) {
    const periods = getCashbookPeriods();
    if (!selectedCashbookPeriod && periods.length > 0) {
        selectedCashbookPeriod = periods.length - 1;
    }

    const period = periods[selectedCashbookPeriod] || null;
    const data = getCashbookData(period);

    const fmtDate = (d) => d.toLocaleDateString('sr-RS', { day: 'numeric', month: 'short', year: 'numeric' });

    let h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">';
    h += '<h2>💰 Presek Stanja</h2>';
    h += '<button class="btn" style="width:auto;padding:8px 16px;background:#4CAF50" onclick="addCashbookEntry()">+ Dodaj Unos</button>';
    h += '</div>';

    // Period selector
    h += '<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:20px">';
    h += '<button class="btn btn-secondary" style="width:auto;padding:8px 12px" onclick="changeCashbookPeriod(-1)"' + (selectedCashbookPeriod <= 0 ? ' disabled style="width:auto;padding:8px 12px;opacity:0.4"' : '') + '>←</button>';
    if (period) {
        h += '<div style="text-align:center"><div style="color:#FFD700;font-weight:bold;font-size:16px">' + fmtDate(period.start) + ' — ' + fmtDate(period.end) + '</div>';
        h += '<div style="color:#888;font-size:12px">Period ' + (selectedCashbookPeriod + 1) + ' od ' + periods.length + '</div></div>';
    }
    h += '<button class="btn btn-secondary" style="width:auto;padding:8px 12px" onclick="changeCashbookPeriod(1)"' + (selectedCashbookPeriod >= periods.length - 1 ? ' disabled style="width:auto;padding:8px 12px;opacity:0.4"' : '') + '>→</button>';
    h += '</div>';

    if (!period) {
        h += '<div style="text-align:center;color:#888;padding:40px">Nema podataka</div>';
        c.innerHTML = h;
        return;
    }

    // Glavni brojevi
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px">';
    h += '<div class="stat-card"><div class="stat-label">Otkucani Keš</div><div class="stat-value" style="color:#4CAF50">' + data.totalCash.toFixed(0) + '</div><div class="stat-label">din.</div></div>';
    h += '<div class="stat-card"><div class="stat-label">Kartice</div><div class="stat-value" style="color:#2196F3">' + data.totalCard.toFixed(0) + '</div><div class="stat-label">din.</div></div>';
    h += '<div class="stat-card"><div class="stat-label">Smanjenja Keša</div><div class="stat-value" style="color:#E94560">' + data.totalReductions.toFixed(0) + '</div><div class="stat-label">din.</div></div>';
    h += '<div class="stat-card"><div class="stat-label">Bilans Keša</div><div class="stat-value" style="color:#FFD700">' + data.balance.toFixed(0) + '</div><div class="stat-label">din.</div></div>';
    h += '</div>';

    // Ručni unosi
    if (data.manualIncome > 0 || data.manualExpense > 0) {
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';
        h += '<div class="stat-card"><div class="stat-label">Ručni Prihodi</div><div class="stat-value" style="color:#4CAF50">+' + data.manualIncome.toFixed(0) + '</div><div class="stat-label">din.</div></div>';
        h += '<div class="stat-card"><div class="stat-label">Ručni Rashodi</div><div class="stat-value" style="color:#E94560">-' + data.manualExpense.toFixed(0) + '</div><div class="stat-label">din.</div></div>';
        h += '</div>';
    }

    // Detalji smanjenja keša
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
            h += '<span style="color:#E94560;font-weight:bold">-' + r.amount.toFixed(0) + ' din</span>';
            h += '</div>';
        });
        h += '</div>';
    }

    // Ručni unosi - lista
    const entries = data.manualEntries;
    if (entries.length > 0) {
        h += '<div style="background:#0F3460;padding:16px;border-radius:12px;margin-bottom:16px">';
        h += '<h3 style="color:#FFD700;margin-bottom:12px">📝 Ručni Unosi</h3>';
        entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        entries.forEach(e => {
            const d = new Date(e.date);
            const dateStr = d.toLocaleDateString('sr-RS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            const isIncome = e.type === 'income';
            h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1A1A3E">';
            h += '<div><span style="color:#FFD700;font-size:13px">' + dateStr + '</span>';
            h += '<div style="color:#B0B0B0;font-size:12px">' + (e.description || 'Bez opisa') + '</div></div>';
            h += '<div style="display:flex;align-items:center;gap:8px">';
            h += '<span style="color:' + (isIncome ? '#4CAF50' : '#E94560') + ';font-weight:bold">' + (isIncome ? '+' : '-') + e.amount.toFixed(0) + ' din</span>';
            h += '<button onclick="deleteCashbookEntry(\'' + e.id + '\')" style="background:none;border:none;color:#E94560;font-size:16px;cursor:pointer;padding:4px" title="Obriši">🗑️</button>';
            h += '</div></div>';
        });
        h += '</div>';
    }

    // Rezime po smenama
    if (data.sessions.length > 0) {
        h += '<div style="background:#0F3460;padding:16px;border-radius:12px;margin-bottom:16px">';
        h += '<h3 style="color:#2196F3;margin-bottom:12px">📋 Smene u periodu (' + data.sessions.length + ')</h3>';
        data.sessions.sort((a, b) => (b.logoutTime || '').localeCompare(a.logoutTime || ''));
        data.sessions.forEach(s => {
            const d = new Date(s.loginTime);
            const dateStr = d.toLocaleDateString('sr-RS', { day: 'numeric', month: 'short' });
            const timeStr = d.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
            h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #1A1A3E;font-size:13px">';
            h += '<div><span style="color:#FFD700">' + dateStr + '</span> <span style="color:#888">' + timeStr + '</span> <span style="color:#B0B0B0">' + (s.user || '') + '</span></div>';
            h += '<div style="display:flex;gap:12px">';
            h += '<span style="color:#4CAF50">💵' + (s.cashRevenue || 0).toFixed(0) + '</span>';
            h += '<span style="color:#2196F3">💳' + (s.cardRevenue || 0).toFixed(0) + '</span>';
            if (s.totalCashReductions > 0) h += '<span style="color:#E94560">-' + s.totalCashReductions.toFixed(0) + '</span>';
            h += '</div></div>';
        });
        h += '</div>';
    }

    c.innerHTML = h;
}

function changeCashbookPeriod(dir) {
    const periods = getCashbookPeriods();
    selectedCashbookPeriod = Math.max(0, Math.min(periods.length - 1, selectedCashbookPeriod + dir));
    render();
}

function addCashbookEntry() {
    let h = '<div style="text-align:left">';
    h += '<div style="margin-bottom:12px"><label style="color:#B0B0B0;font-size:13px">Tip:</label><br>';
    h += '<select id="cashbookType" style="width:100%;padding:10px;border-radius:8px;border:1px solid #2A2A4A;background:#16213E;color:#FFF;font-size:15px;margin-top:4px">';
    h += '<option value="expense">💸 Rashod (potrošen novac)</option>';
    h += '<option value="income">💰 Prihod (primljen novac)</option>';
    h += '</select></div>';
    h += '<div style="margin-bottom:12px"><label style="color:#B0B0B0;font-size:13px">Iznos (din):</label><br>';
    h += '<input type="number" id="cashbookAmount" placeholder="0" style="width:100%;padding:10px;border-radius:8px;border:1px solid #2A2A4A;background:#16213E;color:#FFF;font-size:18px;margin-top:4px"></div>';
    h += '<div style="margin-bottom:12px"><label style="color:#B0B0B0;font-size:13px">Opis:</label><br>';
    h += '<input type="text" id="cashbookDesc" placeholder="npr. Nabavka pića, Dule uzeo keš..." style="width:100%;padding:10px;border-radius:8px;border:1px solid #2A2A4A;background:#16213E;color:#FFF;font-size:15px;margin-top:4px"></div>';
    h += '</div>';

    showConfirm('📝 Novi Unos', h, function(confirmed) {
        if (!confirmed) return;

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
            amount: amount,
            description: desc,
            date: new Date().toISOString(),
            createdBy: DB.currentUser ? DB.currentUser.username : 'admin'
        });

        save();
        render();
        showAlert('✅ Unos dodat: ' + (type === 'income' ? '+' : '-') + amount.toFixed(0) + ' din');
    });
}

function deleteCashbookEntry(entryId) {
    const entry = (DB.cashbook || []).find(e => e.id === entryId);
    if (!entry) return;

    showConfirm('🗑️ Obriši Unos', 'Da li ste sigurni da želite da obrišete ovaj unos?\n\n' +
        (entry.type === 'income' ? 'Prihod' : 'Rashod') + ': ' + entry.amount.toFixed(0) + ' din\n' +
        (entry.description || 'Bez opisa'), function(confirmed) {
        if (!confirmed) return;

        DB.cashbook = DB.cashbook.filter(e => e.id !== entryId);
        DB._adminDeleteOverride = true;
        save();
        render();
        showAlert('✅ Unos obrisan');
    });
}
