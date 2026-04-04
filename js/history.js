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
            viewMode: 'summary'  // summary, orders, sessions
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
                    `;
    
    // Excel export SAMO ZA ADMINA
    if (!isWaiter) {
        h += `<button class="btn btn-secondary" onclick="exportHistoryToExcel()" style="height:36px">📊 Excel</button>`;
    }
    
    h += `
                </div>
            </div>
            
            <!-- View Mode Tabs -->
            <div style="display:flex;gap:8px;margin-bottom:20px;overflow-x:auto">
                <button class="btn ${filter.viewMode==='summary'?'':'btn-secondary'}" 
                    onclick="window.historyFilter.viewMode='summary';render()" 
                    style="flex:1;min-width:100px">📊 Pregled</button>
                ${!isWaiter ? `<button class="btn ${filter.viewMode==='daily'?'':'btn-secondary'}" 
                    onclick="window.historyFilter.viewMode='daily';render()" 
                    style="flex:1;min-width:100px">📅 Dnevni</button>` : ''}
                <button class="btn ${filter.viewMode==='orders'?'':'btn-secondary'}" 
                    onclick="window.historyFilter.viewMode='orders';render()"
                    style="flex:1;min-width:100px">📋 Narudžbine</button>
                <button class="btn ${filter.viewMode==='sessions'?'':'btn-secondary'}" 
                    onclick="window.historyFilter.viewMode='sessions';render()"
                    style="flex:1;min-width:100px">👥 Sesije</button>
            </div>
    `;
    
    // Render based on view mode
    if (filter.viewMode === 'summary') {
        h += renderHistorySummary(filteredOrders, filteredSessions, ordersByDate, ordersByUser, totalRevenue, cash, card, isWaiter, totalSalary, totalBonus, totalWorkHours);
    } else if (filter.viewMode === 'daily') {
        h += renderHistoryDaily(filteredOrders, filteredSessions, ordersByDate, isWaiter);
    } else if (filter.viewMode === 'orders') {
        h += renderHistoryOrders(filteredOrders);
    } else if (filter.viewMode === 'sessions') {
        h += renderHistorySessions(filteredSessions);
    }
    
    h += `</div>`;
    c.innerHTML = h;
}


function renderHistorySummary(orders, sessions, ordersByDate, ordersByUser, totalRevenue, cash, card, isWaiter, totalSalary, totalBonus, totalWorkHours) {
    const avgOrder = orders.length > 0 ? (totalRevenue / orders.length) : 0;
    
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
                            <div style="color:#FFD700;font-weight:bold">Narudžbina #${o.id}</div>
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
    
    var sortedSessions = daySessions.slice().sort(function(a, b) { return a.loginTime.localeCompare(b.loginTime); });
    var deposit = sortedSessions.length > 0 ? (sortedSessions[0].deposit || 0) : 0;
    var totalReductions = daySessions.reduce(function(s, ses) { return s + (ses.totalCashReductions || 0); }, 0);
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
            h += '<div style="background:#16213E;padding:10px;border-radius:8px;margin-bottom:6px"><div style="display:flex;justify-content:space-between;align-items:center">';
            h += '<div><div style="color:#FFD700;font-weight:bold">👨‍🍳 ' + (s.user || '?') + (s.autoClosed ? ' <span style="color:#FF9800;font-size:10px">⏰ AUTO</span>' : '') + '</div>';
            h += '<div style="color:#888;font-size:12px">🔓 ' + lt + ' → 🔒 ' + lo + ' · ' + hrs + 'h ' + mins + 'min</div></div>';
            h += '<div style="color:#4CAF50;font-weight:bold">' + (s.revenue || 0).toFixed(0) + ' din.</div></div></div>';
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
    data.push(['Datum', 'Vreme', 'ID', 'Konobar', 'Stavke', 'Ukupno', 'Način plaćanja']);
    
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
            o.method
        ]);
    });
    
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
        {wch: 12}   // Način plaćanja
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Izveštaj');
    
    // Generate filename
    const filename = `Izvestaj_${filter.startDate}_${filter.endDate}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, filename);
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

            DB._adminDeleteOverride = true;
            save();
            render();
            showAlert('✅ Narudžbina #' + orderId + ' obrisana (' + removed.tot.toFixed(0) + ' din)');
        }
    );
}

