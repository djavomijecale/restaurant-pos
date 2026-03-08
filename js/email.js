// ============================================
// EMAIL IZVEŠTAJ PRI ZATVARANJU SMENE
// Koristi EmailJS (besplatan, 200 email/mesec)
// ============================================

function buildShiftReportText(report) {
    var lines = [];
    var restName = (DB.settings && DB.settings.name) || 'Restaurant POS';
    
    lines.push('═══════════════════════════════════');
    lines.push('  ' + restName + ' - Izveštaj Smene');
    lines.push('═══════════════════════════════════');
    lines.push('');
    lines.push('Konobar: ' + (report.user || '?'));
    lines.push('Datum: ' + new Date(report.startTime).toLocaleDateString('sr-RS'));
    lines.push('Početak: ' + new Date(report.startTime).toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'}));
    lines.push('Kraj: ' + new Date(report.endTime).toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'}));
    
    var hours = Math.floor(report.duration / 60);
    var mins = report.duration % 60;
    lines.push('Trajanje: ' + hours + 'h ' + mins + 'min');
    lines.push('');
    lines.push('─────────────────────────────────');
    lines.push('  FINANSIJSKI PREGLED');
    lines.push('─────────────────────────────────');
    lines.push('Ukupan prihod: ' + (report.totalRevenue || 0).toLocaleString('sr-RS') + ' din');
    lines.push('  💵 Keš: ' + (report.cashRevenue || 0).toLocaleString('sr-RS') + ' din');
    lines.push('  💳 Kartica: ' + (report.cardRevenue || 0).toLocaleString('sr-RS') + ' din');
    lines.push('Broj narudžbina: ' + (report.orderCount || 0));
    lines.push('');
    
    if (report.deposit > 0) {
        lines.push('─────────────────────────────────');
        lines.push('  STANJE KASE');
        lines.push('─────────────────────────────────');
        lines.push('Depozit (početno): ' + report.deposit.toLocaleString('sr-RS') + ' din');
        lines.push('+ Otkucani keš: ' + (report.cashRevenue || 0).toLocaleString('sr-RS') + ' din');
        if (report.totalCashReductions > 0) {
            lines.push('- Smanjenja keša: ' + report.totalCashReductions.toLocaleString('sr-RS') + ' din');
        }
        lines.push('= Keš u kasi: ' + (report.finalCash || 0).toLocaleString('sr-RS') + ' din');
        lines.push('');
    }
    
    lines.push('─────────────────────────────────');
    lines.push('  PLATA');
    lines.push('─────────────────────────────────');
    lines.push('Satnica: ' + (report.hourlyRate || 350) + ' din/sat');
    lines.push('Plata: ' + (report.salary || 0).toLocaleString('sr-RS') + ' din');
    
    if (report.bonusEarned) {
        lines.push('🎁 BONUS: ' + (report.bonusAmount || 0).toLocaleString('sr-RS') + ' din');
        lines.push('   Razlog: ' + (report.bonusReason || ''));
    }
    
    lines.push('');
    
    if (report.orders && report.orders.length > 0) {
        lines.push('─────────────────────────────────');
        lines.push('  NARUDŽBINE (' + report.orders.length + ')');
        lines.push('─────────────────────────────────');
        report.orders.forEach(function(o, idx) {
            var time = new Date(o.time).toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'});
            var items = o.items.map(function(it) { return it.name + ' x' + it.qty; }).join(', ');
            lines.push((idx + 1) + '. ' + time + ' | ' + o.method + ' | ' + o.tot.toFixed(0) + ' din');
            lines.push('   ' + items);
        });
    }
    
    lines.push('');
    lines.push('═══════════════════════════════════');
    lines.push('  Generisano: ' + new Date().toLocaleString('sr-RS'));
    lines.push('═══════════════════════════════════');
    
    return lines.join('\n');
}


async function sendShiftReportEmail(report) {
    var settings = DB.settings || {};
    var serviceId = settings.emailjsServiceId || '';
    var templateId = settings.emailjsTemplateId || '';
    var publicKey = settings.emailjsPublicKey || '';
    var recipients = settings.reportEmails || '';
    
    if (!serviceId || !templateId || !publicKey || !recipients) {
        console.log('📧 Email izveštaj: nije podešeno (nedostaje EmailJS konfiguracija ili email adrese)');
        return;
    }
    
    var reportText = buildShiftReportText(report);
    var restName = settings.name || 'Restaurant POS';
    var dateStr = new Date(report.startTime).toLocaleDateString('sr-RS');
    
    // EmailJS init
    if (typeof emailjs !== 'undefined') {
        emailjs.init(publicKey);
    } else {
        console.error('📧 EmailJS biblioteka nije učitana');
        return;
    }
    
    // Pošalji na svaki email
    var emailList = recipients.split(',').map(function(e) { return e.trim(); }).filter(function(e) { return e.includes('@'); });
    
    if (emailList.length === 0) {
        console.log('📧 Nema validnih email adresa');
        return;
    }
    
    var sent = 0;
    var failed = 0;
    
    for (var i = 0; i < emailList.length; i++) {
        try {
            await emailjs.send(serviceId, templateId, {
                to_email: emailList[i],
                waiter_name: report.user || 'Nepoznato',
                date: dateStr,
                restaurant_name: restName,
                report_text: reportText,
                total_revenue: (report.totalRevenue || 0).toFixed(0),
                cash: (report.cashRevenue || 0).toFixed(0),
                card: (report.cardRevenue || 0).toFixed(0),
                order_count: report.orderCount || 0,
                final_cash: (report.finalCash || 0).toFixed(0),
                salary: (report.salary || 0).toFixed(0)
            });
            sent++;
            console.log('📧 Email poslat na: ' + emailList[i]);
        } catch (err) {
            failed++;
            console.error('📧 Greška za ' + emailList[i] + ':', err);
        }
    }
    
    if (sent > 0) {
        console.log('📧 Izveštaj smene poslat na ' + sent + ' adresa');
    }
    if (failed > 0) {
        console.warn('📧 Neuspelo slanje na ' + failed + ' adresa');
    }
}


// ============================================
// ADMIN PODEŠAVANJA ZA EMAIL
// ============================================
function renderEmailSettings() {
    var settings = DB.settings || {};
    
    return '<div class="card" style="margin-bottom:16px;border:2px solid #2196F3">' +
        '<h3 style="color:#2196F3;margin-bottom:16px">📧 Email Izveštaji</h3>' +
        '<p style="color:#888;font-size:13px;margin-bottom:12px">Automatski šalje izveštaj smene na email kad konobar zatvori dan.</p>' +
        
        '<div style="margin-bottom:12px">' +
            '<label style="color:#888;font-size:12px;display:block;margin-bottom:4px">📧 Email adrese (razdvojene zarezom)</label>' +
            '<input type="text" id="emailReportAddresses" value="' + (settings.reportEmails || '') + '" ' +
                'placeholder="gazda@gmail.com, menadzer@gmail.com" ' +
                'style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:13px">' +
        '</div>' +
        
        '<details style="margin-bottom:12px">' +
            '<summary style="color:#2196F3;cursor:pointer;font-size:13px;font-weight:bold">⚙️ EmailJS Podešavanja</summary>' +
            '<div style="margin-top:10px;display:flex;flex-direction:column;gap:10px">' +
                '<div>' +
                    '<label style="color:#888;font-size:12px;display:block;margin-bottom:4px">Service ID</label>' +
                    '<input type="text" id="emailjsServiceId" value="' + (settings.emailjsServiceId || '') + '" ' +
                        'placeholder="service_xxxxxxx" ' +
                        'style="width:100%;padding:8px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:13px;font-family:monospace">' +
                '</div>' +
                '<div>' +
                    '<label style="color:#888;font-size:12px;display:block;margin-bottom:4px">Template ID</label>' +
                    '<input type="text" id="emailjsTemplateId" value="' + (settings.emailjsTemplateId || '') + '" ' +
                        'placeholder="template_xxxxxxx" ' +
                        'style="width:100%;padding:8px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:13px;font-family:monospace">' +
                '</div>' +
                '<div>' +
                    '<label style="color:#888;font-size:12px;display:block;margin-bottom:4px">Public Key</label>' +
                    '<input type="text" id="emailjsPublicKey" value="' + (settings.emailjsPublicKey || '') + '" ' +
                        'placeholder="xxxxxxxxxxxxxxx" ' +
                        'style="width:100%;padding:8px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:13px;font-family:monospace">' +
                '</div>' +
                '<div style="background:#16213E;padding:10px;border-radius:8px;color:#888;font-size:12px;line-height:1.6">' +
                    '<strong style="color:#FFF">Kako podesiti EmailJS:</strong><br>' +
                    '1. Napravi nalog na <strong style="color:#2196F3">emailjs.com</strong><br>' +
                    '2. Email Services → Add New → Gmail → poveži<br>' +
                    '3. Email Templates → Create → Subject: <code>Izveštaj smene - {{waiter_name}} - {{date}}</code><br>' +
                    '4. Template body: <code>{{report_text}}</code><br>' +
                    '5. Kopiraj Service ID, Template ID i Public Key ovde<br>' +
                    '6. U template podešavanjima, dodaj <code>to_email</code> u To Email polje' +
                '</div>' +
            '</div>' +
        '</details>' +
        
        '<div style="display:flex;gap:8px">' +
            '<button class="btn" style="flex:1;background:#4CAF50" onclick="saveEmailSettings()">💾 Sačuvaj</button>' +
            '<button class="btn" style="flex:1;background:#2196F3" onclick="testEmailReport()">📧 Test Email</button>' +
        '</div>' +
    '</div>';
}


function saveEmailSettings() {
    if (!DB.settings) DB.settings = {};
    DB.settings.reportEmails = (document.getElementById('emailReportAddresses') || {}).value || '';
    DB.settings.emailjsServiceId = (document.getElementById('emailjsServiceId') || {}).value || '';
    DB.settings.emailjsTemplateId = (document.getElementById('emailjsTemplateId') || {}).value || '';
    DB.settings.emailjsPublicKey = (document.getElementById('emailjsPublicKey') || {}).value || '';
    save();
    showAlert('✅ Email podešavanja sačuvana!');
}


async function testEmailReport() {
    saveEmailSettings();
    
    var testReport = {
        user: DB.currentUser ? DB.currentUser.username : 'Test',
        startTime: new Date(Date.now() - 8 * 3600000).toISOString(),
        endTime: new Date().toISOString(),
        duration: 480,
        totalRevenue: 25000,
        cashRevenue: 15000,
        cardRevenue: 10000,
        orderCount: 18,
        deposit: 5000,
        totalCashReductions: 0,
        finalCash: 20000,
        salary: 2800,
        hourlyRate: 350,
        bonusEarned: true,
        bonusAmount: 1000,
        bonusReason: 'Test bonus',
        orders: []
    };
    
    showAlert('📧 Šaljem test email...');
    await sendShiftReportEmail(testReport);
    showAlert('📧 Test email poslat! Proverite inbox.');
}
