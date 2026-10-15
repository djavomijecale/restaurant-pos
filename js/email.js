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
    if (report.wireRevenue > 0) {
        lines.push('  🏦 Prenos: ' + (report.wireRevenue || 0).toLocaleString('sr-RS') + ' din');
    }
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
    
    // 🛵 Koliko je prometa otišlo na dostavu (oznaka se bira na stolu).
    if (report.delivery && report.delivery.count > 0) {
        var _d = report.delivery;
        lines.push('─────────────────────────────────');
        lines.push('  🛵 DOSTAVA');
        lines.push('─────────────────────────────────');
        lines.push('Porudžbina: ' + _d.count);
        lines.push('Promet: ' + _d.total.toLocaleString('sr-RS') + ' din');
        var _uk = Number(report.totalRevenue) || 0;
        if (_uk > 0) {
            lines.push('Udeo u prometu smene: ' + Math.round(_d.total / _uk * 100) + '%');
        }
        lines.push('');
    }

    if (report.coffee) {
        var _c = report.coffee;
        lines.push('─────────────────────────────────');
        lines.push('  ☕ KAFA SA MLINA');
        lines.push('─────────────────────────────────');
        var _hhmm = function(t) { return new Date(t).toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'}); };
        lines.push('Period: od ponoći do ' + _hhmm(_c.readingAt || _c.to) + '  (mlin se resetuje u ponoć)');
        if (_c.reusedEvening) {
            lines.push('Konobar je očitao u ' + _hhmm(_c.readingAt) + ', smena zatvorena u ' + _hhmm(_c.to) + '.');
        }
        lines.push('');
        lines.push('Samleveno (mlin):  ' + _c.grinderDoses + ' doza   ← upisao konobar');
        lines.push('Otkucano (kasa):   ' + _c.posDoses + ' doza  [' + _c.posCups + ' kafa]');
        var _r = _c.diff;
        if (_r === 0) {
            lines.push('RAZLIKA:           0  ✅ poklapa se');
        } else if (_r > 0) {
            lines.push('RAZLIKA:           +' + _r + '  ⚠️ mlin pokazuje VIŠE nego kasa');
            lines.push('   (' + _r + ' ' + (_r === 1 ? 'doza je samlevena' : 'doza je samleveno') + ' a nije otkucano)');
        } else {
            lines.push('RAZLIKA:           ' + _r + '  ⚠️ kasa pokazuje više nego mlin');
            lines.push('   (otkucano je više nego što je samleveno — proveri unos)');
        }
        lines.push('');
        lines.push('Od toga otkucao ' + (report.user || 'konobar') + ': ' + _c.myDoses + ' doza [' + _c.myCups + ' kafa]');
        if (_c.posDoses !== _c.myDoses) {
            lines.push('   (poredi se sa SVIM konobarima u periodu — mlin je');
            lines.push('    zajednički, pa se ne može razdvojiti po konobaru)');
        }
        if (_c.tailDoses > 0) {
            lines.push('');
            lines.push('(posle očitanja otkucano još ' + _c.tailDoses + ' doza [' + _c.tailCups +
                ' kafa] do kraja smene — taj deo nije pokriven)');
        }
        if (_c.crossedMidnight && _c.evening) {
            var _e = _c.evening;
            lines.push('');
            lines.push('── DEO PRE PONOĆI (očitano u ' + _hhmm(_e.at) +
                (_e.by ? ', ' + _e.by : '') + ') ──');
            lines.push('Samleveno (mlin):  ' + _e.reading + ' doza');
            lines.push('Otkucano (kasa):   ' + _e.posDoses + ' doza  [' + _e.posCups + ' kafa]');
            if (_e.diff === 0) {
                lines.push('RAZLIKA:           0  ✅ poklapa se');
            } else if (_e.diff > 0) {
                lines.push('RAZLIKA:           +' + _e.diff + '  ⚠️ mlin pokazuje VIŠE nego kasa');
            } else {
                lines.push('RAZLIKA:           ' + _e.diff + '  ⚠️ kasa pokazuje više nego mlin');
            }
            var _rest = _c.uncoveredDoses - _e.posDoses;
            if (_rest > 0) {
                lines.push('(još ' + _rest + ' doza otkucano između tog očitanja i ponoći —');
                lines.push(' taj deo nije pokriven)');
            }
        } else if (_c.crossedMidnight) {
            lines.push('');
            lines.push('⚠️ NIJE POKRIVENO: smena je počela pre ponoći.');
            lines.push('   Pre ponoći je otkucano ' + _c.uncoveredDoses + ' doza [' + _c.uncoveredCups + ' kafa],');
            lines.push('   ali se to iz ovog broja ne može proveriti — mlin je');
            lines.push('   u ponoći resetovan, a niko ga nije očitao u 23h.');
        }
        lines.push('');
    }

    lines.push('─────────────────────────────────');
    lines.push('  PLATA');
    lines.push('─────────────────────────────────');
    lines.push('Satnica: ' + (report.hourlyRate || 350) + ' din/sat');
    lines.push('Plata: ' + (report.salary || 0).toLocaleString('sr-RS') + ' din');
    
    // Osnovica za bonus je promet BEZ prenosa na račun. Bez ovog reda bi
    // izgledalo da promet prelazi prag a bonusa nema.
    if (report.wireRevenue > 0) {
        lines.push('');
        lines.push('Osnovica za bonus: ' + (report.bonusRevenue || 0).toLocaleString('sr-RS') + ' din');
        lines.push('   (promet ' + (report.totalRevenue || 0).toLocaleString('sr-RS') +
                   ' - prenos na račun ' + report.wireRevenue.toLocaleString('sr-RS') + ')');
    }

    if (report.bonusEarned) {
        lines.push('🎁 BONUS: ' + (report.bonusAmount || 0).toLocaleString('sr-RS') + ' din');
        lines.push('   Razlog: ' + (report.bonusReason || ''));
    }

    lines.push('');

    // 🏠 Sve što je otkucano "na kuću" u ovoj smeni. Ne ulazi u promet ni
    // u pazar — zato stoji zasebno, a ne među narudžbinama.
    if (report.houseOrders && report.houseOrders.length > 0) {
        var _ho = report.houseOrders;
        var _hoTot = _ho.reduce(function(s, h) { return s + (Number(h.tot) || 0); }, 0);
        lines.push('─────────────────────────────────');
        lines.push('  🏠 NA KUĆU (' + _ho.length + ')');
        lines.push('─────────────────────────────────');
        lines.push('Ukupno: ' + _hoTot.toLocaleString('sr-RS') + ' din');
        lines.push('');

        // Zbirno po imenu — odmah se vidi ko najviše troši
        var _poImenu = {};
        _ho.forEach(function(h) {
            var k = h.houseName || '(bez imena)';
            if (!_poImenu[k]) _poImenu[k] = { n: 0, tot: 0 };
            _poImenu[k].n++;
            _poImenu[k].tot += (Number(h.tot) || 0);
        });
        Object.keys(_poImenu)
            .sort(function(a, b) { return _poImenu[b].tot - _poImenu[a].tot; })
            .forEach(function(k) {
                var d = _poImenu[k];
                lines.push('  ' + k + ': ' + d.n + (d.n === 1 ? ' račun' : ' računa') +
                    ', ' + d.tot.toLocaleString('sr-RS') + ' din');
            });
        lines.push('');

        _ho.forEach(function(h, idx) {
            var t = new Date(h.time).toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'});
            var items = h.items || [];
            if (!Array.isArray(items)) items = Object.values(items);
            lines.push((idx + 1) + '. ' + t + ' | ' + (h.houseName || '(bez imena)') +
                ' | ' + (h.tableName || ('Sto ' + h.table)) +
                ' | ' + (Number(h.tot) || 0).toFixed(0) + ' din');
            lines.push('   ' + items.map(function(it) { return it.name + ' x' + it.qty; }).join(', '));
        });
        lines.push('');
    }

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
    
    try {
        var reportText = buildShiftReportText(report);
        var restName = settings.name || 'Restaurant POS';
        var dateStr = new Date(report.startTime).toLocaleDateString('sr-RS');
        
        // EmailJS init — čekaj da se učita ako treba
        if (typeof emailjs === 'undefined') {
            console.warn('📧 EmailJS nije učitan, pokušavam ponovo za 2s...');
            await new Promise(function(r) { setTimeout(r, 2000); });
            if (typeof emailjs === 'undefined') {
                console.error('📧 EmailJS biblioteka nije učitana — email NIJE poslat!');
                showAlert('⚠️ Email izveštaj NIJE poslat!\n\nEmailJS biblioteka se nije učitala.\nProverite internet konekciju.');
                return;
            }
        }
        
        emailjs.init(publicKey);
        
        var emailList = recipients.split(',').map(function(e) { return e.trim(); }).filter(function(e) { return e.includes('@'); });
        
        if (emailList.length === 0) {
            console.log('📧 Nema validnih email adresa');
            return;
        }
        
        var sent = 0;
        var failed = 0;
        var lastError = '';
        
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
                lastError = err.text || err.message || String(err);
                console.error('📧 Greška za ' + emailList[i] + ':', lastError);
            }
        }
        
        if (sent > 0 && failed === 0) {
            console.log('📧 Izveštaj smene poslat na ' + sent + ' adresa');
        } else if (sent > 0 && failed > 0) {
            showAlert('⚠️ Email izveštaj: poslat na ' + sent + ', neuspelo ' + failed + '\n\n' + lastError);
        } else if (failed > 0) {
            showAlert('❌ Email izveštaj NIJE poslat!\n\n' + lastError);
        }
    } catch (e) {
        console.error('📧 Kritična greška pri slanju emaila:', e);
        showAlert('❌ Email izveštaj NIJE poslat!\n\nGreška: ' + (e.message || e));
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
