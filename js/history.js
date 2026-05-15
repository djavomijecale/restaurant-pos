// ============================================
// HISTORY & EXPORT
// ============================================


// ============================================
// HISTORY PAGE - Istorijski Izveštaji
// ============================================

function renderHistory(c) {
    const isWaiter = DB.currentUser.role === 'waiter' || DB.currentUser.role === 'konobar';
    const currentUsername = DB.currentUser.username;
    
    // Date filter state
    if (!window.historyFilter) {
        const today = new Date();
        const lastMonth = new Date(today);
        lastMonth.setDate(today.getDate() - 30);
        
        window.historyFilter = {
            startDate: lastMonth.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0],
            viewMode: 'summary'  // summary, daily, orders, fiscal, sessions
        };
    }
    
    const filter = window.historyFilter;
    
    // Filter orders by date range
    let filteredOrders = DB.orders.filter(o => {
        if (!o || !o.time) return false;
        const orderDate = o.time.split('T')[0];
        return orderDate >= filter.startDate && orderDate <= filter.endDate;
    });
    
    // Filter workday sessions by date range
    let filteredSessions = (DB.workdayHistory || []).filter(s => {
        if (!s || !s.loginTime) return false;
        const sessionDate = s.loginTime.split('T')[0];
        return sessionDate >= filter.startDate && sessionDate <= filter.endDate;
    });
    
    
    // KONOBAR: Filtriraj SAMO njegove podatke + stare bez createdBy
    if (isWaiter) {
        filteredOrders = filteredOrders.filter(o => !o.createdBy || o.createdBy === currentUsername);
        filteredSessions = filteredSessions.filter(s => s.user === currentUsername);
    }
    
    // Calculate statistics
    const totalRevenue = filteredOrders.reduce((s,o)=>s+(o.tot||0),0);
    const totalOrders = filteredOrders.length;
    const cash = filteredOrders.filter(o=>o.method==='Cash').reduce((s,o)=>s+(o.tot||0),0);
    const card = filteredOrders.filter(o=>o.method==='Card').reduce((s,o)=>s+(o.tot||0),0);
    const fiscalOrders = filteredOrders.filter(o=>o.isFiscal);
    const fiscalTotal = fiscalOrders.reduce((s,o)=>s+(o.tot||0),0);
    const totalSessions = filteredSessions.length;
    
    // NOVA STATISTIKA - Plate i bonusi iz sesija
    const totalSalary = filteredSessions.reduce((s, session) => s + (session.salary || 0), 0);
    const totalBonus = filteredSessions.reduce((s, session) => s + (session.bonusAmount || 0), 0);
    const totalWorkHours = filteredSessions.reduce((s, session) => s + (session.duration || 0), 0) / 60;
    
    // Group by date
    const ordersByDate = {};
    filteredOrders.forEach(o => {
        const date = o.time.split('T')[0];
        if (!ordersByDate[date]) ordersByDate[date] = {orders: [], revenue: 0};
        ordersByDate[date].orders.push(o);
        ordersByDate[date].revenue += o.tot;
    });
    
    // Group by user
    const ordersByUser = {};
    filteredOrders.forEach(o => {
        const user = o.createdBy || 'Nepoznato';
        if (!ordersByUser[user]) ordersByUser[user] = {count: 0, revenue: 0};
        ordersByUser[user].count++;
        ordersByUser[user].revenue += o.tot;
    });
    
    let h = `
        <div style="max-width:1200px;margin:0 auto">
            <h2>📜 ${isWaiter ? 'Moja Istorija' : 'Istorija Izveštaja'}</h2>
            
            <!-- Date Filter -->
            <div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;align-items:end">
                    <div>
                        <label style="color:#B0B0B0;font-size:12px;display:block;margin-bottom:4px">Od datuma:</label>
                        <input type="date" id="startDate" value="${filter.startDate}" 
                            style="width:100%;padding:8px;border-radius:6px;border:1px solid #2A2A4A;background:#16213E;color:#FFF">
                    </div>
                    <div>
                        <label style="color:#B0B0B0;font-size:12px;display:block;margin-bottom:4px">Do datuma:</label>
                        <input type="date" id="endDate" value="${filter.endDate}"
                            style="width:100%;padding:8px;border-radius:6px;border:1px solid #2A2A4A;background:#16213E;color:#FFF">
                    </div>
                    <button class="btn" onclick="applyHistoryFilter()" style="height:36px">🔍 Primeni</button>
                    <button class="btn btn-secondary" onclick="setHistoryRangeAllTime()" style="height:36px" title="Postavi opseg na sve od početka rada aplikacije">📆 Sve vreme</button>
                    `;

    // Excel export SAMO ZA ADMINA
    if (!isWaiter) {
        h += `<button class="btn btn-secondary" onclick="exportHistoryToExcel()" style="height:36px">📊 Excel</button>`;
    }
    
    h += `
                </div>
            </div>
            
            <!-- View Mode Tabs -->
            <div style="display:flex;gap:8px;margin-bottom:20px;overflow-x:auto;flex-wrap:wrap">
                <button class="btn ${filter.viewMode==='summary'?'':'btn-secondary'}"
                    onclick="window.historyFilter.viewMode='summary';render()"
                    style="flex:1;min-width:100px">📊 Pregled</button>
                ${!isWaiter ? `<button class="btn ${filter.viewMode==='daily'?'':'btn-secondary'}"
                    onclick="window.historyFilter.viewMode='daily';render()"
                    style="flex:1;min-width:100px">📅 Dnevni</button>` : ''}
                <button class="btn ${filter.viewMode==='orders'?'':'btn-secondary'}"
                    onclick="window.historyFilter.viewMode='orders';render()"
                    style="flex:1;min-width:100px">📋 Narudžbine</button>
                <button class="btn ${filter.viewMode==='fiscal'?'':'btn-secondary'}"
                    onclick="window.historyFilter.viewMode='fiscal';render()"
                    style="flex:1;min-width:140px">🧾 Otkucani fiskalni</button>
                <button class="btn ${filter.viewMode==='sessions'?'':'btn-secondary'}"
                    onclick="window.historyFilter.viewMode='sessions';render()"
                    style="flex:1;min-width:100px">👥 Sesije</button>
            </div>
    `;

    // Render based on view mode
    if (filter.viewMode === 'summary') {
        h += renderHistorySummary(filteredOrders, filteredSessions, ordersByDate, ordersByUser, totalRevenue, cash, card, isWaiter, totalSalary, totalBonus, totalWorkHours, fiscalTotal, fiscalOrders.length);
    } else if (filter.viewMode === 'daily') {
        h += renderHistoryDaily(filteredOrders, filteredSessions, ordersByDate, isWaiter);
    } else if (filter.viewMode === 'orders') {
        h += renderHistoryOrders(filteredOrders);
    } else if (filter.viewMode === 'fiscal') {
        h += renderHistoryFiscalOrders(fiscalOrders, fiscalTotal);
    } else if (filter.viewMode === 'sessions') {
        h += renderHistorySessions(filteredSessions);
    }
    
    h += `</div>`;
    c.innerHTML = h;
}


function renderHistorySummary(orders, sessions, ordersByDate, ordersByUser, totalRevenue, cash, card, isWaiter, totalSalary, totalBonus, totalWorkHours, fiscalTotal, fiscalCount) {
    const avgOrder = orders.length > 0 ? (totalRevenue / orders.length) : 0;

    // ====== HRANA vs PIĆE ======
    // Stavke u narudžbini čuvaju kategoriju (item.cat). Sve što ima "pić"/"pic"
    // u kategoriji se broji kao piće, ostalo (Hrana, Dezert, itd.) kao hrana.
    // Diskonti se proporcionalno raspoređuju na stavke radi tačnijih cifara.
    const _isDrinkCat = function(cat) {
        if (!cat) return false;
        const c = String(cat).toLowerCase();
        return c.indexOf('pić') >= 0 || c.indexOf('pic') >= 0
            || c.indexOf('drink') >= 0 || c.indexOf('napit') >= 0;
    };
    let foodRev = 0, drinkRev = 0, otherRev = 0;
    let foodQty = 0, drinkQty = 0, otherQty = 0;
    const catBreakdown = {}; // {cat: {rev, qty}}
    const itemStats = {}; // {key: {name, cat, qty, rev}} - za top 10 najprodavanijih
    orders.forEach(function(o) {
        if (!o || !o.items || !Array.isArray(o.items)) return;
        // Proporcionalno raspoređivanje popusta po stavkama
        const sub = (o.sub != null ? o.sub : o.items.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0)) || 0;
        const disc = o.disc || 0;
        const discFactor = sub > 0 ? Math.max(0, (sub - disc) / sub) : 1;
        o.items.forEach(function(item) {
            if (!item) return;
            const q = Number(item.qty) || 0;
            const grossRev = (Number(item.price) || 0) * q;
            const netRev = grossRev * discFactor;
            const cat = item.cat || 'Neodređeno';
            if (!catBreakdown[cat]) catBreakdown[cat] = { rev: 0, qty: 0 };
            catBreakdown[cat].rev += netRev;
            catBreakdown[cat].qty += q;
            if (_isDrinkCat(cat)) {
                drinkRev += netRev;
                drinkQty += q;
            } else if (cat === 'Neodređeno') {
                otherRev += netRev;
                otherQty += q;
            } else {
                foodRev += netRev;
                foodQty += q;
            }
            // Agregat po artiklu (po ID-u, fallback na ime) - za top 10
            const itemKey = item.id != null ? String(item.id) : ('name:' + (item.name || '?'));
            if (!itemStats[itemKey]) {
                itemStats[itemKey] = { name: item.name || '?', cat: cat, qty: 0, rev: 0 };
            }
            itemStats[itemKey].qty += q;
            itemStats[itemKey].rev += netRev;
        });
    });
    const totalCategorizedRev = foodRev + drinkRev + otherRev;
    const foodPct = totalCategorizedRev > 0 ? (foodRev / totalCategorizedRev * 100) : 0;
    const drinkPct = totalCategorizedRev > 0 ? (drinkRev / totalCategorizedRev * 100) : 0;
    const otherPct = totalCategorizedRev > 0 ? (otherRev / totalCategorizedRev * 100) : 0;
    // Top 10 najprodavanijih (po količini)
    const topItems = Object.values(itemStats).sort(function(a, b) { return b.qty - a.qty; }).slice(0, 10);
    const maxTopQty = topItems.length > 0 ? topItems[0].qty : 0;

    // Pretraga artikla - spoji trenutni meni sa istorijskim artiklima (za artikle
    // koje je admin u međuvremenu obrisao iz menija, ali postoje u prošlim
    // narudžbinama).
    const _searchMenuMap = {};
    (DB.menu || []).forEach(function(m) {
        if (m && m.id != null) _searchMenuMap[String(m.id)] = { name: m.name || '?', cat: m.cat || '', deleted: false };
    });
    Object.entries(itemStats).forEach(function(entry) {
        const key = entry[0], s = entry[1];
        if (key.indexOf('name:') === 0) return; // skip ID-less items
        if (!_searchMenuMap[key]) {
            _searchMenuMap[key] = { name: s.name, cat: s.cat || '', deleted: true };
        }
    });
    const _sortedSearchMenu = Object.entries(_searchMenuMap).sort(function(a, b) {
        return (a[1].name || '').localeCompare(b[1].name || '', 'sr');
    });
    const _selectedSearchId = String(window.historySearchItemId || '');
    const _selectedItem = _selectedSearchId ? _searchMenuMap[_selectedSearchId] : null;
    const _selectedStats = _selectedSearchId ? itemStats[_selectedSearchId] : null;

    let h = `
        <!-- Summary Stats -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px">
            <div class="stat-card">
                <div class="stat-label">Ukupan prihod</div>
                <div class="stat-value">${totalRevenue.toFixed(0)}</div>
                <div class="stat-label">din.</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Narudžbi</div>
                <div class="stat-value" style="color:#E94560">${orders.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Prosečan račun</div>
                <div class="stat-value" style="color:#4CAF50">${avgOrder.toFixed(0)}</div>
                <div class="stat-label">din.</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Sesija</div>
                <div class="stat-value" style="color:#FFD700">${sessions.length}</div>
            </div>
        </div>
        
        <!-- Plate i Bonusi -->
        <div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#E94560;margin-bottom:16px">💰 Plate i Bonusi</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
                <div style="background:#16213E;padding:16px;border-radius:8px;text-align:center">
                    <div style="font-size:32px">💵</div>
                    <div style="color:#4CAF50;font-size:20px;font-weight:bold;margin:8px 0">${totalSalary.toFixed(0)} din.</div>
                    <div style="color:#B0B0B0;font-size:12px">Ukupne plate${totalWorkHours > 0 ? ` (${Math.round(totalSalary / totalWorkHours)}/sat)` : ''}</div>
                    <div style="color:#B0B0B0;font-size:11px;margin-top:4px">${totalWorkHours.toFixed(1)} sati rada</div>
                </div>
                <div style="background:#16213E;padding:16px;border-radius:8px;text-align:center">
                    <div style="font-size:32px">🎁</div>
                    <div style="color:#FFD700;font-size:20px;font-weight:bold;margin:8px 0">${totalBonus.toFixed(0)} din.</div>
                    <div style="color:#B0B0B0;font-size:12px">Ukupni bonusi</div>
                    <div style="color:#B0B0B0;font-size:11px;margin-top:4px">${sessions.filter(s=>s.bonusEarned).length} bonusa ostvareno</div>
                </div>
                <div style="background:#16213E;padding:16px;border-radius:8px;text-align:center">
                    <div style="font-size:32px">💎</div>
                    <div style="color:#FFD700;font-size:20px;font-weight:bold;margin:8px 0">${(totalSalary + totalBonus).toFixed(0)} din.</div>
                    <div style="color:#B0B0B0;font-size:12px">Ukupna zarada</div>
                    <div style="color:#B0B0B0;font-size:11px;margin-top:4px">Plata + Bonusi</div>
                </div>
            </div>
        </div>
        
        <!-- Payment Methods -->
        <div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#E94560;margin-bottom:16px">💳 Načini Plaćanja</h3>
            <div style="display:flex;gap:16px">
                <div style="flex:1;background:#16213E;padding:16px;border-radius:8px;text-align:center">
                    <div style="font-size:32px">💵</div>
                    <div style="color:#FFD700;font-size:20px;font-weight:bold;margin:8px 0">${cash.toFixed(0)} din.</div>
                    <div style="color:#B0B0B0;font-size:12px">Cash (${totalRevenue>0?Math.round(cash/totalRevenue*100):0}%)</div>
                </div>
                <div style="flex:1;background:#16213E;padding:16px;border-radius:8px;text-align:center">
                    <div style="font-size:32px">💳</div>
                    <div style="color:#FFD700;font-size:20px;font-weight:bold;margin:8px 0">${card.toFixed(0)} din.</div>
                    <div style="color:#B0B0B0;font-size:12px">Card (${totalRevenue>0?Math.round(card/totalRevenue*100):0}%)</div>
                </div>
            </div>
            ${fiscalCount > 0 ? `
            <div style="background:#16213E;padding:16px;border-radius:8px;text-align:center;margin-top:12px;border:1px solid #00BCD4">
                <div style="display:flex;align-items:center;justify-content:center;gap:12px">
                    <div style="font-size:28px">🧾</div>
                    <div>
                        <div style="color:#00BCD4;font-size:18px;font-weight:bold">${fiscalTotal.toFixed(0)} din.</div>
                        <div style="color:#B0B0B0;font-size:12px">Otkucani fiskalni (${fiscalCount} računa)</div>
                    </div>
                </div>
            </div>` : ''}
        </div>

        <!-- Hrana vs Piće -->
        <div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#E94560;margin-bottom:8px">🍽️ Hrana vs Piće</h3>
            <div style="color:#B0B0B0;font-size:12px;margin-bottom:16px">Udeo prodaje po kategorijama za izabrani period (popusti proporcionalno raspoređeni)</div>
            ${totalCategorizedRev === 0 ? `
                <div style="text-align:center;color:#888;padding:20px">Nema podataka za izabrani period</div>
            ` : `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
                <div style="background:#16213E;padding:16px;border-radius:8px;text-align:center;border:2px solid #FF9800">
                    <div style="font-size:32px">🍕</div>
                    <div style="color:#FF9800;font-size:24px;font-weight:bold;margin:8px 0">${foodPct.toFixed(1)}%</div>
                    <div style="color:#FFD700;font-size:16px;font-weight:bold">${foodRev.toFixed(0)} din.</div>
                    <div style="color:#B0B0B0;font-size:11px;margin-top:4px">Hrana · ${foodQty} stavki</div>
                </div>
                <div style="background:#16213E;padding:16px;border-radius:8px;text-align:center;border:2px solid #2196F3">
                    <div style="font-size:32px">🥤</div>
                    <div style="color:#2196F3;font-size:24px;font-weight:bold;margin:8px 0">${drinkPct.toFixed(1)}%</div>
                    <div style="color:#FFD700;font-size:16px;font-weight:bold">${drinkRev.toFixed(0)} din.</div>
                    <div style="color:#B0B0B0;font-size:11px;margin-top:4px">Piće · ${drinkQty} stavki</div>
                </div>
                ${otherRev > 0 ? `<div style="background:#16213E;padding:16px;border-radius:8px;text-align:center;border:2px solid #888">
                    <div style="font-size:32px">❓</div>
                    <div style="color:#888;font-size:24px;font-weight:bold;margin:8px 0">${otherPct.toFixed(1)}%</div>
                    <div style="color:#FFD700;font-size:16px;font-weight:bold">${otherRev.toFixed(0)} din.</div>
                    <div style="color:#B0B0B0;font-size:11px;margin-top:4px">Neodređeno · ${otherQty} stavki</div>
                </div>` : ''}
            </div>
            <!-- Progress bar -->
            <div style="height:12px;background:#16213E;border-radius:6px;overflow:hidden;display:flex;margin-bottom:16px">
                <div style="width:${foodPct}%;background:#FF9800" title="Hrana ${foodPct.toFixed(1)}%"></div>
                <div style="width:${drinkPct}%;background:#2196F3" title="Piće ${drinkPct.toFixed(1)}%"></div>
                ${otherPct > 0 ? `<div style="width:${otherPct}%;background:#888" title="Neodređeno ${otherPct.toFixed(1)}%"></div>` : ''}
            </div>
            <!-- Detaljni breakdown po kategorijama -->
            <details style="background:#16213E;padding:12px;border-radius:8px">
                <summary style="cursor:pointer;color:#B0B0B0;font-size:13px">📋 Detaljno po kategorijama</summary>
                <div style="margin-top:12px">
                    ${Object.entries(catBreakdown).sort((a, b) => b[1].rev - a[1].rev).map(([cat, data]) => {
                        const pct = totalCategorizedRev > 0 ? (data.rev / totalCategorizedRev * 100) : 0;
                        const isDrink = _isDrinkCat(cat);
                        const color = isDrink ? '#2196F3' : (cat === 'Neodređeno' ? '#888' : '#FF9800');
                        return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #2A2A4A">
                            <span style="color:${color};font-weight:bold">${cat}</span>
                            <span style="color:#B0B0B0;font-size:12px">${data.qty} stavki</span>
                            <span style="color:#FFD700;font-weight:bold">${data.rev.toFixed(0)} din.</span>
                            <span style="color:#B0B0B0;min-width:55px;text-align:right">${pct.toFixed(1)}%</span>
                        </div>`;
                    }).join('')}
                </div>
            </details>
            `}
        </div>

        <!-- Top 10 Najprodavanijih Artikala -->
        <div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#E94560;margin-bottom:8px">🏆 Top 10 Najprodavanijih Artikala</h3>
            <div style="color:#B0B0B0;font-size:12px;margin-bottom:16px">Po količini prodatih komada za izabrani period</div>
            ${topItems.length === 0 ? `
                <div style="text-align:center;color:#888;padding:20px">Nema podataka za izabrani period</div>
            ` : `
            <div>
                ${topItems.map(function(item, idx) {
                    const isDrink = _isDrinkCat(item.cat);
                    const accent = isDrink ? '#2196F3' : (item.cat === 'Neodređeno' ? '#888' : '#FF9800');
                    const icon = isDrink ? '🥤' : (item.cat === 'Neodređeno' ? '❓' : '🍕');
                    const badge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1) + '.';
                    const barPct = maxTopQty > 0 ? (item.qty / maxTopQty * 100) : 0;
                    const avgPrice = item.qty > 0 ? (item.rev / item.qty) : 0;
                    return `<div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px">
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
                            <div style="display:flex;align-items:center;gap:10px;min-width:180px;flex:2">
                                <span style="font-size:20px;min-width:30px;text-align:center">${badge}</span>
                                <span style="font-size:20px">${icon}</span>
                                <div>
                                    <div style="color:#FFD700;font-weight:bold">${item.name}</div>
                                    <div style="color:${accent};font-size:11px">${item.cat}</div>
                                </div>
                            </div>
                            <div style="text-align:right;min-width:140px;flex:1">
                                <div style="color:#4CAF50;font-size:18px;font-weight:bold">${item.qty} kom.</div>
                                <div style="color:#B0B0B0;font-size:11px">${item.rev.toFixed(0)} din. · ⌀ ${avgPrice.toFixed(0)} din.</div>
                            </div>
                        </div>
                        <div style="height:6px;background:#0F3460;border-radius:3px;overflow:hidden;margin-top:8px">
                            <div style="width:${barPct}%;height:100%;background:linear-gradient(90deg, ${accent}, #FFD700)"></div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
            `}
        </div>

        <!-- Pretraga Artikla -->
        <div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#E94560;margin-bottom:8px">🔍 Pretraga Artikla</h3>
            <div style="color:#B0B0B0;font-size:12px;margin-bottom:16px">Odaberi artikal da vidiš koliko je prodato u izabranom periodu</div>
            <select id="historyItemSelector" onchange="window.historySearchItemId=this.value;render()"
                style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px;margin-bottom:12px">
                <option value="">-- Izaberi artikal --</option>
                ${_sortedSearchMenu.map(function(entry) {
                    const id = entry[0], m = entry[1];
                    const sel = id === _selectedSearchId ? 'selected' : '';
                    const label = m.name + (m.cat ? ' (' + m.cat + ')' : '') + (m.deleted ? ' — [obrisano iz menija]' : '');
                    return `<option value="${id}" ${sel}>${label}</option>`;
                }).join('')}
            </select>
            ${_selectedSearchId && _selectedItem ? (function() {
                if (!_selectedStats || _selectedStats.qty === 0) {
                    return `<div style="background:#16213E;padding:16px;border-radius:8px;text-align:center">
                        <div style="color:#FFD700;font-size:18px;font-weight:bold;margin-bottom:4px">${_selectedItem.name}</div>
                        <div style="color:#B0B0B0;font-size:13px;margin-bottom:8px">${_selectedItem.cat || 'Bez kategorije'}${_selectedItem.deleted ? ' · [obrisano iz menija]' : ''}</div>
                        <div style="color:#E94560;padding:12px">Nije prodato nijednom u izabranom periodu</div>
                    </div>`;
                }
                const avgPrice = _selectedStats.qty > 0 ? (_selectedStats.rev / _selectedStats.qty) : 0;
                const pctOfTotal = totalCategorizedRev > 0 ? (_selectedStats.rev / totalCategorizedRev * 100) : 0;
                const isDrink = _isDrinkCat(_selectedItem.cat);
                const accent = isDrink ? '#2196F3' : (_selectedItem.cat === 'Neodređeno' || !_selectedItem.cat ? '#888' : '#FF9800');
                const icon = isDrink ? '🥤' : (_selectedItem.cat === 'Neodređeno' || !_selectedItem.cat ? '❓' : '🍕');
                // Rank u top listi (sortirano po qty)
                const allItemsSorted = Object.entries(itemStats).sort(function(a, b) { return b[1].qty - a[1].qty; });
                const rank = allItemsSorted.findIndex(function(e) { return e[0] === _selectedSearchId; }) + 1;
                return `<div style="background:#16213E;padding:16px;border-radius:8px">
                    <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap;margin-bottom:12px">
                        <div style="display:flex;align-items:center;gap:10px;min-width:200px;flex:2">
                            <span style="font-size:32px">${icon}</span>
                            <div>
                                <div style="color:#FFD700;font-size:20px;font-weight:bold">${_selectedItem.name}</div>
                                <div style="color:${accent};font-size:13px">${_selectedItem.cat || 'Bez kategorije'}${_selectedItem.deleted ? ' · [obrisano iz menija]' : ''}</div>
                                ${rank > 0 && rank <= allItemsSorted.length ? `<div style="color:#B0B0B0;font-size:11px;margin-top:2px">${rank === 1 ? '🥇 Najprodavanije!' : rank === 2 ? '🥈 2. mesto' : rank === 3 ? '🥉 3. mesto' : 'Pozicija: ' + rank + '. od ' + allItemsSorted.length + ' artikala'}</div>` : ''}
                            </div>
                        </div>
                        <div style="text-align:right;min-width:140px;flex:1">
                            <div style="color:#4CAF50;font-size:36px;font-weight:bold;line-height:1">${_selectedStats.qty}</div>
                            <div style="color:#B0B0B0;font-size:12px;margin-top:4px">prodatih komada</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">
                        <div style="background:#0F3460;padding:10px;border-radius:6px;text-align:center">
                            <div style="color:#FFD700;font-size:16px;font-weight:bold">${_selectedStats.rev.toFixed(0)} din.</div>
                            <div style="color:#B0B0B0;font-size:11px">Ukupan promet</div>
                        </div>
                        <div style="background:#0F3460;padding:10px;border-radius:6px;text-align:center">
                            <div style="color:#FFD700;font-size:16px;font-weight:bold">${avgPrice.toFixed(0)} din.</div>
                            <div style="color:#B0B0B0;font-size:11px">⌀ cena po komadu</div>
                        </div>
                        <div style="background:#0F3460;padding:10px;border-radius:6px;text-align:center">
                            <div style="color:#FFD700;font-size:16px;font-weight:bold">${pctOfTotal.toFixed(2)}%</div>
                            <div style="color:#B0B0B0;font-size:11px">Udeo prometa</div>
                        </div>
                    </div>
                </div>`;
            })() : ''}
        </div>

        <!-- By User - SAMO ZA ADMINA -->`;
    
    if (!isWaiter) {
        h += `
        <div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#E94560;margin-bottom:16px">👥 Po Konobarima</h3>
    `;
    
    const sortedUsers = Object.entries(ordersByUser).sort((a, b) => b[1].revenue - a[1].revenue);
    sortedUsers.forEach(([user, data], index) => {
        const percent = totalRevenue > 0 ? Math.round(data.revenue / totalRevenue * 100) : 0;
        const avgOrder = data.count > 0 ? (data.revenue / data.count).toFixed(0) : 0;
        const badge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        
        h += `
            <div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="font-size:20px">${badge}</span>
                        <div>
                            <div style="color:#FFD700;font-weight:bold">${user}</div>
                            <div style="color:#B0B0B0;font-size:11px">${data.count} narudžbina · ${avgOrder} din. prosek</div>
                        </div>
                    </div>
                    <div style="text-align:right">
                        <div style="color:#4CAF50;font-size:18px;font-weight:bold">${data.revenue.toFixed(0)} din.</div>
                        <div style="color:#B0B0B0;font-size:11px">${percent}%</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    h += `</div>`;
    }
    
    h += `</div>`;  // Zatvori ostatak
    
    // By Date
    h += `
        <div style="background:#0F3460;padding:20px;border-radius:12px">
            <h3 style="color:#E94560;margin-bottom:16px">📅 Po Danima</h3>
    `;
    
    const sortedDates = Object.entries(ordersByDate).sort((a, b) => b[0].localeCompare(a[0]));
    sortedDates.slice(0, 10).forEach(([date, data]) => {
        const dateObj = new Date(date);
        const formatted = dateObj.toLocaleDateString('sr-RS', {weekday: 'short', day: 'numeric', month: 'short'});
        
        h += `
            <div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="window.historyDailyDate='${date}';window.historyFilter.viewMode='daily';render()">
                <div>
                    <div style="color:#FFD700;font-weight:bold">${formatted}</div>
                    <div style="color:#B0B0B0;font-size:11px">${data.orders.length} narudžbina</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                    <div style="color:#4CAF50;font-size:18px;font-weight:bold">${data.revenue.toFixed(0)} din.</div>
                    <div style="color:#888;font-size:16px">→</div>
                </div>
            </div>
        `;
    });
    
    if (sortedDates.length > 10) {
        h += `<div style="color:#B0B0B0;text-align:center;margin-top:12px;font-size:12px">... i još ${sortedDates.length - 10} dana</div>`;
    }
    
    h += `</div>`;
    
    return h;
}


function renderHistoryOrders(orders) {
    const sortedOrders = [...orders].sort((a, b) => b.time.localeCompare(a.time));

    let h = `
        <div style="background:#0F3460;padding:20px;border-radius:12px">
            <h3 style="color:#E94560;margin-bottom:16px">📋 Sve Narudžbine (${orders.length})</h3>
    `;

    if (sortedOrders.length === 0) {
        h += `<div style="text-align:center;color:#B0B0B0;padding:40px">Nema narudžbina za izabrani period</div>`;
    } else {
        sortedOrders.forEach(o => {
            const date = new Date(o.time);
            const formatted = date.toLocaleString('sr-RS', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            const isAdmin = DB.currentUser && DB.currentUser.role === 'admin';

            h += `
                <div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px">
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                        <div>
                            <div style="color:#FFD700;font-weight:bold">Narudžbina #${o.id}${o.isFiscal ? ' <span style="background:#4CAF50;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:bold">🧾 Otkucan fiskalni</span>' : ''}</div>
                            <div style="color:#B0B0B0;font-size:11px">${formatted} · ${o.createdBy || 'Nepoznato'}</div>
                        </div>
                        <div style="display:flex;align-items:start;gap:8px">
                            <div style="text-align:right">
                                <div style="color:#4CAF50;font-size:18px;font-weight:bold">${o.tot.toFixed(0)} din.</div>
                                <div style="color:#B0B0B0;font-size:11px">${o.method}</div>
                            </div>
                            ${isAdmin ? '<button onclick="deleteOrder(\'' + o.id + '\')" style="background:none;border:none;color:#E94560;font-size:18px;cursor:pointer;padding:4px" title="Obriši narudžbinu">🗑️</button>' : ''}
                        </div>
                    </div>
                    <div style="color:#B0B0B0;font-size:12px">
                        ${o.items.map(it => it.name + ' x' + it.qty).join(', ')}
                    </div>
                </div>
            `;
        });
    }

    h += `</div>`;
    return h;
}


function renderHistoryFiscalOrders(fiscalOrders, fiscalTotal) {
    const sortedOrders = [...fiscalOrders].sort((a, b) => b.time.localeCompare(a.time));
    const isAdmin = DB.currentUser && DB.currentUser.role === 'admin';

    let h = `
        <div style="background:#0F3460;padding:20px;border-radius:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
                <h3 style="color:#E94560;margin:0">🧾 Otkucani Fiskalni Računi (${fiscalOrders.length})</h3>
                <div style="color:#4CAF50;font-size:18px;font-weight:bold">Ukupno: ${(fiscalTotal || 0).toFixed(0)} din.</div>
            </div>
    `;

    if (sortedOrders.length === 0) {
        h += `<div style="text-align:center;color:#B0B0B0;padding:40px">
                <div style="font-size:48px;margin-bottom:12px">🧾</div>
                <div>Nema otkucanih fiskalnih računa za izabrani period</div>
            </div>`;
    } else {
        sortedOrders.forEach(o => {
            const date = new Date(o.time);
            const formatted = date.toLocaleString('sr-RS', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const tableName = o.tableName || ('Sto ' + o.table);

            h += `
                <div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px;border-left:4px solid #4CAF50">
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                        <div>
                            <div style="color:#FFD700;font-weight:bold">${tableName} · Narudžbina #${o.id} <span style="background:#4CAF50;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:bold">🧾 Otkucan fiskalni</span></div>
                            <div style="color:#B0B0B0;font-size:11px">${formatted} · ${o.createdBy || 'Nepoznato'}</div>
                        </div>
                        <div style="display:flex;align-items:start;gap:8px">
                            <div style="text-align:right">
                                <div style="color:#4CAF50;font-size:18px;font-weight:bold">${o.tot.toFixed(0)} din.</div>
                                <div style="color:#B0B0B0;font-size:11px">${o.method}</div>
                            </div>
                            ${isAdmin ? '<button onclick="deleteOrder(\'' + o.id + '\')" style="background:none;border:none;color:#E94560;font-size:18px;cursor:pointer;padding:4px" title="Obriši narudžbinu">🗑️</button>' : ''}
                        </div>
                    </div>
                    <div style="color:#B0B0B0;font-size:12px">
                        ${o.items.map(it => it.name + ' x' + it.qty).join(', ')}
                    </div>
                </div>
            `;
        });
    }

    h += `</div>`;
    return h;
}


function renderHistorySessions(sessions) {
    const sortedSessions = [...sessions].filter(s => s && s.loginTime).sort((a, b) => b.loginTime.localeCompare(a.loginTime));
    
    let h = `
        <div style="background:#0F3460;padding:20px;border-radius:12px">
            <h3 style="color:#E94560;margin-bottom:16px">👥 Sve Sesije (${sessions.length})</h3>
    `;
    
    if (sortedSessions.length === 0) {
        h += `<div style="text-align:center;color:#B0B0B0;padding:40px">Nema sesija za izabrani period</div>`;
    } else {
        sortedSessions.forEach(s => {
            try {
            const loginDate = new Date(s.loginTime);
            const logoutDate = s.logoutTime ? new Date(s.logoutTime) : null;

            const dateStr = loginDate.toLocaleDateString('sr-RS', {day: 'numeric', month: 'short', year: 'numeric'});
            const loginTime = loginDate.toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
            const logoutTime = logoutDate ? logoutDate.toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'}) : '—';

            const duration = s.duration || 0;
            const hours = Math.floor(duration / 60);
            const mins = duration % 60;
            const durationStr = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;

            // KUVAR: posebno renderovanje (nema novčane statistike, ima jela/narudžbine)
            if (s.role === 'kuvar') {
                const dishes = s.dishesCompleted || 0;
                const ordersProcessed = s.ordersProcessed || 0;
                const totalOrders = s.totalOrders || 0;
                const hasDishList = Array.isArray(s.dishes) && s.dishes.length > 0;
                const clickHint = hasDishList ? '<span style="color:#FF9800;font-size:10px;margin-left:6px">▸ klikni za detalje</span>' : '';
                const cursorStyle = hasDishList ? 'cursor:pointer;' : '';
                const onclickAttr = hasDishList ? `onclick="showKuvarSessionDishes('${(s.loginTime||'').replace(/'/g,"\\'")}','${(s.user||'').replace(/'/g,"\\'")}')"` : '';
                h += `
                    <div ${onclickAttr} style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px;border-left:3px solid #FF9800;${cursorStyle}">
                        <div style="display:flex;justify-content:space-between;align-items:start">
                            <div style="flex:1">
                                <div style="color:#FFD700;font-weight:bold">🍳 ${s.user || 'Nepoznato'} <span style="background:#FF9800;color:#FFF;padding:2px 8px;border-radius:8px;font-size:10px;margin-left:8px">KUVAR</span>${clickHint}</div>
                                <div style="color:#B0B0B0;font-size:11px">${dateStr}</div>
                                <div style="color:#FFF;font-size:12px;margin-top:4px">
                                    🔓 ${loginTime} → 🔒 ${logoutTime} · ${durationStr}
                                </div>
                                <div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap">
                                    <span style="color:#4CAF50;font-size:12px;font-weight:bold">🍽️ ${dishes} jela</span>
                                    <span style="color:#2196F3;font-size:12px;font-weight:bold">✅ ${ordersProcessed} završeno</span>
                                    <span style="color:#888;font-size:12px">📋 ${totalOrders} narudž.</span>
                                </div>
                            </div>
                            <div style="text-align:right">
                                <div style="color:#FF9800;font-size:18px;font-weight:bold">${dishes}</div>
                                <div style="color:#B0B0B0;font-size:11px">jela</div>
                            </div>
                        </div>
                    </div>
                `;
                return;
            }

            // Izračunaj keš/kartice iz narudžbina za ovu sesiju
            const sessionOrders = DB.orders.filter(o =>
                o.createdBy === s.user &&
                o.time >= s.loginTime &&
                (!s.logoutTime || o.time <= s.logoutTime)
            );
            const sessionCash = sessionOrders.filter(o => o.method === 'Cash').reduce((sum, o) => sum + o.tot, 0);
            const sessionCard = sessionOrders.filter(o => o.method === 'Card').reduce((sum, o) => sum + o.tot, 0);
            const sessionWire = sessionOrders.filter(o => o.method === 'Wire').reduce((sum, o) => sum + o.tot, 0);
            
            // BONUS INDIKATOR
            const bonusBadge = s.bonusEarned ? 
                `<div style="background:linear-gradient(135deg, #FFD700 0%, #FFA500 100%);color:#000;padding:6px 12px;border-radius:20px;font-size:11px;font-weight:bold;margin-top:8px;display:inline-block;box-shadow:0 2px 8px rgba(255,215,0,0.3)">
                    🎁 BONUS: ${(s.bonusAmount||0).toFixed(0)} din.
                </div>` : '';
            
            // PLATA INDIKATOR
            const salaryBadge = s.salary ? 
                `<div style="background:#4CAF50;color:#FFF;padding:6px 12px;border-radius:20px;font-size:11px;font-weight:bold;margin-top:8px;display:inline-block;margin-left:${s.bonusEarned ? '8px' : '0'}">
                    💰 PLATA: ${s.salary.toFixed(0)} din.
                </div>` : '';
            
            // DEPOZIT INDIKATOR
            const depositBadge = s.deposit && s.deposit > 0 ? 
                `<div style="background:#9C27B0;color:#FFF;padding:6px 12px;border-radius:20px;font-size:11px;font-weight:bold;margin-top:8px;display:inline-block;margin-left:${s.bonusEarned || s.salary ? '8px' : '0'}">
                    💵 DEPOZIT: ${s.deposit.toFixed(0)} din.
                </div>` : '';
            
            const shiftBadge = s.isFirstShift ? 
                '<span style="background:#4CAF50;color:#FFF;padding:2px 8px;border-radius:8px;font-size:10px;margin-left:8px">Prva smena</span>' : 
                (s.isSecondShift ? '<span style="background:#9C27B0;color:#FFF;padding:2px 8px;border-radius:8px;font-size:10px;margin-left:8px">Druga smena</span>' : '');
            
            const autoClosedBadge = s.autoClosed ? ' <span style="color:#FF9800;font-size:10px">⏰ AUTO</span>' : '';
            
            h += `
                <div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px;${s.bonusEarned ? 'border:2px solid #FFD700;' : ''}">
                    <div style="display:flex;justify-content:space-between;align-items:start">
                        <div style="flex:1">
                            <div style="color:#FFD700;font-weight:bold">👨‍🍳 ${s.user || 'Nepoznato'}${shiftBadge}${autoClosedBadge}</div>
                            <div style="color:#B0B0B0;font-size:11px">${dateStr}</div>
                            <div style="color:#FFF;font-size:12px;margin-top:4px">
                                🔓 ${loginTime} → 🔒 ${logoutTime} · ${durationStr}
                            </div>
                            <div style="display:flex;gap:12px;margin-top:6px">
                                <span style="color:#4CAF50;font-size:12px;font-weight:bold">💵 ${sessionCash.toFixed(0)} din</span>
                                <span style="color:#2196F3;font-size:12px;font-weight:bold">💳 ${sessionCard.toFixed(0)} din</span>
                                ${sessionWire > 0 ? '<span style="color:#9C27B0;font-size:12px;font-weight:bold">🏦 ' + sessionWire.toFixed(0) + ' din</span>' : ''}
                                <span style="color:#888;font-size:12px">${sessionOrders.length} narudž.</span>
                            </div>
                            ${bonusBadge}${salaryBadge}${depositBadge}
                        </div>
                        <div style="text-align:right">
                            <div style="color:#4CAF50;font-size:18px;font-weight:bold">${(s.revenue || 0).toFixed(0)} din.</div>
                            <div style="color:#B0B0B0;font-size:11px">ukupno</div>
                            ${s.deposit && s.deposit > 0 ? `<div style="color:#9C27B0;font-size:10px;margin-top:2px">dep. ${(s.deposit||0).toFixed(0)}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
            } catch(e) { console.error('Session render error:', e, s); }
        });
    }
    
    h += `</div>`;
    return h;
}


// ============================================
// DNEVNI IZVEŠTAJ ZA ODABRANI DAN
// ============================================
function renderHistoryDaily(allOrders, allSessions, ordersByDate, isWaiter) {
    var selectedDay = window.historyDailyDate || window.historyFilter.endDate;
    
    var h = '<div style="background:#0F3460;padding:16px;border-radius:12px;margin-bottom:16px">';
    h += '<div style="display:flex;align-items:center;gap:8px">';
    h += '<button class="btn btn-secondary" onclick="var d=new Date(\'' + selectedDay + '\');d.setDate(d.getDate()-1);window.historyDailyDate=d.toISOString().split(\'T\')[0];render()" style="padding:8px 14px;font-size:18px">◀</button>';
    h += '<input type="date" id="dailyReportDate" value="' + selectedDay + '" onchange="window.historyDailyDate=this.value;render()" style="flex:1;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px;text-align:center">';
    h += '<button class="btn btn-secondary" onclick="var d=new Date(\'' + selectedDay + '\');d.setDate(d.getDate()+1);window.historyDailyDate=d.toISOString().split(\'T\')[0];render()" style="padding:8px 14px;font-size:18px">▶</button>';
    h += '</div></div>';
    
    // Business day: 7:00 - 7:00
    var cutoff = typeof DAILY_CUTOFF_HOUR !== 'undefined' ? DAILY_CUTOFF_HOUR : 7;
    var dayDate = new Date(selectedDay);
    var bdStart = new Date(dayDate); bdStart.setHours(cutoff, 0, 0, 0);
    var bdEnd = new Date(dayDate); bdEnd.setDate(bdEnd.getDate() + 1); bdEnd.setHours(cutoff, 0, 0, 0);
    var bdStartISO = bdStart.toISOString();
    var bdEndISO = bdEnd.toISOString();
    
    var dayOrders = allOrders.filter(function(o) { return o.time >= bdStartISO && o.time < bdEndISO; });
    var daySessions = allSessions.filter(function(s) { return s.loginTime >= bdStartISO && s.loginTime < bdEndISO; });

    // Dodaj aktivne (otvorene) smene za ovaj dan
    if (DB.workdays && typeof DB.workdays === 'object') {
        Object.keys(DB.workdays).forEach(function(username) {
            var wd = DB.workdays[username];
            if (wd && wd.startTime && wd.startTime >= bdStartISO && wd.startTime < bdEndISO) {
                // Proveri da vec nije u daySessions
                var alreadyExists = daySessions.some(function(s) { return s.loginTime === wd.startTime && s.user === wd.user; });
                if (!alreadyExists) {
                    var reductions = wd.cashReductions || [];
                    var totalRed = reductions.reduce(function(s, r) { return s + (r.amount || 0); }, 0);
                    daySessions.push({
                        user: wd.user || username,
                        loginTime: wd.startTime,
                        logoutTime: null,
                        duration: 0,
                        deposit: wd.deposit || 0,
                        cashReductions: reductions,
                        totalCashReductions: totalRed,
                        salary: 0,
                        isActive: true
                    });
                }
            }
        });
    }
    
    var realOrders = dayOrders.filter(function(o) { return !o.isDebtPayment; });
    var debtOrders = dayOrders.filter(function(o) { return o.isDebtPayment; });
    
    var totalRevenue = realOrders.reduce(function(s, o) { return s + o.tot; }, 0);
    var totalCash = realOrders.filter(function(o) { return o.method === 'Cash'; }).reduce(function(s, o) { return s + o.tot; }, 0);
    var totalCard = realOrders.filter(function(o) { return o.method === 'Card'; }).reduce(function(s, o) { return s + o.tot; }, 0);
    var totalWire = realOrders.filter(function(o) { return o.method === 'Wire'; }).reduce(function(s, o) { return s + o.tot; }, 0);
    var debtCash = debtOrders.filter(function(o) { return o.method === 'Cash'; }).reduce(function(s, o) { return s + o.tot; }, 0);
    var debtCard = debtOrders.filter(function(o) { return o.method !== 'Cash'; }).reduce(function(s, o) { return s + o.tot; }, 0);
    
    // ✅ BUG FIX (od 12.5 depozit 0): kuvar smene nemaju deposit polje i ne
    // smeju da uđu u "prva smena dana" rachunicu. Bez ovog filtera, kad
    // kuvar otvori smenu pre konobara, kuvar ima loginTime ranije od konobara,
    // sortedSessions[0] postaje kuvar, .deposit je undefined → prikaže 0 din
    // i depozit konobara "nestane" iz dnevnog izveštaja. Isti fix je već u
    // report.js (commit 4b47dee) za današnji izveštaj — ovaj propust pokriva
    // istorijske dnevne izveštaje.
    var _isKuvarShift = function(s) {
        if (!s) return false;
        if (s.role === 'kuvar') return true;
        var u = (DB.users || []).find(function(x) { return x.username === s.user; });
        return !!(u && u.role === 'kuvar');
    };
    var konobarSessions = daySessions.filter(function(s) { return !_isKuvarShift(s); });
    var sortedSessions = konobarSessions.slice().sort(function(a, b) { return a.loginTime.localeCompare(b.loginTime); });
    var deposit = sortedSessions.length > 0 ? (sortedSessions[0].deposit || 0) : 0;
    // Smanjenja keša: takođe samo od konobarskih smena (kuvari ne uzimaju
    // iz keša konobara, a u praksi nemaju ovo polje)
    var totalReductions = konobarSessions.reduce(function(s, ses) { return s + (ses.totalCashReductions || 0); }, 0);
    var cashInRegister = deposit + totalCash + debtCash - totalReductions;
    
    var totalSalary = daySessions.reduce(function(s, ses) { return s + (ses.salary || 0); }, 0);
    var totalBonus = daySessions.reduce(function(s, ses) { return s + (ses.bonusAmount || 0); }, 0);
    var totalHours = daySessions.reduce(function(s, ses) { return s + (ses.duration || 0); }, 0) / 60;
    
    var dayName = dayDate.toLocaleDateString('sr-RS', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});
    h += '<h3 style="text-align:center;color:#FFD700;margin-bottom:16px">' + dayName + '</h3>';
    
    if (realOrders.length === 0 && daySessions.length === 0) {
        h += '<div style="text-align:center;color:#888;padding:40px;background:#0F3460;border-radius:12px">Nema podataka za ovaj dan</div>';
        return h;
    }
    
    // GLAVNI BROJEVI
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px">';
    h += '<div class="stat-card"><div class="stat-label">Ukupan prihod</div><div class="stat-value">' + totalRevenue.toFixed(0) + '</div><div class="stat-label">din.</div></div>';
    h += '<div class="stat-card"><div class="stat-label">Narudžbi</div><div class="stat-value" style="color:#E94560">' + realOrders.length + '</div></div>';
    h += '<div class="stat-card"><div class="stat-label">Prosečan račun</div><div class="stat-value" style="color:#4CAF50">' + (realOrders.length > 0 ? (totalRevenue / realOrders.length).toFixed(0) : 0) + '</div><div class="stat-label">din.</div></div>';
    h += '<div class="stat-card"><div class="stat-label">Smena</div><div class="stat-value" style="color:#FFD700">' + daySessions.length + '</div></div>';
    h += '</div>';
    
    // KEŠ U KASI
    h += '<div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:16px">';
    h += '<h3 style="color:#E94560;margin-bottom:16px">💰 Stanje Kase</h3>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:16px">';
    h += '<div style="background:#16213E;padding:14px;border-radius:8px;text-align:center"><div style="font-size:24px">💵</div><div style="color:#FFD700;font-size:20px;font-weight:bold;margin:6px 0">' + cashInRegister.toFixed(0) + '</div><div style="color:#888;font-size:11px">Keš u kasi</div></div>';
    h += '<div style="background:#16213E;padding:14px;border-radius:8px;text-align:center"><div style="font-size:24px">💳</div><div style="color:#FFD700;font-size:20px;font-weight:bold;margin:6px 0">' + (totalCard + debtCard).toFixed(0) + '</div><div style="color:#888;font-size:11px">Kartice</div></div>';
    if (totalWire > 0) {
        h += '<div style="background:#16213E;padding:14px;border-radius:8px;text-align:center"><div style="font-size:24px">🏦</div><div style="color:#FFD700;font-size:20px;font-weight:bold;margin:6px 0">' + totalWire.toFixed(0) + '</div><div style="color:#888;font-size:11px">Prenos</div></div>';
    }
    h += '</div>';
    
    // Detalji keša
    h += '<div style="background:#16213E;padding:12px;border-radius:8px">';
    h += '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#888;font-size:13px">💵 Depozit:</span><span style="color:#9C27B0;font-weight:bold">' + deposit.toFixed(0) + ' din.</span></div>';
    h += '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#888;font-size:13px">💵 Otkucani keš:</span><span style="color:#4CAF50;font-weight:bold">+' + totalCash.toFixed(0) + ' din.</span></div>';
    if (debtCash > 0) h += '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#888;font-size:13px">📝 Vraćeni dugovi (keš):</span><span style="color:#FF9800;font-weight:bold">+' + debtCash.toFixed(0) + ' din.</span></div>';
    if (totalReductions > 0) {
        h += '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#888;font-size:13px">💸 Smanjenja keša:</span><span style="color:#E94560;font-weight:bold">-' + totalReductions.toFixed(0) + ' din.</span></div>';
        // Detalji svakog smanjenja
        var allReductions = [];
        daySessions.forEach(function(ses) {
            if (ses.cashReductions && ses.cashReductions.length > 0) {
                ses.cashReductions.forEach(function(r) { allReductions.push({amount: r.amount, reason: r.reason, timestamp: r.timestamp, user: ses.user || r.createdBy || ''}); });
            }
        });
        if (allReductions.length > 0) {
            h += '<div style="margin:4px 0 8px 12px">';
            allReductions.forEach(function(r) {
                var time = r.timestamp ? new Date(r.timestamp).toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'}) : '';
                h += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;color:#B0B0B0">';
                h += '<span>' + (time ? time + ' · ' : '') + (r.user ? r.user + ' · ' : '') + (r.reason || 'Bez opisa') + '</span>';
                h += '<span style="color:#E94560">-' + (r.amount || 0).toFixed(0) + ' din.</span>';
                h += '</div>';
            });
            h += '</div>';
        }
    }
    h += '<div style="border-top:1px solid #2A2A4A;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between"><span style="color:#FFD700;font-weight:bold">= Keš u kasi:</span><span style="color:#FFD700;font-weight:bold;font-size:16px">' + cashInRegister.toFixed(0) + ' din.</span></div>';
    h += '</div></div>';
    
    // PO KONOBARIMA
    if (!isWaiter) {
        var byWaiter = {};
        realOrders.forEach(function(o) {
            var user = o.createdBy || 'Nepoznato';
            if (!byWaiter[user]) byWaiter[user] = { count: 0, revenue: 0, cash: 0, card: 0, wire: 0 };
            byWaiter[user].count++;
            byWaiter[user].revenue += o.tot;
            if (o.method === 'Cash') byWaiter[user].cash += o.tot;
            else if (o.method === 'Card') byWaiter[user].card += o.tot;
            else if (o.method === 'Wire') byWaiter[user].wire += o.tot;
        });
        
        h += '<div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:16px">';
        h += '<h3 style="color:#E94560;margin-bottom:16px">👥 Po Konobarima</h3>';
        
        Object.entries(byWaiter).sort(function(a, b) { return b[1].revenue - a[1].revenue; }).forEach(function(entry) {
            var user = entry[0], data = entry[1];
            var ses = daySessions.find(function(s) { return s.user === user; });
            var salary = ses ? (ses.salary || 0) : 0;
            var bonus = ses ? (ses.bonusAmount || 0) : 0;
            
            h += '<div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:6px">';
            h += '<div style="display:flex;justify-content:space-between;align-items:start"><div>';
            h += '<div style="color:#FFD700;font-weight:bold">👨‍🍳 ' + user + '</div>';
            h += '<div style="display:flex;gap:10px;margin-top:4px;flex-wrap:wrap">';
            h += '<span style="color:#4CAF50;font-size:12px">💵 ' + data.cash.toFixed(0) + '</span>';
            h += '<span style="color:#2196F3;font-size:12px">💳 ' + data.card.toFixed(0) + '</span>';
            if (data.wire > 0) h += '<span style="color:#9C27B0;font-size:12px">🏦 ' + data.wire.toFixed(0) + '</span>';
            h += '<span style="color:#888;font-size:12px">' + data.count + ' narudž.</span></div>';
            if (salary > 0 || bonus > 0) {
                h += '<div style="margin-top:4px;font-size:11px">';
                if (salary > 0) h += '<span style="color:#4CAF50">💰 ' + salary.toFixed(0) + '</span> ';
                if (bonus > 0) h += '<span style="color:#FFD700">🎁 ' + bonus.toFixed(0) + '</span>';
                h += '</div>';
            }
            h += '</div><div style="color:#4CAF50;font-size:18px;font-weight:bold">' + data.revenue.toFixed(0) + ' din.</div></div></div>';
        });
        h += '</div>';
    }
    
    // PLATE I BONUSI
    if (daySessions.length > 0) {
        h += '<div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:16px">';
        h += '<h3 style="color:#E94560;margin-bottom:16px">💰 Plate i Bonusi</h3>';
        h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px">';
        h += '<div style="background:#16213E;padding:14px;border-radius:8px;text-align:center"><div style="font-size:24px">💰</div><div style="color:#4CAF50;font-size:18px;font-weight:bold;margin:6px 0">' + totalSalary.toFixed(0) + '</div><div style="color:#888;font-size:11px">Plate (' + totalHours.toFixed(1) + 'h)</div></div>';
        h += '<div style="background:#16213E;padding:14px;border-radius:8px;text-align:center"><div style="font-size:24px">🎁</div><div style="color:#FFD700;font-size:18px;font-weight:bold;margin:6px 0">' + totalBonus.toFixed(0) + '</div><div style="color:#888;font-size:11px">Bonusi</div></div>';
        h += '<div style="background:#16213E;padding:14px;border-radius:8px;text-align:center"><div style="font-size:24px">💎</div><div style="color:#FFD700;font-size:18px;font-weight:bold;margin:6px 0">' + (totalSalary + totalBonus).toFixed(0) + '</div><div style="color:#888;font-size:11px">Ukupna zarada</div></div>';
        h += '</div></div>';
    }
    
    // SMENE
    if (daySessions.length > 0) {
        h += '<div style="background:#0F3460;padding:20px;border-radius:12px">';
        h += '<h3 style="color:#E94560;margin-bottom:16px">👥 Smene (' + daySessions.length + ')</h3>';
        daySessions.forEach(function(s) {
            var lt = new Date(s.loginTime).toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'});
            var lo = s.logoutTime ? new Date(s.logoutTime).toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'}) : '—';
            var hrs = Math.floor((s.duration || 0) / 60), mins = (s.duration || 0) % 60;
            var isKuvar = s.role === 'kuvar';
            var icon = isKuvar ? '🍳' : '👨‍🍳';
            var roleBadge = isKuvar ? ' <span style="background:#FF9800;color:#FFF;padding:2px 6px;border-radius:6px;font-size:9px">KUVAR</span>' : '';
            var rightSide = isKuvar
                ? '<div style="color:#FF9800;font-weight:bold">' + (s.dishesCompleted || 0) + ' jela</div>'
                : '<div style="color:#4CAF50;font-weight:bold">' + (s.revenue || 0).toFixed(0) + ' din.</div>';
            h += '<div style="background:#16213E;padding:10px;border-radius:8px;margin-bottom:6px' + (isKuvar ? ';border-left:3px solid #FF9800' : '') + '"><div style="display:flex;justify-content:space-between;align-items:center">';
            h += '<div><div style="color:#FFD700;font-weight:bold">' + icon + ' ' + (s.user || '?') + roleBadge + (s.autoClosed ? ' <span style="color:#FF9800;font-size:10px">⏰ AUTO</span>' : '') + '</div>';
            h += '<div style="color:#888;font-size:12px">🔓 ' + lt + ' → 🔒 ' + lo + ' · ' + hrs + 'h ' + mins + 'min</div></div>';
            h += rightSide + '</div></div>';
        });
        h += '</div>';
    }
    
    return h;
}


function applyHistoryFilter() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (startDate && endDate) {
        window.historyFilter.startDate = startDate;
        window.historyFilter.endDate = endDate;
        render();
    }
}

// Postavi opseg na "sve vreme" - od najranije narudžbine/smene do danas.
// Korisno za analize tipa "udeo hrane i pića od početka rada aplikacije".
function setHistoryRangeAllTime() {
    var allTimes = [];
    (DB.orders || []).forEach(function(o) { if (o && o.time) allTimes.push(o.time); });
    (DB.workdayHistory || []).forEach(function(s) { if (s && s.loginTime) allTimes.push(s.loginTime); });
    var earliest = allTimes.length > 0 ? allTimes.reduce(function(a, b) { return a < b ? a : b; }) : null;
    var startDate = earliest ? earliest.split('T')[0] : '2020-01-01';
    var today = new Date().toISOString().split('T')[0];
    window.historyFilter.startDate = startDate;
    window.historyFilter.endDate = today;
    render();
}
if (typeof window !== 'undefined') window.setHistoryRangeAllTime = setHistoryRangeAllTime;


function exportHistoryToExcel() {
    const filter = window.historyFilter;
    
    // Filter orders
    const orders = DB.orders.filter(o => {
        if (!o || !o.time) return false;
        const orderDate = o.time.split('T')[0];
        return orderDate >= filter.startDate && orderDate <= filter.endDate;
    });
    
    if (orders.length === 0) {
        showAlert('Nema narudžbina za export!');
        return;
    }
    
    // Prepare data for Excel
    const data = [];
    
    // Header
    data.push(['Datum', 'Vreme', 'ID', 'Konobar', 'Stavke', 'Ukupno', 'Način plaćanja', 'Kucani račun']);

    // Rows
    orders.forEach(o => {
        const date = new Date(o.time);
        const dateStr = date.toLocaleDateString('sr-RS');
        const timeStr = date.toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
        const items = o.items.map(it => `${it.name} x${it.qty}`).join(', ');

        data.push([
            dateStr,
            timeStr,
            o.id,
            o.createdBy || 'Nepoznato',
            items,
            o.tot,
            o.method,
            o.isFiscal ? 'Da' : ''
        ]);
    });

    // Fiskalni ukupno red
    const fiscalOrders = orders.filter(o => o.isFiscal);
    const fiscalTotal = fiscalOrders.reduce((s, o) => s + (o.tot || 0), 0);
    data.push([]);
    data.push(['', '', '', '', 'Otkucani fiskalni računi:', fiscalTotal, '', fiscalOrders.length + ' računa']);

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Column widths
    ws['!cols'] = [
        {wch: 12},  // Datum
        {wch: 8},   // Vreme
        {wch: 6},   // ID
        {wch: 15},  // Konobar
        {wch: 40},  // Stavke
        {wch: 10},  // Ukupno
        {wch: 12},  // Način plaćanja
        {wch: 14}   // Kucani račun
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Izveštaj');
    
    // Generate filename
    const filename = `Izvestaj_${filter.startDate}_${filter.endDate}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, filename);
}


// ============================================
// RETROAKTIVNO AŽURIRANJE workdayHistory PRI BRISANJU
// Pronalazi zatvorenu smenu koja je sadržala obrisanu narudžbinu
// i oduzima iznos iz revenue/cashRevenue/cardRevenue/finalCash
// ============================================
function adjustWorkdayHistoryForDeletedOrder(order) {
    if (!order || !order.time || !DB.workdayHistory) return null;

    var orderTime = new Date(order.time);
    var orderCreatedBy = order.createdBy || '';

    // Nađi zatvorenu smenu koja je obuhvatala ovu narudžbinu
    // (order.time je između loginTime i logoutTime, user se podudara sa createdBy)
    var targetIdx = -1;
    for (var i = 0; i < DB.workdayHistory.length; i++) {
        var s = DB.workdayHistory[i];
        if (!s || !s.loginTime || !s.logoutTime) continue;
        var login = new Date(s.loginTime);
        var logout = new Date(s.logoutTime);
        if (orderTime < login || orderTime > logout) continue;
        // Match po useru - prihvati ako se poklapa sa s.user
        if (s.user && orderCreatedBy && s.user !== orderCreatedBy) continue;
        targetIdx = i;
        break;
    }

    if (targetIdx === -1) {
        console.log('ℹ️ Narudžbina #' + order.id + ' nije u zatvorenoj smeni (verovatno je iz aktivne smene)');
        return null;
    }

    var shift = DB.workdayHistory[targetIdx];
    var amt = order.tot || 0;
    var method = order.method || '';

    // Oduzmi od ukupnog prihoda
    shift.revenue = Math.max(0, (shift.revenue || 0) - amt);
    shift.totalRevenue = Math.max(0, (shift.totalRevenue || 0) - amt);
    shift.totalPerformance = Math.max(0, (shift.totalPerformance || 0) - amt);
    shift.orderCount = Math.max(0, (shift.orderCount || 0) - 1);

    // Oduzmi od odgovarajuće kategorije plaćanja
    if (method === 'Cash') {
        shift.cashRevenue = Math.max(0, (shift.cashRevenue || 0) - amt);
        shift.finalCash = Math.max(0, (shift.finalCash || 0) - amt);
    } else if (method === 'Card') {
        shift.cardRevenue = Math.max(0, (shift.cardRevenue || 0) - amt);
    } else if (method === 'Wire') {
        shift.wireRevenue = Math.max(0, (shift.wireRevenue || 0) - amt);
    }

    // Obriši narudžbinu iz shift.orders ako postoji
    if (shift.orders && Array.isArray(shift.orders)) {
        shift.orders = shift.orders.filter(function(o) { return String(o.id) !== String(order.id); });
    }

    console.log('📊 Ažurirana smena ' + shift.user + ' (' + new Date(shift.loginTime).toLocaleDateString('sr-RS') + '): -' + amt + ' din (' + method + ')');

    return shift.user + ' (-' + amt.toFixed(0) + ' din ' + method + ')';
}

// Izračunava ključ poslovnog dana (dan počinje u 05:00 ujutro)
function _businessDayKey(iso) {
    var d = new Date(iso);
    if (d.getHours() < 5) d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

// Walk kroz sve smene hronološki i propagira depozit iz prethodne zatvorene smene
// istog poslovnog dana. Vraća niz promena za prikaz.
function cascadeDepositInheritance() {
    // Ograniči na SAMO trenutni poslovni dan - ne diraj staru istoriju
    var todayKey = _businessDayKey(new Date().toISOString());

    var sorted = (DB.workdayHistory || [])
        .filter(function(s){ return s && s.logoutTime && s.loginTime; })
        .filter(function(s){ return _businessDayKey(s.loginTime) === todayKey; })
        .map(function(s){ return s; })
        .sort(function(a,b){ return new Date(a.loginTime) - new Date(b.loginTime); });

    var users = DB.users || [];
    function isKuvar(username) {
        var u = users.find(function(x){ return x.username === username; });
        return u && u.role === 'kuvar';
    }

    var changes = [];
    for (var i = 0; i < sorted.length; i++) {
        var cur = sorted[i];
        if (isKuvar(cur.user)) continue;
        var curBDay = _businessDayKey(cur.loginTime);

        // Nađi najkasniju zatvorenu smenu (ne-kuvar) PRE ove smene istog poslovnog dana
        var prev = null;
        for (var j = i - 1; j >= 0; j--) {
            var p = sorted[j];
            if (!p || !p.logoutTime) continue;
            if (isKuvar(p.user)) continue;
            if (new Date(p.logoutTime) > new Date(cur.loginTime)) continue;
            if (_businessDayKey(p.logoutTime) !== curBDay) break;
            prev = p;
            break;
        }
        if (!prev) continue;

        var expectedDeposit = Math.max(0, prev.finalCash || 0);
        var curDeposit = cur.deposit || 0;
        if (Math.abs(curDeposit - expectedDeposit) < 0.01) continue;

        var diff = expectedDeposit - curDeposit;
        var oldDeposit = curDeposit;
        var oldFinalCash = cur.finalCash || 0;
        cur.deposit = expectedDeposit;
        cur.finalCash = Math.max(0, oldFinalCash + diff);
        cur.totalPerformance = (cur.revenue || 0) + expectedDeposit;

        changes.push({
            user: cur.user,
            date: new Date(cur.loginTime).toLocaleDateString('sr-RS'),
            time: new Date(cur.loginTime).toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'}),
            depositChange: oldDeposit + '→' + expectedDeposit,
            finalCashChange: oldFinalCash + '→' + cur.finalCash
        });
    }
    return changes;
}

// Rekonstrukcija: za sve obrisane narudžbine (deletedOrderIds) nađi originale preko
// bilo gde dostupnih podataka i ponovo ažuriraj workdayHistory.
// Poziva se ručno od strane admina da popravi već postojeće nekorektne entry-je.
function rebuildWorkdayHistoryFromDeletions() {
    if (!DB.workdayHistory || DB.workdayHistory.length === 0) {
        showAlert('Nema zatvorenih smena u istoriji.');
        return;
    }

    var deletedIds = new Set((DB.deletedOrderIds || []).map(String));
    var allOrders = DB.orders || [];
    var changes = [];

    // Prolazi kroz sve zatvorene smene i preračunaj totale iz DB.orders
    // (pronađi narudžbine po user + time range, isključi obrisane)
    // Stariji format nije sačuvao shift.orders pa koristimo live DB.orders
    DB.workdayHistory.forEach(function(shift, idx) {
        if (!shift || !shift.user || !shift.loginTime) return;

        var startT = shift.loginTime;
        var endT = shift.logoutTime || new Date().toISOString();

        // Pronađi sve narudžbine ovog konobara u vremenskom rasponu smene
        // koje NISU obrisane
        var validOrders = allOrders.filter(function(o) {
            if (!o || !o.time || !o.id) return false;
            if (deletedIds.has(String(o.id))) return false;
            if (o.createdBy !== shift.user) return false;
            return o.time >= startT && o.time <= endT;
        });

        // Ako nema nijedne narudžbine u rasponu i nema ni stored revenue - preskoči
        if (validOrders.length === 0 && (shift.revenue || 0) === 0) return;

        // Preračunaj totale
        var realOrders = validOrders.filter(function(o) { return !o.isDebtPayment; });
        var newRevenue = realOrders.reduce(function(s, o) { return s + (o.tot || 0); }, 0);
        var newCash = realOrders.filter(function(o) { return o.method === 'Cash'; }).reduce(function(s, o) { return s + (o.tot || 0); }, 0);
        var newCard = realOrders.filter(function(o) { return o.method === 'Card'; }).reduce(function(s, o) { return s + (o.tot || 0); }, 0);
        var newWire = realOrders.filter(function(o) { return o.method === 'Wire'; }).reduce(function(s, o) { return s + (o.tot || 0); }, 0);
        var debtCash = validOrders.filter(function(o) { return o.isDebtPayment && o.method === 'Cash'; }).reduce(function(s, o) { return s + (o.tot || 0); }, 0);

        var deposit = shift.deposit || 0;
        var reductions = shift.totalCashReductions || 0;
        var newFinalCash = Math.max(0, deposit + newCash + debtCash - reductions);

        // Poredi sa trenutnim vrednostima
        var oldRevenue = shift.revenue || 0;
        var oldCash = shift.cashRevenue || 0;
        var oldCard = shift.cardRevenue || 0;
        var oldFinalCash = shift.finalCash || 0;

        // ✅ SIGURNOST: Ispravljaj SAMO kada nova vrednost opada (tj. narudžbina je obrisana).
        // Ne diramo smene gde novi total raste - to su stari zapisi sa nedostajućim poljima.
        // Takođe zahtevamo da je stari revenue > 0 - inače je smena verovatno u starom formatu.
        if (oldRevenue <= 0) return;
        if (newRevenue >= oldRevenue) return;

        var diffs = [];
        if (newRevenue < oldRevenue - 0.01) diffs.push('revenue ' + oldRevenue + '→' + newRevenue);
        if (newCash < oldCash - 0.01) diffs.push('cash ' + oldCash + '→' + newCash);
        if (newCard < oldCard - 0.01) diffs.push('card ' + oldCard + '→' + newCard);
        if (newFinalCash < oldFinalCash - 0.01) diffs.push('finalCash ' + oldFinalCash + '→' + newFinalCash);

        if (diffs.length === 0) return;

        var dateStr = new Date(shift.loginTime).toLocaleDateString('sr-RS');
        changes.push({
            idx: idx,
            shift: shift,
            label: shift.user + ' (' + dateStr + '): ' + diffs.join(', '),
            newRevenue: newRevenue,
            newCash: newCash,
            newCard: newCard,
            newWire: newWire,
            newFinalCash: newFinalCash,
            newOrderCount: realOrders.length,
            validOrders: validOrders
        });
    });

    // Dry-run cascade: simuliraj da vidimo koliko depozita treba propagirati
    // (radi nad trenutnim stanjem, pre bilo kakvih izmena)
    var cascadePreview = _simulateCascade();

    if (changes.length === 0 && cascadePreview.length === 0) {
        showAlert('✅ Sve zatvorene smene su već ispravne.');
        return;
    }

    var h = '<div style="text-align:left;max-height:400px;overflow-y:auto">';
    if (changes.length > 0) {
        h += '<p style="color:#E94560"><b>🗑️ Pronađeno ' + changes.length + ' smena sa obrisanim narudžbinama:</b></p>';
        changes.forEach(function(c) {
            h += '<div style="background:#16213E;padding:8px;border-radius:6px;margin:6px 0;font-size:12px;color:#FFD700">' + c.label + '</div>';
        });
    }
    if (cascadePreview.length > 0) {
        h += '<p style="color:#E94560;margin-top:12px"><b>🔗 Propagacija depozita (' + cascadePreview.length + '):</b></p>';
        cascadePreview.forEach(function(c) {
            h += '<div style="background:#16213E;padding:8px;border-radius:6px;margin:6px 0;font-size:12px;color:#FFD700">' +
                c.user + ' (' + c.date + ' ' + c.time + '): depozit ' + c.depositChange + ', finalCash ' + c.finalCashChange + '</div>';
        });
    }
    h += '<p style="color:#4CAF50;margin-top:12px">Potvrdi da ispraviš totale i kaskadno propagiraš depozite.</p>';
    h += '</div>';

    showConfirm('🔧 Ispravi Totale Smena', h, function(confirmed) {
        if (!confirmed) return;
        changes.forEach(function(c) {
            c.shift.revenue = c.newRevenue;
            c.shift.totalRevenue = c.newRevenue;
            c.shift.totalPerformance = c.newRevenue + (c.shift.deposit || 0);
            c.shift.cashRevenue = c.newCash;
            c.shift.cardRevenue = c.newCard;
            c.shift.wireRevenue = c.newWire;
            c.shift.finalCash = c.newFinalCash;
            c.shift.orderCount = c.newOrderCount;
        });
        // Kaskadno propagiraj depozite nakon korekcije totala
        var cascadeApplied = cascadeDepositInheritance();
        DB._adminDeleteOverride = true;
        save();
        render();
        showAlert('✅ Ispravljeno ' + changes.length + ' smena sa obrisanim narudžbinama.\n🔗 Propagirano depozita: ' + cascadeApplied.length);
    });
}

// Simulira kaskadu bez modifikovanja DB - za prikaz u dry-run
function _simulateCascade() {
    var snap = JSON.parse(JSON.stringify(DB.workdayHistory || []));
    var originalHistory = DB.workdayHistory;
    DB.workdayHistory = snap;
    var result;
    try {
        result = cascadeDepositInheritance();
    } finally {
        DB.workdayHistory = originalHistory;
    }
    return result;
}

// Prikazuje listu jela koje je kuvar spremio u datoj sesiji
function showKuvarSessionDishes(loginTime, user) {
    var session = (DB.workdayHistory || []).find(function(s) {
        return s && s.role === 'kuvar' && s.user === user && s.loginTime === loginTime;
    });
    if (!session) { showAlert('Sesija nije pronađena.'); return; }
    var dishes = Array.isArray(session.dishes) ? session.dishes : [];
    var dateStr = new Date(loginTime).toLocaleDateString('sr-RS', {day:'numeric', month:'short', year:'numeric'});
    var loginStr = new Date(loginTime).toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'});
    var logoutStr = session.logoutTime ? new Date(session.logoutTime).toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'}) : '—';

    var h = '<div style="text-align:left;max-height:500px;overflow-y:auto">';
    h += '<div style="color:#B0B0B0;font-size:12px;margin-bottom:8px">' + dateStr + ' · 🔓 ' + loginStr + ' → 🔒 ' + logoutStr + '</div>';
    h += '<div style="display:flex;gap:10px;margin-bottom:12px;font-size:12px;flex-wrap:wrap">';
    h += '<span style="background:#16213E;padding:6px 10px;border-radius:6px;color:#4CAF50;font-weight:bold">🍽️ ' + (session.dishesCompleted || 0) + ' jela</span>';
    h += '<span style="background:#16213E;padding:6px 10px;border-radius:6px;color:#2196F3;font-weight:bold">✅ ' + (session.ordersProcessed || 0) + ' obrađeno</span>';
    h += '<span style="background:#16213E;padding:6px 10px;border-radius:6px;color:#888">📋 ' + (session.totalOrders || 0) + ' narudž.</span>';
    h += '</div>';

    if (dishes.length === 0) {
        h += '<div style="text-align:center;color:#B0B0B0;padding:20px">Nema sačuvane liste jela za ovu sesiju.<br><span style="font-size:11px">(stariji format - lista jela se čuva tek za smene zatvorene od ove verzije)</span></div>';
    } else {
        h += '<div style="background:#0F3460;padding:10px;border-radius:8px">';
        dishes.forEach(function(d) {
            h += '<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #16213E">';
            h += '<span style="color:#FFF">' + (d.name || '?') + '</span>';
            h += '<span style="color:#FFD700;font-weight:bold">x' + (d.qty || 0) + '</span>';
            h += '</div>';
        });
        h += '</div>';
    }
    h += '</div>';
    showConfirm('🍳 ' + user + ' - Spremljena jela', h, function(){});
}


// ============================================
// BRISANJE NARUDŽBINA (samo admin)
// ============================================
function deleteOrder(orderId) {
    if (!DB.currentUser || DB.currentUser.role !== 'admin') {
        showAlert('❌ Samo admin može da briše narudžbine!');
        return;
    }
    
    const order = DB.orders.find(function(o) { return String(o.id) === String(orderId); });
    if (!order) {
        showAlert('❌ Narudžbina nije pronađena');
        return;
    }
    
    const date = new Date(order.time);
    const dateStr = date.toLocaleString('sr-RS', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    const itemList = order.items.map(function(it) { return it.name + ' x' + it.qty; }).join(', ');
    
    showConfirm('🗑️ Obriši Narudžbinu', 
        'Narudžbina #' + orderId + '\n' +
        dateStr + ' · ' + (order.createdBy || '?') + '\n' +
        itemList + '\n' +
        'Ukupno: ' + order.tot.toFixed(0) + ' din (' + order.method + ')\n\n' +
        'Da li ste sigurni? Ovo se ne može poništiti!',
        function(confirmed) {
            if (!confirmed) return;
            
            var idx = DB.orders.findIndex(function(o) { return String(o.id) === String(orderId); });
            if (idx === -1) return;
            
            var removed = DB.orders.splice(idx, 1)[0];
            console.log('🗑️ Obrisana narudžbina #' + orderId + ': ' + removed.tot + ' din');

            // Dodaj u listu obrisanih - sprečava merge da vrati ovu narudžbinu
            if (!DB.deletedOrderIds) DB.deletedOrderIds = [];
            DB.deletedOrderIds.push(String(orderId));

            // ✅ Retroaktivno ažuriraj workdayHistory - oduzmi obrisanu narudžbinu iz zatvorene smene
            // (inače konobar koji otvara novu smenu nasledi stari finalCash koji sadrži ovu narudžbinu)
            var historyAdjusted = adjustWorkdayHistoryForDeletedOrder(removed);

            DB._adminDeleteOverride = true;
            save();
            render();
            var msg = '✅ Narudžbina #' + orderId + ' obrisana (' + removed.tot.toFixed(0) + ' din)';
            if (historyAdjusted) {
                msg += '\n\n📊 Ažurirana zatvorena smena: ' + historyAdjusted;
            }
            showAlert(msg);
        }
    );
}

