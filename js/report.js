// ============================================
// REPORTS & ORDER VIEWS
// ============================================

// Radni dan: 7:00 - 7:00 sledećeg dana
// Narudžbina u 01:00 7/3 pripada radnom danu 6/3
function getBusinessDayRange() {
    const CUTOFF = typeof DAILY_CUTOFF_HOUR !== 'undefined' ? DAILY_CUTOFF_HOUR : 7;
    const now = new Date();
    const start = new Date(now);
    start.setHours(CUTOFF, 0, 0, 0);
    
    if (now < start) {
        // Pre 7:00 = još uvek jučerašnji radni dan
        start.setDate(start.getDate() - 1);
    }
    
    const end = new Date(start);
    end.setDate(end.getDate() + 1); // Sutra u 7:00
    
    return { start: start.toISOString(), end: end.toISOString() };
}

function isInBusinessDay(timeStr) {
    const range = getBusinessDayRange();
    return timeStr >= range.start && timeStr < range.end;
}


function renderFinalReport(c) {
    const report = JSON.parse(localStorage.getItem('lastWorkdayReport'));
    if(!report) {
        c.innerHTML = '<div class="empty"><p>Nema izveštaja</p></div>';
        return;
    }
    
    const startDate = new Date(report.startTime);
    const endDate = new Date(report.endTime);
    const duration = Math.floor((endDate - startDate) / 1000 / 60);
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    
    const itemCounts = {};
    report.orders.forEach(order => {
        order.items.forEach(item => {
            if(!itemCounts[item.name]) itemCounts[item.name] = {qty: 0, revenue: 0};
            itemCounts[item.name].qty += item.qty;
            itemCounts[item.name].revenue += item.price * item.qty;
        });
    });
    const topItems = Object.entries(itemCounts)
        .map(([name, data]) => ({name, ...data}))
        .sort((a,b) => b.qty - a.qty)
        .slice(0, 5);
    
    let h = `
        <div style="max-width:800px;margin:0 auto;padding:20px">
            <div style="text-align:center;margin-bottom:32px">
                <div style="font-size:64px;margin-bottom:16px">📊</div>
                <h2 style="color:#E94560;margin-bottom:8px">Završni Izveštaj Radnog Dana</h2>
                <p style="color:#B0B0B0">Radni dan je zatvoren - svi podaci su sačuvani</p>
            </div>
            
            <div style="background:#0F3460;padding:24px;border-radius:12px;margin-bottom:20px">
                <h3 style="color:#E94560;margin-bottom:16px">📅 Osnovni Podaci</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    <div>
                        <div style="color:#B0B0B0;font-size:13px">Konobar</div>
                        <div style="color:#FFD700;font-weight:bold;font-size:18px">${report.user}</div>
                    </div>
                    <div>
                        <div style="color:#B0B0B0;font-size:13px">Trajanje</div>
                        <div style="color:#FFF;font-weight:bold;font-size:18px">${hours}h ${mins}min</div>
                    </div>
                    <div>
                        <div style="color:#B0B0B0;font-size:13px">Početak</div>
                        <div style="color:#FFF">${startDate.toLocaleString('sr-RS')}</div>
                    </div>
                    <div>
                        <div style="color:#B0B0B0;font-size:13px">Kraj</div>
                        <div style="color:#FFF">${endDate.toLocaleString('sr-RS')}</div>
                    </div>
                </div>
            </div>
            
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:20px">
                <div class="stat-card">
                    <div class="stat-label">Otkucano</div>
                    <div class="stat-value">${report.totalRevenue.toFixed(0)}</div>
                    <div class="stat-label">din.</div>
                </div>
                ${report.deposit && report.deposit > 0 ? `
                <div class="stat-card" style="background:linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)">
                    <div class="stat-label" style="color:#FFF">💵 Depozit</div>
                    <div class="stat-value" style="color:#FFD700">${report.deposit.toFixed(0)}</div>
                    <div class="stat-label" style="color:#FFF">din.</div>
                </div>
                <div class="stat-card" style="background:linear-gradient(135deg, #FF6F00 0%, #E65100 100%)">
                    <div class="stat-label" style="color:#FFF">📊 Ukupan Učinak</div>
                    <div class="stat-value" style="color:#FFD700">${report.totalPerformance.toFixed(0)}</div>
                    <div class="stat-label" style="color:#FFF">din.</div>
                </div>
                ` : ''}
                <div class="stat-card">
                    <div class="stat-label">Broj narudžbi</div>
                    <div class="stat-value" style="color:#E94560">${report.orderCount}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Prosečna narudžba</div>
                    <div class="stat-value" style="color:#4CAF50">${report.orderCount > 0 ? (report.totalRevenue/report.orderCount).toFixed(0) : 0}</div>
                    <div class="stat-label">din.</div>
                </div>
                <div class="stat-card" style="background:linear-gradient(135deg, #4CAF50 0%, #45a049 100%)">
                    <div class="stat-label" style="color:#FFF">💰 Plata</div>
                    <div class="stat-value" style="color:#FFD700">${report.salary ? report.salary.toFixed(0) : 0}</div>
                    <div class="stat-label" style="color:#FFF">din. (${report.hourlyRate || 350}/sat)</div>
                </div>
            </div>
            
            <div style="background:#0F3460;padding:24px;border-radius:12px;margin-bottom:20px">
                <h3 style="color:#E94560;margin-bottom:16px">💰 Načini Plaćanja</h3>
                <div style="display:flex;gap:16px">
                    <div style="flex:1;background:#16213E;padding:16px;border-radius:8px;text-align:center">
                        <div style="font-size:32px">💵</div>
                        <div style="color:#FFD700;font-size:20px;font-weight:bold;margin:8px 0">${report.cashRevenue.toFixed(0)} din.</div>
                        <div style="color:#B0B0B0;font-size:12px">Cash (${report.totalRevenue > 0 ? Math.round(report.cashRevenue/report.totalRevenue*100) : 0}%)</div>
                    </div>
                    <div style="flex:1;background:#16213E;padding:16px;border-radius:8px;text-align:center">
                        <div style="font-size:32px">💳</div>
                        <div style="color:#FFD700;font-size:20px;font-weight:bold;margin:8px 0">${report.cardRevenue.toFixed(0)} din.</div>
                        <div style="color:#B0B0B0;font-size:12px">Card (${report.totalRevenue > 0 ? Math.round(report.cardRevenue/report.totalRevenue*100) : 0}%)</div>
                    </div>
                </div>
                
                ${report.cashReductions && report.cashReductions.length > 0 ? `
                <div style="margin-top:20px;padding:16px;background:#16213E;border-radius:8px;border-left:4px solid #FF6B6B">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                        <h4 style="color:#FF6B6B;margin:0">💸 Smanjenja Keša (${report.cashReductions.length})</h4>
                        <span style="color:#FF6B6B;font-weight:bold">-${report.totalCashReductions.toFixed(0)} din.</span>
                    </div>
                    ${report.cashReductions.map(r => {
                        const time = new Date(r.timestamp).toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
                        return `
                        <div style="background:#0F3460;padding:8px 12px;border-radius:6px;margin-bottom:8px;font-size:12px">
                            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                                <span style="color:#B0B0B0">${time}</span>
                                <span style="color:#FF6B6B;font-weight:bold">-${r.amount.toFixed(0)} din.</span>
                            </div>
                            <div style="color:#FFF">${r.reason}</div>
                        </div>`;
                    }).join('')}
                </div>
                ` : ''}
                
                <div style="margin-top:20px;padding:16px;background:#16213E;border-radius:8px;border-left:4px solid #4CAF50">
                    <h4 style="color:#4CAF50;margin:0 0 12px">🏦 Stanje Kase</h4>
                    ${report.deposit > 0 ? `
                    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px">
                        <span style="color:#B0B0B0">Depozit (početno):</span>
                        <span style="color:#FFF">${report.deposit.toFixed(0)} din.</span>
                    </div>` : ''}
                    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px">
                        <span style="color:#B0B0B0">+ Keš prihod:</span>
                        <span style="color:#4CAF50">${report.cashRevenue.toFixed(0)} din.</span>
                    </div>`;
    
    // Vraćeni dugovi u ovoj smeni
    const reportDebtPayments = report.orders ? report.orders.filter(o => o.isDebtPayment) : [];
    const reportDebtTotal = reportDebtPayments.reduce((s,o) => s + o.tot, 0);
    const reportDebtCash = reportDebtPayments.filter(o => o.method === 'Cash').reduce((s,o) => s + o.tot, 0);
    const reportDebtCard = reportDebtPayments.filter(o => o.method === 'Card').reduce((s,o) => s + o.tot, 0);
    
    if (reportDebtTotal > 0) {
        h += `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px">
                        <span style="color:#B0B0B0">📝 Vraćeni dugovi:</span>
                        <span style="color:#FF9800">${reportDebtTotal.toFixed(0)} din. (${reportDebtCash > 0 ? '💵' + reportDebtCash.toFixed(0) : ''}${reportDebtCash > 0 && reportDebtCard > 0 ? ' + ' : ''}${reportDebtCard > 0 ? '💳' + reportDebtCard.toFixed(0) : ''})</span>
                    </div>`;
    }
    
    // Zapisano na dug u ovoj smeni
    const reportNewDebts = (DB.debts || []).filter(d => 
        d.time >= report.startTime && d.time <= report.endTime && d.createdBy === report.user
    );
    const reportNewDebtsTotal = reportNewDebts.reduce((s,d) => s + (d.originalTotal || 0), 0);
    
    if (reportNewDebtsTotal > 0) {
        h += `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px">
                        <span style="color:#B0B0B0">📝 Zapisano na dug:</span>
                        <span style="color:#E94560">${reportNewDebtsTotal.toFixed(0)} din. (${reportNewDebts.length})</span>
                    </div>`;
    }
    
    h += `${report.totalCashReductions > 0 ? `
                    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px">
                        <span style="color:#B0B0B0">− Smanjenja:</span>
                        <span style="color:#FF6B6B">-${report.totalCashReductions.toFixed(0)} din.</span>
                    </div>` : ''}
                    <div style="display:flex;justify-content:space-between;padding:8px 0 0;margin-top:8px;border-top:2px solid #2A2A4A;font-size:18px;font-weight:bold">
                        <span style="color:#FFD700">💰 U kasi:</span>
                        <span style="color:#FFD700">${report.finalCash.toFixed(0)} din.</span>
                    </div>
                </div>
            </div>`;
    
    // BONUS SEKCIJA - Nova pravila
    const startDate2 = new Date(report.startTime);
    const endDate2 = new Date(report.endTime);
    const startHour = startDate2.getHours();
    const endHour = endDate2.getHours();
    const dayOfWeek = startDate2.getDay(); // 0 = nedelja (pazar)
    const isSunday = dayOfWeek === 0;
    
    // Prva smena: 8 AM - 4 PM
    const isFirstShift = startHour >= 8 && startHour < 14 && endHour >= 15 && endHour <= 17;
    
    // Druga smena: 4 PM - 11 PM
    const isSecondShift = startHour >= 14 && startHour < 20 && endHour >= 22 && endHour <= 23;
    
    let bonusEarned = false;
    let bonusAmount = 0;
    let bonusMessage = '';
    let motivationMessage = '';
    
    // PRVA SMENA: ≥20,000 din → 1,000 din
    if (isFirstShift) {
        if (report.totalRevenue >= 20000) {
            bonusEarned = true;
            bonusAmount = 1000;
            bonusMessage = 'Prva smena - ostvaren prihod od 20,000 din ili više!';
        } else {
            const remaining = 20000 - report.totalRevenue;
            motivationMessage = `Još ${remaining.toFixed(0)} din. do bonusa od 1,000 din.`;
        }
    }
    
    // DRUGA SMENA (SVAKI DAN): ≥60k → 2,000 din, ≥40k → 1,000 din
    if (isSecondShift) {
        if (report.totalRevenue >= 60000) {
            bonusEarned = true;
            bonusAmount = 2000;
            bonusMessage = 'Druga smena - ostvaren prihod od 60,000 din ili više!';
        } else if (report.totalRevenue >= 40000) {
            bonusEarned = true;
            bonusAmount = 1000;
            bonusMessage = 'Druga smena - ostvaren prihod od 40,000 din ili više!';
        } else {
            const remaining = 40000 - report.totalRevenue;
            motivationMessage = `Još ${remaining.toFixed(0)} din. do bonusa od 1,000 din.<br>`;
            if (report.totalRevenue < 60000) {
                const remaining2 = 60000 - report.totalRevenue;
                motivationMessage += `Ili ${remaining2.toFixed(0)} din. do bonusa od 2,000 din.`;
            }
        }
    }
    
    if (bonusEarned) {
        h += `
            <div style="background:linear-gradient(135deg, #FFD700 0%, #FFA500 100%);padding:24px;border-radius:12px;margin-bottom:20px;box-shadow:0 4px 16px rgba(255,215,0,0.3);border:2px solid #FFD700">
                <div style="text-align:center">
                    <div style="font-size:64px;margin-bottom:12px">🎁</div>
                    <h3 style="color:#000;margin-bottom:12px;font-size:24px">ČESTITAMO!</h3>
                    <p style="color:#000;font-size:16px;margin-bottom:16px">${bonusMessage}</p>
                    <div style="background:rgba(0,0,0,0.2);padding:16px;border-radius:8px">
                        <div style="color:#000;font-size:14px;margin-bottom:8px">Prihod: ${report.totalRevenue.toFixed(0)} din.</div>`;
                        if(isFirstShift) {
                            h += `<div style="color:#000;font-size:14px;margin-bottom:8px">Prag: 20,000 din. ✅</div>`;
                        }
                        if(isSecondShift && report.totalRevenue >= 60000) {
                            h += `<div style="color:#000;font-size:14px;margin-bottom:8px">Prag: 60,000 din. ✅</div>`;
                        }
                        if(isSecondShift && report.totalRevenue >= 40000 && report.totalRevenue < 60000) {
                            h += `<div style="color:#000;font-size:14px;margin-bottom:8px">Prag: 40,000 din. ✅</div>`;
                        }
                        h += `
                        <div style="color:#000;font-size:32px;font-weight:bold;margin-top:12px">BONUS: ${bonusAmount.toFixed(0)} din.</div>
                    </div>
                </div>
            </div>
        `;
    } else if (motivationMessage) {
        h += `
            <div style="background:#0F3460;padding:24px;border-radius:12px;margin-bottom:20px;border:2px solid #666">
                <div style="text-align:center">
                    <div style="font-size:48px;margin-bottom:12px">💪</div>
                    <h3 style="color:#FFD700;margin-bottom:12px">${isFirstShift ? 'Prva Smena' : 'Druga Smena'}</h3>
                    <p style="color:#B0B0B0;font-size:14px;margin-bottom:16px">${motivationMessage.includes('Još') ? 'Još malo do bonusa!' : ''}</p>
                    <div style="background:#16213E;padding:16px;border-radius:8px">
                        <div style="color:#FFF;font-size:14px;margin-bottom:8px">Prihod: ${report.totalRevenue.toFixed(0)} din.</div>
                        <div style="color:#B0B0B0;font-size:12px;margin-top:8px">${motivationMessage}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    if(topItems.length > 0) {
        h += `<div style="background:#0F3460;padding:24px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#E94560;margin-bottom:16px">🏆 Top 5 Prodatih Jela</h3>`;
        topItems.forEach((item, idx) => {
            const maxQty = topItems[0].qty;
            const pct = (item.qty / maxQty * 100).toFixed(0);
            h += `<div style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <span style="color:#FFF"><strong>${idx+1}.</strong> ${item.name}</span>
                    <span style="color:#B0B0B0">${item.qty} kom · ${item.revenue.toFixed(0)} din.</span>
                </div>
                <div style="background:#2A2A4A;height:8px;border-radius:4px;overflow:hidden">
                    <div style="background:#E94560;height:100%;width:${pct}%;border-radius:4px"></div>
                </div>
            </div>`;
        });
        h += `</div>`;
    }
    
    h += `<div style="display:flex;gap:12px;margin-top:24px">
            <button class="btn btn-secondary" onclick="window.print()">🖨️ Štampaj Izveštaj</button>
            <button class="btn btn-secondary" onclick="showReportModal()">📋 Prikaži Izveštaj</button>
            <button class="btn" onclick="page='workday';render()">✅ Završi</button>
        </div>
    </div>`;
    
    c.innerHTML = h;
}


function showReportModal() {
    const report = JSON.parse(localStorage.getItem('lastWorkdayReport'));
    if(!report) {
        showAlert('Nema izveštaja');
        return;
    }
    
    const startDate = new Date(report.startTime);
    const endDate = new Date(report.endTime);
    const duration = Math.floor((endDate - startDate) / 1000 / 60);
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    
    // Top items
    const itemCounts = {};
    report.orders.forEach(order => {
        order.items.forEach(item => {
            if(!itemCounts[item.name]) itemCounts[item.name] = {qty: 0, revenue: 0};
            itemCounts[item.name].qty += item.qty;
            itemCounts[item.name].revenue += item.price * item.qty;
        });
    });
    const topItems = Object.entries(itemCounts)
        .map(([name, data]) => ({name, ...data}))
        .sort((a,b) => b.qty - a.qty)
        .slice(0, 10);
    
    // Kreiraj izveštaj
    let reportText = `DNEVNI IZVEŠTAJ - ${DB.settings.name}
${'='.repeat(60)}

📅 OSNOVNI PODACI
Konobar: ${report.user}
Datum: ${startDate.toLocaleDateString('sr-RS')}
Početak: ${startDate.toLocaleTimeString('sr-RS')}
Kraj: ${endDate.toLocaleTimeString('sr-RS')}
Trajanje: ${hours}h ${mins}min

💰 FINANSIJSKI PREGLED
Ukupan prihod: ${report.totalRevenue.toFixed(2)} RSD
Broj narudžbi: ${report.orderCount}
Prosečna narudžba: ${report.orderCount > 0 ? (report.totalRevenue/report.orderCount).toFixed(2) : 0} RSD

💳 NAČINI PLAĆANJA
Cash: ${report.cashRevenue.toFixed(2)} RSD (${report.totalRevenue > 0 ? Math.round(report.cashRevenue/report.totalRevenue*100) : 0}%)
Card: ${report.cardRevenue.toFixed(2)} RSD (${report.totalRevenue > 0 ? Math.round(report.cardRevenue/report.totalRevenue*100) : 0}%)
`;

    // Depozit info
    if (report.deposit && report.deposit > 0) {
        reportText += `
💵 DEPOZIT
Depozit: ${report.deposit.toFixed(2)} RSD
Ukupan učinak (otkucano + depozit): ${report.totalPerformance.toFixed(2)} RSD
`;
    }

    // Dugovanja info
    const textDebtPayments = report.orders ? report.orders.filter(o => o.isDebtPayment) : [];
    const textDebtTotal = textDebtPayments.reduce((s,o) => s + o.tot, 0);
    const textNewDebts = (DB.debts || []).filter(d => 
        d.time >= report.startTime && d.time <= report.endTime && d.createdBy === report.user
    );
    const textNewDebtsTotal = textNewDebts.reduce((s,d) => s + (d.originalTotal || 0), 0);
    
    if (textDebtTotal > 0 || textNewDebtsTotal > 0) {
        reportText += `
📝 DUGOVANJA
${'─'.repeat(40)}
`;
        if (textDebtTotal > 0) {
            reportText += `Vraćeni dugovi: +${textDebtTotal.toFixed(2)} RSD (${textDebtPayments.length} uplata)
`;
        }
        if (textNewDebtsTotal > 0) {
            reportText += `Zapisano na dug: ${textNewDebtsTotal.toFixed(2)} RSD (${textNewDebts.length} dugovanja)
`;
        }
    }

    // Smanjenja keša
    if (report.cashReductions && report.cashReductions.length > 0) {
        reportText += `
💸 SMANJENJA KEŠA (${report.cashReductions.length})
${'─'.repeat(40)}
`;
        report.cashReductions.forEach(r => {
            const time = new Date(r.timestamp).toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
            reportText += `${time} - ${r.reason}: -${r.amount.toFixed(2)} RSD
`;
        });
        reportText += `${'─'.repeat(40)}
Ukupno smanjeno: -${report.totalCashReductions.toFixed(2)} RSD
Stanje kase: ${report.finalCash.toFixed(2)} RSD
`;
    }

    // Plata
    if (report.salary) {
        reportText += `
💰 PLATA
Satnica: ${report.hourlyRate || 350} RSD/sat
Trajanje: ${hours}h ${mins}min
Plata: ${report.salary.toFixed(2)} RSD
`;
    }

    if(topItems.length > 0) {
        reportText += `
🏆 TOP ${topItems.length} PRODATIH JELA
${'='.repeat(60)}
`;
        topItems.forEach((item, idx) => {
            reportText += `${idx+1}. ${item.name.padEnd(30)} ${item.qty} kom  ${item.revenue.toFixed(2)} RSD
`;
        });
    }
    
    // Detaljna lista narudžbina
    if(report.orders.length > 0) {
        reportText += `

📋 DETALJNA LISTA NARUDŽBINA
${'='.repeat(60)}
`;
        report.orders.forEach((order, idx) => {
            const orderTime = new Date(order.time).toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
            reportText += `
Narudžbina #${idx+1} - ${orderTime} - ${order.method}
`;
            order.items.forEach(item => {
                reportText += `  • ${item.name} x${item.qty} = ${(item.price * item.qty).toFixed(2)} RSD
`;
            });
            reportText += `  UKUPNO: ${order.tot.toFixed(2)} RSD
`;
        });
    }
    
    reportText += `

${'='.repeat(60)}
Generisano: ${new Date().toLocaleString('sr-RS')}
${'='.repeat(60)}
`;
    
    // Prikaži modal sa tekstom
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:900px;max-height:90vh;display:flex;flex-direction:column">
            <h2 style="color:#E94560;margin-bottom:12px;flex-shrink:0">📋 Dnevni Izveštaj</h2>
            <p style="color:#B0B0B0;margin-bottom:12px;font-size:13px;flex-shrink:0">
                <strong style="color:#FFD700">Kako koristiti:</strong><br>
                Klikni u tekst → <kbd style="background:#0F3460;padding:2px 6px;border-radius:4px">Ctrl+A</kbd> → <kbd style="background:#0F3460;padding:2px 6px;border-radius:4px">Ctrl+C</kbd>
            </p>
            <div style="flex:1;overflow-y:auto;margin-bottom:12px;min-height:0">
                <textarea readonly style="width:100%;height:100%;min-height:300px;font-family:monospace;font-size:13px;padding:16px;background:#16213E;color:#FFF;border:2px solid #2A2A4A;border-radius:8px;resize:none;line-height:1.5" id="reportTextarea" onclick="this.select()">${reportText}</textarea>
            </div>
            <div style="display:flex;gap:12px;flex-shrink:0">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Zatvori</button>
                <button class="btn" onclick="copyFromTextarea()">📋 Kopiraj</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Auto-selektuj tekst
    setTimeout(() => {
        const textarea = document.getElementById('reportTextarea');
        if(textarea) textarea.select();
    }, 100);
}


function copyFromTextarea() {
    const textarea = document.getElementById('reportTextarea');
    if(!textarea) return;
    
    const text = textarea.value;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showAlert('✅ Izveštaj je kopiran!\n\nMožete zatvoriti ovaj prozor i nalepiti bilo gde.');
        }).catch(() => {
            // Fallback za starije browsere
            textarea.select();
            textarea.setSelectionRange(0, 99999);
            try {
                document.execCommand('copy');
                showAlert('✅ Izveštaj je kopiran!\n\nMožete zatvoriti ovaj prozor i nalepiti bilo gde.');
            } catch(err) {
                showAlert('Pritisnite Ctrl+C (ili Cmd+C) da kopirate selektovani tekst.');
            }
        });
    } else {
        // Fallback za browsere bez Clipboard API
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        try {
            document.execCommand('copy');
            showAlert('✅ Izveštaj je kopiran!\n\nMožete zatvoriti ovaj prozor i nalepiti bilo gde.');
        } catch(err) {
            showAlert('Pritisnite Ctrl+C (ili Cmd+C) da kopirate selektovani tekst.');
        }
    }
}


function renderReport(c) {
    const businessDay = getBusinessDayRange();
    const isWaiter = DB.currentUser.role === 'waiter' || DB.currentUser.role === 'konobar';
    const currentUsername = DB.currentUser.username;
    const myWorkday = DB.workdays && DB.workdays[currentUsername];
    
    // Filtriraj narudžbine — konobar: od početka smene, admin: radni dan (7:00-7:00)
    let ords;
    if (isWaiter && myWorkday) {
        ords = DB.orders.filter(o => o.time >= myWorkday.startTime && (!o.createdBy || o.createdBy === currentUsername));
    } else {
        ords = DB.orders.filter(o => o.time >= businessDay.start && o.time < businessDay.end);
    }
    
    // Ako je konobar bez aktivne smene, prikaži radni dan
    if (isWaiter && !myWorkday) {
        ords = DB.orders.filter(o => 
            o.time >= businessDay.start && o.time < businessDay.end && 
            (!o.createdBy || o.createdBy === currentUsername)
        );
    }
    
    const rev = ords.reduce((s,o)=>s+o.tot,0);
    const cash = ords.filter(o=>o.method==='Cash').reduce((s,o)=>s+o.tot,0);
    const card = ords.filter(o=>o.method==='Card').reduce((s,o)=>s+o.tot,0);
    
    // Grupisanje po konobarima (samo za admina)
    const ordersByUser = {};
    if (!isWaiter) {
        ords.forEach(order => {
            const user = order.createdBy || 'Nepoznato';
            if(!ordersByUser[user]) ordersByUser[user] = {count: 0, revenue: 0};
            ordersByUser[user].count++;
            ordersByUser[user].revenue += order.tot;
        });
    }
    
    // ===== 1. NASLOV =====
    const reportTitle = isWaiter && myWorkday ? 'Moj Izveštaj Smene' : (isWaiter ? 'Moj Dnevni Izveštaj' : 'Dnevni Izveštaj');
    let h = `<h2>📊 ${reportTitle}</h2>
        <p style="color:#B0B0B0;text-align:center;margin:8px 0 4px">${new Date().toLocaleDateString('sr-RS')}</p>`;
    
    if (isWaiter && myWorkday) {
        const shiftStart = new Date(myWorkday.startTime);
        h += `<p style="color:#FF9800;text-align:center;margin:0 0 20px;font-size:12px">
            🔓 Smena od ${shiftStart.toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'})}
        </p>`;
    }
    
    if (!isWaiter) {
        h += `<p style="color:#B0B0B0;text-align:center;margin:0 0 20px;font-size:12px">
            Ukupno narudžbina u sistemu: ${DB.orders.length} | 
            Danas: ${ords.length}
        </p>`;
    }
    
    // ===== 2. NAČINI PLAĆANJA =====
    const debtPayments = ords.filter(o => o.isDebtPayment);
    const debtTotal = debtPayments.reduce((s,o) => s + o.tot, 0);
    const regularRev = rev - debtTotal;
    const regularCash = ords.filter(o => o.method==='Cash' && !o.isDebtPayment).reduce((s,o) => s + o.tot, 0);
    const regularCard = ords.filter(o => o.method==='Card' && !o.isDebtPayment).reduce((s,o) => s + o.tot, 0);
    
    h += `<div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
        <h3 style="color:#E94560;margin-bottom:16px">💰 Načini Plaćanja</h3>
        <div style="display:flex;gap:16px">
            <div style="flex:1;background:#16213E;padding:16px;border-radius:8px;text-align:center">
                <div style="font-size:32px">💵</div>
                <div style="color:#FFD700;font-size:20px;font-weight:bold;margin:8px 0">${cash.toFixed(0)} din.</div>
                <div style="color:#B0B0B0;font-size:12px">Cash (${rev>0?Math.round(cash/rev*100):0}%)</div>
            </div>
            <div style="flex:1;background:#16213E;padding:16px;border-radius:8px;text-align:center">
                <div style="font-size:32px">💳</div>
                <div style="color:#FFD700;font-size:20px;font-weight:bold;margin:8px 0">${card.toFixed(0)} din.</div>
                <div style="color:#B0B0B0;font-size:12px">Card (${rev>0?Math.round(card/rev*100):0}%)</div>
            </div>
        </div>`;
    
    // Debt payments info
    if (debtTotal > 0) {
        h += `<div style="margin-top:12px;padding:12px;background:#16213E;border-radius:8px;border-left:4px solid #FF9800">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                    <span style="color:#FF9800;font-weight:bold;font-size:14px">📝 Vraćeni dugovi</span>
                    <span style="color:#888;font-size:12px;margin-left:8px">(${debtPayments.length})</span>
                </div>
                <span style="color:#FF9800;font-weight:bold;font-size:16px">+${debtTotal.toFixed(0)} din.</span>
            </div>
            <div style="color:#888;font-size:12px;margin-top:4px">
                Uračunato u ukupan prihod${regularRev > 0 ? ' · Bez dugova: ' + regularRev.toFixed(0) + ' din.' : ''}
            </div>
        </div>`;
    }
    
    // New debts today
    const todayDebts = (DB.debts || []).filter(d => {
        return d.time && d.time >= businessDay.start && d.time < businessDay.end && d.remaining > 0 && !d.deleted;
    });
    const todayDebtsTotal = todayDebts.reduce((s,d) => s + (d.originalTotal || 0), 0);
    
    if (todayDebtsTotal > 0) {
        h += `<div style="margin-top:8px;padding:12px;background:#16213E;border-radius:8px;border-left:4px solid #E94560">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                    <span style="color:#E94560;font-weight:bold;font-size:14px">📝 Zapisano na dug danas</span>
                    <span style="color:#888;font-size:12px;margin-left:8px">(${todayDebts.length})</span>
                </div>
                <span style="color:#E94560;font-weight:bold;font-size:16px">${todayDebtsTotal.toFixed(0)} din.</span>
            </div>
        </div>`;
    }
    
    // Total active debts
    const allActiveDebts = (DB.debts || []).filter(d => d.remaining > 0 && !d.deleted);
    const allActiveDebtsTotal = allActiveDebts.reduce((s,d) => s + d.remaining, 0);
    
    if (allActiveDebtsTotal > 0 && !isWaiter) {
        h += `<div style="margin-top:8px;padding:12px;background:#16213E;border-radius:8px;border-left:4px solid #FFD700">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="color:#FFD700;font-weight:bold;font-size:14px">📝 Ukupno nenaplaćeni dugovi</span>
                <span style="color:#FFD700;font-weight:bold;font-size:16px">${allActiveDebtsTotal.toFixed(0)} din.</span>
            </div>
            <div style="color:#888;font-size:12px;margin-top:4px">
                ${allActiveDebts.length} ${allActiveDebts.length === 1 ? 'dugovanje' : 'dugovanja'} · Pogledajte tab Dugovi za detalje
            </div>
        </div>`;
    }
    
    h += `</div>`;
    
    // ===== 3. STAT KARTICE =====
    h += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:20px 0">
        <div class="stat-card">
            <div class="stat-label">${isWaiter ? 'Moj prihod' : 'Ukupan prihod'}</div>
            <div class="stat-value">${rev.toFixed(0)}</div>
            <div class="stat-label">din.</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">${isWaiter ? 'Moje narudžbine' : 'Narudžbi danas'}</div>
            <div class="stat-value" style="color:#E94560">${ords.length}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Prosečan račun</div>
            <div class="stat-value" style="color:#4CAF50">${ords.length > 0 ? (rev/ords.length).toFixed(0) : 0}</div>
            <div class="stat-label">din.</div>
        </div>
    </div>`;
    
    // ===== 4 & 5. SMANJI KEŠ DUGME + SMANJENJA KEŠA (samo za konobara) =====
    if (isWaiter) {
        const myWorkday = DB.workdays && DB.workdays[currentUsername];
        
        // 4. Dugme za smanjenje keša
        if (myWorkday) {
            h += `<button class="btn" style="margin-bottom:16px;width:100%;background:#FF6B6B" onclick="openCashReductionModal()">
                💸 Smanji Keš
            </button>`;
        }
        
        // 5. Smanjenja keša lista
        if (myWorkday && myWorkday.cashReductions && myWorkday.cashReductions.length > 0) {
            const totalReductions = myWorkday.cashReductions.reduce((sum, r) => sum + r.amount, 0);
            h += `
                <div style="background:#0F3460;padding:16px;border-radius:12px;margin-bottom:20px;border-left:4px solid #FF6B6B">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                        <h4 style="color:#FF6B6B;margin:0">💸 Smanjenja Keša (${myWorkday.cashReductions.length})</h4>
                        <span style="color:#FF6B6B;font-weight:bold">-${totalReductions.toFixed(0)} din.</span>
                    </div>`;
            
            myWorkday.cashReductions.forEach((r, index) => {
                const time = new Date(r.timestamp).toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
                h += `
                    <div style="background:#16213E;padding:8px 12px;border-radius:6px;margin-bottom:8px;font-size:12px">
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                            <span style="color:#B0B0B0">${time}</span>
                            <span style="color:#FF6B6B;font-weight:bold">-${r.amount.toFixed(0)} din.</span>
                        </div>
                        <div style="color:#FFF">${r.reason}</div>
                    </div>`;
            });
            
            h += `
                <div style="margin-top:12px;padding-top:12px;border-top:1px solid #2A2A4A">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <span style="color:#B0B0B0;font-size:13px">💰 U kasi:</span>
                        <span style="color:#FFD700;font-weight:bold;font-size:16px">${((myWorkday.deposit || 0) + cash - totalReductions).toFixed(0)} din.</span>
                    </div>
                </div>
            </div>`;
        }
    }
    
    // ===== PRIKAZ PO KONOBARIMA - SAMO ZA ADMINA =====
    if(!isWaiter && Object.keys(ordersByUser).length > 0) {
        h += `<div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#E94560;margin-bottom:16px">👥 Aktivnost Konobara</h3>`;
        
        // Sortiraj konobara po prihodu (najveći prihod prvo)
        const sortedUsers = Object.entries(ordersByUser).sort((a, b) => b[1].revenue - a[1].revenue);
        
        sortedUsers.forEach(([user, data], index) => {
            const percent = rev > 0 ? Math.round(data.revenue / rev * 100) : 0;
            const avgOrder = data.count > 0 ? (data.revenue / data.count).toFixed(0) : 0;
            
            // Izračunaj progress bar za vizuelni prikaz
            const maxRevenue = sortedUsers[0][1].revenue;
            const progressPercent = maxRevenue > 0 ? Math.round((data.revenue / maxRevenue) * 100) : 0;
            
            // Badge za poziciju
            const positionBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            
            h += `<div style="background:#16213E;padding:16px;border-radius:8px;margin-bottom:12px;border-left:4px solid ${index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#2A2A4A'};cursor:pointer" onclick="showWaiterOrders('${user}')">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="font-size:20px">${positionBadge}</span>
                        <div>
                            <div style="color:#FFD700;font-weight:bold;font-size:16px">👨‍🍳 ${user}</div>
                            <div style="color:#B0B0B0;font-size:11px">${data.count} ${data.count === 1 ? 'narudžbina' : 'narudžbine'} · Klikni za detalje</div>
                        </div>
                    </div>
                    <div style="text-align:right">
                        <div style="color:#4CAF50;font-size:20px;font-weight:bold">${data.revenue.toFixed(0)} din.</div>
                        <div style="color:#B0B0B0;font-size:11px">${percent}% prihoda</div>
                    </div>
                </div>
                
                <!-- Progress bar -->
                <div style="background:#0F3460;height:8px;border-radius:4px;overflow:hidden;margin-bottom:8px">
                    <div style="background:linear-gradient(90deg, #E94560, #FFD700);height:100%;width:${progressPercent}%;border-radius:4px;transition:width 0.3s"></div>
                </div>
                
                <!-- Dodatne statistike -->
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px">
                    <div style="background:#0F3460;padding:8px;border-radius:6px;text-align:center">
                        <div style="color:#B0B0B0;font-size:10px">Prosečan račun</div>
                        <div style="color:#FFD700;font-size:14px;font-weight:bold">${avgOrder} din.</div>
                    </div>
                    <div style="background:#0F3460;padding:8px;border-radius:6px;text-align:center">
                        <div style="color:#B0B0B0;font-size:10px">Učešće</div>
                        <div style="color:#4CAF50;font-size:14px;font-weight:bold">${percent}%</div>
                    </div>
                    <div style="background:#0F3460;padding:8px;border-radius:6px;text-align:center">
                        <div style="color:#B0B0B0;font-size:10px">Pozicija</div>
                        <div style="color:#E94560;font-size:14px;font-weight:bold">#${index + 1}</div>
                    </div>
                </div>
            </div>`;
        });
        
        h += `</div>`;
    }
    
    // ===== 6 & 7. LISTA NARUDŽBINA + PRIKAŽI SVE =====
    if(ords.length === 0) {
        h += `<div class="empty"><div style="font-size:64px">📭</div><h3>${isWaiter ? 'Nemaš narudžbi danas' : 'Nema narudžbi danas'}</h3>`;
        if(!isWaiter && DB.orders.length > 0) {
            h += `<p style="color:#B0B0B0;margin-top:12px">Ali imate ${DB.orders.length} ${DB.orders.length === 1 ? 'narudžbinu' : 'narudžbina'} iz prethodnih dana</p>`;
            h += `<button class="btn" style="max-width:300px;margin:20px auto 0" onclick="showAllOrders()">Prikaži sve narudžbine</button>`;
        }
        h += '</div>';
    } else {
        // Prikaži poslednje narudžbine
        h += `<div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#E94560;margin-bottom:16px">📋 ${isWaiter ? 'Moje Narudžbine' : 'Poslednje Narudžbine'}</h3>`;
        
        const recentOrders = [...ords].reverse().slice(0, 10);
        
        if(ords.length > 10) {
            h += `<p style="color:#B0B0B0;font-size:12px;margin-bottom:12px;text-align:center">
                Prikazano ${recentOrders.length} od ${ords.length} narudžbina
            </p>`;
        }
        
        recentOrders.forEach((order, idx) => {
            const time = new Date(order.time).toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
            const tableName = order.tableName || `Sto ${order.table}`;
            
            h += `<div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px;cursor:pointer" onclick="toggleOrderDetails(${order.id})">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="flex:1">
                        <div style="color:#FFD700;font-weight:bold">${tableName}</div>
                        <div style="color:#B0B0B0;font-size:12px">
                            ${time} · 
                            ${order.items.length} ${order.items.length === 1 ? 'artikal' : 'artikla'} · 
                            ${order.method}`;
            
            // Prikaži konobarevo ime SAMO ako je admin
            if (!isWaiter && order.createdBy) {
                h += ` · 👨‍🍳 ${order.createdBy}`;
            }
            
            h += `</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px">
                        <div style="color:#4CAF50;font-size:18px;font-weight:bold">${order.tot.toFixed(0)} din.</div>
                        <div style="color:#B0B0B0;font-size:20px" id="arrow_${order.id}">▼</div>
                    </div>
                </div>
                
                <!-- Detalji artikala (sakriveni po defaultu) -->
                <div id="details_${order.id}" style="display:none;border-top:1px solid #2A2A4A;margin-top:12px;padding-top:12px">
                    <div style="color:#E94560;font-weight:bold;margin-bottom:8px;font-size:13px">Artikli:</div>`;
            
            order.items.forEach(item => {
                const isDiscounted = order.discountedItems && order.discountedItems.includes(item.id);
                h += `<div style="display:flex;justify-content:space-between;color:#B0B0B0;font-size:13px;margin:4px 0;padding-left:12px">
                    <span>${item.qty}x ${item.name}${isDiscounted && order.discountPercent ? ` <span style="color:#4CAF50">(-${order.discountPercent}%)</span>` : ''}</span>
                    <span>${(item.price * item.qty).toFixed(0)} din.</span>
                </div>`;
            });
            
            h += `<div style="border-top:1px solid #2A2A4A;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-size:13px">
                    <span style="color:#B0B0B0">Subtotal:</span>
                    <span style="color:#FFF">${order.sub.toFixed(0)} din.</span>
                </div>`;
            
            if(order.disc > 0) {
                h += `<div style="display:flex;justify-content:space-between;font-size:13px;color:#4CAF50">
                    <span>Popust${order.discountPercent ? ` (${order.discountPercent}%)` : ''}:</span>
                    <span>-${order.disc.toFixed(0)} din.</span>
                </div>`;
            }
            
            h += `<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin-top:4px">
                    <span style="color:#FFD700">UKUPNO:</span>
                    <span style="color:#FFD700">${order.tot.toFixed(0)} din.</span>
                </div>
            </div>
            </div>`;
        });
        
        if(ords.length > 10) {
            h += `<button class="btn btn-secondary" style="margin-top:12px;width:100%" onclick="showAllTodayOrders()">
                📋 Prikaži sve narudžbine (${ords.length})
            </button>`;
        }
        
        h += `</div>`;
    }
    
    // ===== 8. INFO TEKST (samo za konobara) =====
    if (isWaiter) {
        h += `<p style="color:#B0B0B0;text-align:center;margin:12px 0 20px;font-size:12px">
            Moje narudžbine ${myWorkday ? 'u smeni' : 'danas'}: ${ords.length}
        </p>`;
    }
    
    // ===== 9. UKUPAN DNEVNI IZVEŠTAJ - SAMO ZA KONOBARA =====
    // ===== UKUPAN DNEVNI IZVEŠTAJ - ZA SVE =====
    {
        // Izračunaj ukupan dnevni izveštaj (svi konobari)
        const allTodayOrders = DB.orders.filter(o => 
            o.time >= businessDay.start && o.time < businessDay.end
        );
        
        const totalDailyRevenue = allTodayOrders.reduce((s,o)=>s+o.tot,0);
        const totalDailyOrders = allTodayOrders.length;
        const totalDailyCash = allTodayOrders.filter(o=>o.method==='Cash').reduce((s,o)=>s+o.tot,0);
        const totalDailyCard = allTodayOrders.filter(o=>o.method==='Card').reduce((s,o)=>s+o.tot,0);
        
        // Izračunaj depozit i smanjenja keša za ovaj radni dan
        // DEPOZIT: samo od PRVE smene (originalni unos), ne od nasleđenih
        let totalDeposit = 0;
        let totalCashReductions = 0;
        let firstShiftDeposit = 0;
        if (DB.workdays) {
            const todayShifts = Object.values(DB.workdays).filter(wd => 
                wd.startTime && wd.startTime >= businessDay.start && wd.startTime < businessDay.end
            );
            // Sortiraj po vremenu početka, najranija smena = prva
            todayShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
            todayShifts.forEach((wd, idx) => {
                // Samo prva smena ima originalni depozit
                if (idx === 0 || !wd.inheritedFrom) {
                    totalDeposit += wd.deposit || 0;
                }
                if (wd.cashReductions && wd.cashReductions.length > 0) {
                    totalCashReductions += wd.cashReductions.reduce((sum, r) => sum + r.amount, 0);
                }
            });
        }
        
        // Keš = depozit + otkucani keš - smanjenja keša
        const finalDailyCash = totalDeposit + totalDailyCash - totalCashReductions;
        
        h += `<div style="background:#0F3460;padding:20px;border-radius:12px;margin-top:20px;border:2px solid #2A2A4A">
            <h3 style="color:#FFD700;margin-bottom:16px">📊 Ukupan Dnevni Izveštaj (Svi Konobari)</h3>
            <p style="color:#B0B0B0;font-size:12px;margin-bottom:16px">Svi konobari zajedno za današnji dan</p>
            
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px">
                <div class="stat-card">
                    <div class="stat-label">Ukupan prihod</div>
                    <div class="stat-value">${totalDailyRevenue.toFixed(0)}</div>
                    <div class="stat-label">din.</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Ukupno narudžbi</div>
                    <div class="stat-value" style="color:#E94560">${totalDailyOrders}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Prosečan račun</div>
                    <div class="stat-value" style="color:#4CAF50">${totalDailyOrders > 0 ? (totalDailyRevenue/totalDailyOrders).toFixed(0) : 0}</div>
                    <div class="stat-label">din.</div>
                </div>
            </div>
            
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:12px">
                <div style="background:#16213E;padding:16px;border-radius:8px;text-align:center">
                    <div style="font-size:24px">💵</div>
                    <div style="color:#4CAF50;font-size:10px;margin-top:4px">Depozit + Keš - Smanjenja</div>
                    <div style="color:#FFD700;font-size:22px;font-weight:bold;margin:8px 0">${finalDailyCash.toFixed(0)} din.</div>
                    <div style="color:#B0B0B0;font-size:11px">Keš u kasi</div>
                </div>
                <div style="background:#16213E;padding:16px;border-radius:8px;text-align:center">
                    <div style="font-size:24px">💳</div>
                    <div style="color:transparent;font-size:10px;margin-top:4px">-</div>
                    <div style="color:#FFD700;font-size:22px;font-weight:bold;margin:8px 0">${totalDailyCard.toFixed(0)} din.</div>
                    <div style="color:#B0B0B0;font-size:11px">Kartice</div>
                </div>
            </div>
            
            <div style="background:#16213E;padding:16px;border-radius:8px">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                    <span style="color:#B0B0B0;font-size:13px">💵 Depozit:</span>
                    <span style="color:#9C27B0;font-weight:bold">${totalDeposit.toFixed(0)} din.</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                    <span style="color:#B0B0B0;font-size:13px">💵 Otkucani keš:</span>
                    <span style="color:#4CAF50;font-weight:bold">+${totalDailyCash.toFixed(0)} din.</span>
                </div>`;
        
        // Vraćeni dugovi
        const dailyDebtPayments = allTodayOrders.filter(o => o.isDebtPayment);
        const dailyDebtCash = dailyDebtPayments.filter(o => o.method === 'Cash').reduce((s,o) => s + o.tot, 0);
        const dailyDebtCard = dailyDebtPayments.filter(o => o.method === 'Card').reduce((s,o) => s + o.tot, 0);
        const dailyDebtTotal = dailyDebtPayments.reduce((s,o) => s + o.tot, 0);
        
        if (dailyDebtTotal > 0) {
            h += `<div style="display:flex;justify-content:space-between;margin-bottom:8px">
                    <span style="color:#B0B0B0;font-size:13px">📝 Vraćeni dugovi:</span>
                    <span style="color:#FF9800;font-weight:bold">+${dailyDebtTotal.toFixed(0)} din.</span>
                </div>`;
            if (dailyDebtCash > 0) {
                h += `<div style="display:flex;justify-content:space-between;margin-bottom:8px;padding-left:16px">
                    <span style="color:#888;font-size:12px">↳ Keš:</span>
                    <span style="color:#888;font-size:12px">${dailyDebtCash.toFixed(0)} din.</span>
                </div>`;
            }
            if (dailyDebtCard > 0) {
                h += `<div style="display:flex;justify-content:space-between;margin-bottom:8px;padding-left:16px">
                    <span style="color:#888;font-size:12px">↳ Kartica:</span>
                    <span style="color:#888;font-size:12px">${dailyDebtCard.toFixed(0)} din.</span>
                </div>`;
            }
        }
        
        // Aktivna dugovanja danas
        const todayNewDebts = (DB.debts || []).filter(d => {
            return d.time && d.time >= businessDay.start && d.time < businessDay.end && !d.deleted;
        });
        const todayNewDebtsTotal = todayNewDebts.reduce((s,d) => s + (d.originalTotal || 0), 0);
        
        if (todayNewDebtsTotal > 0) {
            h += `<div style="display:flex;justify-content:space-between;margin-bottom:8px">
                    <span style="color:#B0B0B0;font-size:13px">📝 Zapisano na dug:</span>
                    <span style="color:#E94560;font-weight:bold">${todayNewDebtsTotal.toFixed(0)} din. (${todayNewDebts.length})</span>
                </div>`;
        }
        
        h += `<div style="display:flex;justify-content:space-between;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #2A2A4A">
                    <span style="color:#B0B0B0;font-size:13px">💸 Smanjen keš:</span>
                    <span style="color:#FF6B6B;font-weight:bold">${totalCashReductions > 0 ? '-' : ''}${totalCashReductions.toFixed(0)} din.</span>
                </div>
                <div style="display:flex;justify-content:space-between">
                    <span style="color:#FFD700;font-size:14px;font-weight:bold">= Keš u kasi:</span>
                    <span style="color:#FFD700;font-size:16px;font-weight:bold">${finalDailyCash.toFixed(0)} din.</span>
                </div>
            </div>
        </div>`;
    }
    
    c.innerHTML = h;
}



function showAllTodayOrders() {
    const businessDay = getBusinessDayRange();
    const isWaiter = DB.currentUser.role === 'waiter' || DB.currentUser.role === 'konobar';
    const currentUsername = DB.currentUser.username;
    const myWorkday = DB.workdays && DB.workdays[currentUsername];
    
    let todayOrders;
    if (isWaiter && myWorkday) {
        todayOrders = DB.orders.filter(o => o.time >= myWorkday.startTime && (!o.createdBy || o.createdBy === currentUsername));
    } else if (isWaiter) {
        todayOrders = DB.orders.filter(o => o.time >= businessDay.start && o.time < businessDay.end && (!o.createdBy || o.createdBy === currentUsername));
    } else {
        todayOrders = DB.orders.filter(o => o.time >= businessDay.start && o.time < businessDay.end);
    }
    todayOrders = todayOrders.reverse();
    
    const titleText = isWaiter && myWorkday ? 'Sve Narudžbine Smene' : 'Sve Narudžbine Danas';
    
    let h = '<div style="max-width:800px;margin:0 auto">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">';
    h += '<button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="page=\'report\';render()">← Nazad</button>';
    h += '<h2>📋 ' + titleText + ' (' + todayOrders.length + ')</h2>';
    h += '<div style="width:80px"></div></div>';
    
    todayOrders.forEach(function(order) {
        var time = new Date(order.time).toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
        var tableName = order.tableName || ('Sto ' + order.table);
        
        h += '<div style="background:#0F3460;padding:16px;border-radius:12px;margin-bottom:12px;cursor:pointer" onclick="toggleOrderDetails(' + order.id + ')">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
        h += '<div style="flex:1">';
        h += '<div style="color:#FFD700;font-weight:bold;font-size:18px">' + tableName + '</div>';
        h += '<div style="color:#B0B0B0;font-size:12px">' + time + ' · ' + order.items.length + ' ' + (order.items.length === 1 ? 'artikal' : 'artikla') + ' · ' + order.method;
        
        if (!isWaiter && order.createdBy) {
            h += ' · 👨‍🍳 ' + order.createdBy;
        }
        
        h += '</div></div>';
        h += '<div style="display:flex;align-items:center;gap:12px">';
        h += '<div style="color:#4CAF50;font-size:20px;font-weight:bold">' + order.tot.toFixed(0) + ' din.</div>';
        h += '<div style="color:#B0B0B0;font-size:20px" id="arrow_' + order.id + '">▼</div>';
        h += '</div></div>';
        
        h += '<div id="details_' + order.id + '" style="display:none;border-top:1px solid #2A2A4A;padding-top:8px;margin-top:8px">';
        h += '<div style="color:#E94560;font-weight:bold;margin-bottom:8px;font-size:13px">Artikli:</div>';
        
        order.items.forEach(function(item) {
            var isDiscounted = order.discountedItems && order.discountedItems.includes(item.id);
            h += '<div style="display:flex;justify-content:space-between;color:#B0B0B0;font-size:13px;margin:4px 0;padding-left:12px">';
            h += '<span>' + item.qty + 'x ' + item.name;
            if (isDiscounted && order.discountPercent) {
                h += ' <span style="color:#4CAF50">(-' + order.discountPercent + '%)</span>';
            }
            h += '</span>';
            h += '<span>' + (item.price * item.qty).toFixed(0) + ' din.</span>';
            h += '</div>';
        });
        
        h += '<div style="border-top:1px solid #2A2A4A;margin-top:8px;padding-top:8px">';
        h += '<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin-top:4px">';
        h += '<span style="color:#FFD700">UKUPNO:</span>';
        h += '<span style="color:#FFD700">' + order.tot.toFixed(0) + ' din.</span>';
        h += '</div></div></div></div>';
    });
    
    h += '</div>';
    document.getElementById('content').innerHTML = h;
}


function showAllOrders() {
    const allOrders = [...DB.orders].reverse();
    let h = `<div style="max-width:800px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
            <button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="page='report';render()">← Nazad</button>
            <h2>📋 Sve Narudžbine</h2>
            <div style="width:80px"></div>
        </div>`;
    
    allOrders.forEach(order => {
        const date = new Date(order.time).toLocaleDateString('sr-RS');
        const time = new Date(order.time).toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
        const tableName = order.tableName || `Sto ${order.table}`;
        
        h += `<div style="background:#0F3460;padding:16px;border-radius:12px;margin-bottom:12px;cursor:pointer" onclick="toggleOrderDetails(${order.id})">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="flex:1">
                    <div style="color:#FFD700;font-weight:bold;font-size:18px">${tableName}</div>
                    <div style="color:#B0B0B0;font-size:12px">
                        ${date} ${time} · 
                        ${order.items.length} ${order.items.length === 1 ? 'artikal' : 'artikla'} · 
                        ${order.method}
                        ${order.createdBy ? ' · 👨‍🍳 ' + order.createdBy : ''}
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:12px">
                    <div style="color:#4CAF50;font-size:20px;font-weight:bold">${order.tot.toFixed(0)} din.</div>
                    <div style="color:#B0B0B0;font-size:20px" id="arrow_${order.id}">▼</div>
                </div>
            </div>
            
            <div id="details_${order.id}" style="display:none;border-top:1px solid #2A2A4A;padding-top:8px;margin-top:8px">
                <div style="color:#E94560;font-weight:bold;margin-bottom:8px;font-size:13px">Artikli:</div>`;
        
        order.items.forEach(item => {
            const isDiscounted = order.discountedItems && order.discountedItems.includes(item.id);
            h += `<div style="display:flex;justify-content:space-between;color:#B0B0B0;font-size:13px;margin:4px 0;padding-left:12px">
                <span>${item.qty}x ${item.name}${isDiscounted && order.discountPercent ? ` <span style="color:#4CAF50">(-${order.discountPercent}%)</span>` : ''}</span>
                <span>${(item.price * item.qty).toFixed(0)} din.</span>
            </div>`;
        });
        
        h += `<div style="border-top:1px solid #2A2A4A;margin-top:8px;padding-top:8px">
                <div style="display:flex;justify-content:space-between;font-size:13px">
                    <span style="color:#B0B0B0">Subtotal:</span>
                    <span style="color:#FFF">${order.sub.toFixed(0)} din.</span>
                </div>`;
        
        if(order.disc > 0) {
            h += `<div style="display:flex;justify-content:space-between;font-size:13px;color:#4CAF50;margin-top:4px">
                <span>Popust${order.discountPercent ? ` (${order.discountPercent}%)` : ''}:</span>
                <span>-${order.disc.toFixed(0)} din.</span>
            </div>`;
        }
        
        h += `<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin-top:4px">
                <span style="color:#FFD700">UKUPNO:</span>
                <span style="color:#FFD700">${order.tot.toFixed(0)} din.</span>
            </div>
        </div>
        </div>`;
        
        h += `</div>`;
    });
    
    h += `</div>`;
    document.getElementById('content').innerHTML = h;
}


function toggleOrderDetails(orderId) {
    const detailsDiv = document.getElementById('details_' + orderId);
    const arrowDiv = document.getElementById('arrow_' + orderId);
    
    if(detailsDiv && arrowDiv) {
        if(detailsDiv.style.display === 'none') {
            detailsDiv.style.display = 'block';
            arrowDiv.textContent = '▲';
        } else {
            detailsDiv.style.display = 'none';
            arrowDiv.textContent = '▼';
        }
    }
}


function showWaiterOrders(waiterName) {
    const bdRange = getBusinessDayRange();
    const waiterOrders = DB.orders.filter(o => o.createdBy === waiterName && o.time >= bdRange.start && o.time < bdRange.end).reverse();
    const waiterRemoved = DB.removedItems.filter(r => r.removedBy === waiterName && r.removedAt && r.removedAt >= bdRange.start && r.removedAt < bdRange.end);
    const waiterSessions = DB.workdayHistory.filter(s => s.user === waiterName).reverse();
    
    const totalRevenue = waiterOrders.reduce((s,o)=>s+o.tot,0);
    const cash = waiterOrders.filter(o=>o.method==='Cash').reduce((s,o)=>s+o.tot,0);
    const card = waiterOrders.filter(o=>o.method==='Card').reduce((s,o)=>s+o.tot,0);
    const avgOrder = waiterOrders.length > 0 ? (totalRevenue / waiterOrders.length).toFixed(0) : 0;
    
    // Statistika uklonjenih
    const totalRemovedValue = waiterRemoved.reduce((s, item) => s + (item.itemPrice * item.quantity), 0);
    const totalRemovedQty = waiterRemoved.reduce((s, item) => s + item.quantity, 0);
    
    // Statistika sesija
    const totalWorkMinutes = waiterSessions.reduce((s, session) => s + session.duration, 0);
    const totalWorkHours = Math.floor(totalWorkMinutes / 60);
    const totalWorkMins = totalWorkMinutes % 60;
    
    let h = `<div style="max-width:800px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
            <button class="btn btn-secondary" style="width:auto;padding:8px 16px" onclick="page='report';render()">← Nazad na Izveštaj</button>
            <h2>👨‍🍳 ${waiterName}</h2>
            <div style="width:120px"></div>
        </div>
        
        <!-- Statistika konobara -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
            <div class="stat-card">
                <div class="stat-label">Ukupan prihod</div>
                <div class="stat-value">${totalRevenue.toFixed(0)}</div>
                <div class="stat-label">din.</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Narudžbi</div>
                <div class="stat-value" style="color:#E94560">${waiterOrders.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Prosečan račun</div>
                <div class="stat-value" style="color:#4CAF50">${avgOrder}</div>
                <div class="stat-label">din.</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Uklonjeno artikala</div>
                <div class="stat-value" style="color:#FF9800">${totalRemovedQty}</div>
                <div class="stat-label">${totalRemovedValue.toFixed(0)} din.</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ukupno radio</div>
                <div class="stat-value" style="color:#9C27B0">${totalWorkHours}h ${totalWorkMins}min</div>
                <div class="stat-label">${waiterSessions.length} ${waiterSessions.length === 1 ? 'sesija' : 'sesije'}</div>
            </div>
        </div>
        
        <div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#E94560;margin-bottom:16px">💰 Načini Plaćanja</h3>
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
        </div>`;
    
    // Sekcija za sesije (prisustvo)
    if(waiterSessions.length > 0) {
        h += `<div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#9C27B0;margin-bottom:16px">🕐 Istorija Prisustva</h3>
            <p style="color:#B0B0B0;font-size:13px;margin-bottom:16px">
                Ukupno ${waiterSessions.length} ${waiterSessions.length === 1 ? 'sesija' : 'sesije'} · 
                ${totalWorkHours}h ${totalWorkMins}min rada
            </p>`;
        
        waiterSessions.slice(0, 20).forEach((session, idx) => {
            const loginDate = new Date(session.loginTime);
            const logoutDate = new Date(session.logoutTime);
            const date = loginDate.toLocaleDateString('sr-RS');
            const loginTime = loginDate.toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
            const logoutTime = logoutDate.toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
            const hours = Math.floor(session.duration / 60);
            const mins = session.duration % 60;
            
            h += `<div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="flex:1">
                        <div style="color:#FFD700;font-weight:bold">${date}</div>
                        <div style="color:#B0B0B0;font-size:12px">
                            🔓 ${loginTime} → 🔒 ${logoutTime}${session.autoClosed ? ' <span style="color:#FF9800;font-weight:bold">⏰ AUTO</span>' : ''} · 
                            ${session.orderCount} ${session.orderCount === 1 ? 'narudžbina' : 'narudžbine'}
                        </div>
                    </div>
                    <div style="text-align:right">
                        <div style="color:#9C27B0;font-size:16px;font-weight:bold">${hours}h ${mins}min</div>
                        <div style="color:#4CAF50;font-size:13px">${session.revenue.toFixed(0)} din.</div>
                    </div>
                </div>
            </div>`;
        });
        
        if(waiterSessions.length > 20) {
            h += `<p style="color:#B0B0B0;font-size:12px;text-align:center;margin-top:12px">
                ... i još ${waiterSessions.length - 20} ${waiterSessions.length - 20 === 1 ? 'sesija' : 'sesije'}
            </p>`;
        }
        
        h += `</div>`;
    }
    // Sekcija za uklonjene artikle
    if(waiterRemoved.length > 0) {
        h += `<div style="background:#0F3460;padding:20px;border-radius:12px;margin-bottom:20px">
            <h3 style="color:#FF9800;margin-bottom:16px">🗑️ Uklonjeni Artikli</h3>
            <p style="color:#B0B0B0;font-size:13px;margin-bottom:16px">
                Ukupno ${totalRemovedQty} ${totalRemovedQty === 1 ? 'artikal' : 'artikala'} u vrednosti od ${totalRemovedValue.toFixed(0)} din.
            </p>`;
        
        // Grupisanje po artiklima
        const itemGroups = {};
        waiterRemoved.forEach(item => {
            if(!itemGroups[item.itemName]) {
                itemGroups[item.itemName] = {
                    qty: 0,
                    value: 0,
                    instances: []
                };
            }
            itemGroups[item.itemName].qty += item.quantity;
            itemGroups[item.itemName].value += item.itemPrice * item.quantity;
            itemGroups[item.itemName].instances.push(item);
        });
        
        // Sortiraj po količini
        const sortedItems = Object.entries(itemGroups).sort((a, b) => b[1].qty - a[1].qty);
        
        sortedItems.forEach(([itemName, data]) => {
            h += `<div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px;cursor:pointer" onclick="toggleRemovedDetails('${itemName.replace(/'/g, "\\'")}')">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="flex:1">
                        <div style="color:#FFD700;font-weight:bold">${itemName}</div>
                        <div style="color:#B0B0B0;font-size:12px">
                            ${data.instances.length} ${data.instances.length === 1 ? 'put' : 'puta'} uklonjeno · 
                            Ukupno ${data.qty} kom
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px">
                        <div style="color:#FF9800;font-size:18px;font-weight:bold">${data.value.toFixed(0)} din.</div>
                        <div style="color:#B0B0B0;font-size:20px" id="removed_arrow_${itemName.replace(/\s/g, '_')}">▼</div>
                    </div>
                </div>
                
                <!-- Detalji instanci -->
                <div id="removed_details_${itemName.replace(/\s/g, '_')}" style="display:none;border-top:1px solid #2A2A4A;margin-top:12px;padding-top:12px">`;
            
            data.instances.reverse().forEach(instance => {
                const date = new Date(instance.removedAt).toLocaleDateString('sr-RS');
                const time = new Date(instance.removedAt).toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
                
                h += `<div style="background:#0F3460;padding:8px;border-radius:6px;margin-bottom:6px">
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
                        <div style="color:#B0B0B0">
                            ${date} ${time} · ${instance.tableName} · ${instance.quantity}x
                        </div>
                        <div style="color:#FF9800;font-weight:bold">${(instance.itemPrice * instance.quantity).toFixed(0)} din.</div>
                    </div>
                    <div style="color:#B0B0B0;font-size:11px;margin-top:4px;font-style:italic">
                        "${instance.reason}"
                    </div>
                </div>`;
            });
            
            h += `</div>
            </div>`;
        });
        
        h += `</div>`;
    }
    
    h += `<div style="background:#0F3460;padding:20px;border-radius:12px">
            <h3 style="color:#E94560;margin-bottom:16px">📋 Sve Narudžbine</h3>`;
    
    if(waiterOrders.length === 0) {
        h += '<div class="empty"><div style="font-size:48px">📭</div><p>Nema narudžbina</p></div>';
    } else {
        waiterOrders.forEach(order => {
            const date = new Date(order.time).toLocaleDateString('sr-RS');
            const time = new Date(order.time).toLocaleTimeString('sr-RS', {hour: '2-digit', minute: '2-digit'});
            const tableName = order.tableName || `Sto ${order.table}`;
            
            h += `<div style="background:#16213E;padding:12px;border-radius:8px;margin-bottom:8px;cursor:pointer" onclick="toggleOrderDetails(${order.id})">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="flex:1">
                        <div style="color:#FFD700;font-weight:bold">${tableName}</div>
                        <div style="color:#B0B0B0;font-size:12px">
                            ${date} ${time} · 
                            ${order.items.length} ${order.items.length === 1 ? 'artikal' : 'artikla'} · 
                            ${order.method}
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px">
                        <div style="color:#4CAF50;font-size:18px;font-weight:bold">${order.tot.toFixed(0)} din.</div>
                        <div style="color:#B0B0B0;font-size:20px" id="arrow_${order.id}">▼</div>
                    </div>
                </div>
                
                <div id="details_${order.id}" style="display:none;border-top:1px solid #2A2A4A;margin-top:12px;padding-top:12px">
                    <div style="color:#E94560;font-weight:bold;margin-bottom:8px;font-size:13px">Artikli:</div>`;
            
            order.items.forEach(item => {
                const isDiscounted = order.discountedItems && order.discountedItems.includes(item.id);
                h += `<div style="display:flex;justify-content:space-between;color:#B0B0B0;font-size:13px;margin:4px 0;padding-left:12px">
                    <span>${item.qty}x ${item.name}${isDiscounted && order.discountPercent ? ` <span style="color:#4CAF50">(-${order.discountPercent}%)</span>` : ''}</span>
                    <span>${(item.price * item.qty).toFixed(0)} din.</span>
                </div>`;
            });
            
            h += `<div style="border-top:1px solid #2A2A4A;margin-top:8px;padding-top:8px">
                    <div style="display:flex;justify-content:space-between;font-size:13px">
                        <span style="color:#B0B0B0">Subtotal:</span>
                        <span style="color:#FFF">${order.sub.toFixed(0)} din.</span>
                    </div>`;
            
            if(order.disc > 0) {
                h += `<div style="display:flex;justify-content:space-between;font-size:13px;color:#4CAF50;margin-top:4px">
                    <span>Popust${order.discountPercent ? ` (${order.discountPercent}%)` : ''}:</span>
                    <span>-${order.disc.toFixed(0)} din.</span>
                </div>`;
            }
            
            h += `<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin-top:4px">
                    <span style="color:#FFD700">UKUPNO:</span>
                    <span style="color:#FFD700">${order.tot.toFixed(0)} din.</span>
                </div>
            </div>
            </div>`;
        });
    }
    
    h += `</div></div>`;
    document.getElementById('content').innerHTML = h;
}


function toggleRemovedDetails(itemName) {
    const safeName = itemName.replace(/\s/g, '_');
    const detailsDiv = document.getElementById('removed_details_' + safeName);
    const arrowDiv = document.getElementById('removed_arrow_' + safeName);
    
    if(detailsDiv && arrowDiv) {
        if(detailsDiv.style.display === 'none') {
            detailsDiv.style.display = 'block';
            arrowDiv.textContent = '▲';
        } else {
            detailsDiv.style.display = 'none';
            arrowDiv.textContent = '▼';
        }
    }
}

