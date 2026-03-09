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
                    style="flex:1;min-width:120px">📊 Pregled</button>
                <button class="btn ${filter.viewMode==='orders'?'':'btn-secondary'}" 
                    onclick="window.historyFilter.viewMode='orders';render()"
                    style="flex:1;min-width:120px">📋 Narudžbine</button>
                <button class="btn ${filter.viewMode==='sessions'?'':'btn-secondary'}" 
                    onclick="window.historyFilter.viewMode='sessions';render()"
                    style="flex:1;min-width:120px">👥 Sesije</button>
            </div>
    `;
    
    // Render based on view mode
    if (filter.viewMode === 'summary') {
        h += renderHistorySummary(filteredOrders, filteredSessions, ordersByDate, ordersByUser, totalRevenue, cash, card, isWaiter, totalSalary, totalBonus, totalWorkHours);
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
            <div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
                <div>
                    <div style="color:#FFD700;font-weight:bold">${formatted}</div>
                    <div style="color:#B0B0B0;font-size:11px">${data.orders.length} narudžbina</div>
                </div>
                <div style="color:#4CAF50;font-size:18px;font-weight:bold">${data.revenue.toFixed(0)} din.</div>
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
            
            save();
            render();
            showAlert('✅ Narudžbina #' + orderId + ' obrisana (' + removed.tot.toFixed(0) + ' din)');
        }
    );
}

