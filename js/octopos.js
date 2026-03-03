// ============================================
// OCTOPOS INTEGRACIJA - Automatsko slanje računa
// ============================================
// OctoPOS REST API za kreiranje fiskalnih računa
// Dokumentacija: https://octopos.rs/en/octopos-api/

// ============================================
// KONFIGURACIJA
// ============================================
const OCTOPOS_CONFIG = {
    // Učitaj iz DB.settings ili koristi default
    get apiUrl() {
        return DB.settings.octoposApiUrl || '';
    },
    get apiToken() {
        return DB.settings.octoposApiToken || '';
    },
    get enabled() {
        return DB.settings.octoposEnabled || false;
    },
    get autoSendCard() {
        // Automatski šalji fiskalni račun kad se plati karticom
        return DB.settings.octoposAutoCard !== false; // default true
    },
    get autoSendCash() {
        // Automatski šalji fiskalni račun kad se plati kešom
        return DB.settings.octoposAutoCash || false; // default false
    },
    get productPrefix() {
        // Prefix za ExternalId proizvoda u OctoPOS-u
        return DB.settings.octoposProductPrefix || 'WPB_';
    }
};


// ============================================
// MAPIRANJE STAVKI IZ TVOJE APP → OCTOPOS FORMAT
// ============================================
function mapOrderToOctopos(order) {
    const items = order.items.map(item => ({
        ProductCode: OCTOPOS_CONFIG.productPrefix + (item.id || item.name.replace(/\s+/g, '_')),
        Name: item.name,
        Quantity: item.qty,
        UnitPrice: item.price,
        TotalPrice: item.price * item.qty,
        // PDV stopa - podrazumevano 20% za hranu u Srbiji
        TaxRateLabel: item.taxLabel || 'Ђ' // Ђ = 20% PDV (hrana)
    }));

    // Ako ima popust, dodaj kao negativnu stavku
    if (order.disc > 0) {
        items.push({
            ProductCode: OCTOPOS_CONFIG.productPrefix + 'POPUST',
            Name: `Popust ${order.discountPercent || 0}%`,
            Quantity: 1,
            UnitPrice: -order.disc,
            TotalPrice: -order.disc,
            TaxRateLabel: 'Ђ'
        });
    }

    // Mapiranje načina plaćanja na OctoPOS format
    let paymentType;
    switch (order.method) {
        case 'Card':
            paymentType = 'Card'; // ili 'WireTransfer' zavisno od OctoPOS konfiguracije
            break;
        case 'Cash':
        default:
            paymentType = 'Cash';
            break;
    }

    return {
        ExternalId: 'WPB_' + order.id, // Unique ID za tvoju app
        Items: items,
        PaymentType: paymentType,
        // Opciono: dodatne informacije
        Note: `${order.tableName || 'Sto ' + order.table} | ${order.createdBy || 'Admin'}`,
        // InvoiceType: 'Normal' // Normal, Proforma, Copy, Training
    };
}


// ============================================
// SLANJE RAČUNA NA OCTOPOS API
// ============================================
async function sendToOctopos(order) {
    if (!OCTOPOS_CONFIG.enabled) {
        console.log('⚠️ OctoPOS integracija nije aktivirana');
        return { success: false, error: 'OctoPOS nije aktiviran' };
    }

    if (!OCTOPOS_CONFIG.apiUrl || !OCTOPOS_CONFIG.apiToken) {
        console.error('❌ OctoPOS: Nedostaje API URL ili Token');
        return { success: false, error: 'Nedostaje API URL ili Token. Podesi u Postavkama.' };
    }

    // Proveri da li treba slati za ovaj tip plaćanja
    if (order.method === 'Card' && !OCTOPOS_CONFIG.autoSendCard) {
        console.log('ℹ️ OctoPOS: Auto-slanje za karticu je isključeno');
        return { success: false, error: 'Auto-slanje za karticu isključeno' };
    }
    if (order.method === 'Cash' && !OCTOPOS_CONFIG.autoSendCash) {
        console.log('ℹ️ OctoPOS: Auto-slanje za keš je isključeno');
        return { success: false, error: 'Auto-slanje za keš isključeno' };
    }

    const octoposData = mapOrderToOctopos(order);

    console.log('📤 Šaljem na OctoPOS:', JSON.stringify(octoposData, null, 2));

    try {
        const url = OCTOPOS_CONFIG.apiUrl.replace(/\/$/, '') + '/weborder';
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + OCTOPOS_CONFIG.apiToken
            },
            body: JSON.stringify(octoposData)
        });

        const result = await response.json();

        if (result.Success) {
            console.log('✅ OctoPOS: Račun uspešno kreiran!', result);
            
            // Sačuvaj OctoPOS ID u narudžbini
            order.octoposId = result.Data ? result.Data.Id : null;
            order.octoposSent = true;
            order.octoposSentAt = new Date().toISOString();
            
            return { success: true, data: result.Data, receiptId: result.Data?.Id };
        } else {
            console.error('❌ OctoPOS greška:', result.Errors);
            return { success: false, error: result.Errors?.join(', ') || 'Nepoznata greška' };
        }

    } catch (error) {
        console.error('❌ OctoPOS mrežna greška:', error);
        
        // Sačuvaj kao "neuspelo" da probamo ponovo
        if (!DB.octoposPending) DB.octoposPending = [];
        DB.octoposPending.push({
            order: order,
            failedAt: new Date().toISOString(),
            error: error.message
        });
        
        return { 
            success: false, 
            error: `Mrežna greška: ${error.message}. Račun je sačuvan za ponovno slanje.`
        };
    }
}


// ============================================
// PONOVO POŠALJI NEUSPELE RAČUNE
// ============================================
async function retryPendingOctoposReceipts() {
    if (!DB.octoposPending || DB.octoposPending.length === 0) {
        showAlert('✅ Nema neobrađenih računa za OctoPOS');
        return;
    }

    let success = 0;
    let failed = 0;

    for (let i = DB.octoposPending.length - 1; i >= 0; i--) {
        const pending = DB.octoposPending[i];
        const result = await sendToOctopos(pending.order);
        
        if (result.success) {
            DB.octoposPending.splice(i, 1);
            success++;
        } else {
            failed++;
        }
    }

    save();
    showAlert(`OctoPOS Retry: ✅ ${success} uspešno | ❌ ${failed} neuspešno`);
}


// ============================================
// TEST KONEKCIJE
// ============================================
async function testOctoposConnection() {
    if (!OCTOPOS_CONFIG.apiUrl || !OCTOPOS_CONFIG.apiToken) {
        showAlert('❌ Unesi API URL i Token pre testiranja');
        return;
    }

    try {
        showAlert('🔄 Testiram konekciju...');

        // Probaj da dohvatiš listu proizvoda kao test
        const url = OCTOPOS_CONFIG.apiUrl.replace(/\/$/, '') + '/product?active=true';
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + OCTOPOS_CONFIG.apiToken
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.Success) {
                const productCount = data.Data ? data.Data.length : 0;
                showAlert(`✅ OctoPOS konekcija uspešna!\n\n📦 Proizvoda u OctoPOS bazi: ${productCount}`);
            } else {
                showAlert(`⚠️ Povezan ali greška: ${data.Errors?.join(', ')}`);
            }
        } else if (response.status === 401) {
            showAlert('❌ Pogrešan Token! Proveri API token u OctoPOS-u.');
        } else if (response.status === 403) {
            showAlert('❌ Pristup odbijen. Kontaktiraj OctoPOS podršku.');
        } else {
            showAlert(`❌ Greška ${response.status}: ${response.statusText}`);
        }

    } catch (error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            showAlert('❌ Ne mogu da se povežem!\n\nProveri:\n• Da li je OctoPOS pokrenut?\n• Da li je URL tačan?\n• Da li su na istoj mreži?');
        } else {
            showAlert(`❌ Greška: ${error.message}`);
        }
    }
}


// ============================================
// SINHRONIZACIJA MENIJA SA OCTOPOS
// ============================================
async function syncMenuToOctopos() {
    if (!OCTOPOS_CONFIG.enabled || !OCTOPOS_CONFIG.apiUrl || !OCTOPOS_CONFIG.apiToken) {
        showAlert('❌ OctoPOS nije konfigurisan');
        return;
    }

    showAlert('🔄 Sinhronizujem meni sa OctoPOS...');

    let synced = 0;
    let errors = 0;

    for (const item of DB.menu) {
        try {
            const productData = {
                Code: OCTOPOS_CONFIG.productPrefix + (item.id || item.name.replace(/\s+/g, '_')),
                Name: item.name,
                Price: item.price,
                Active: true,
                IsForSale: true,
                TaxRateLabel: 'Ђ' // 20% PDV
            };

            const url = OCTOPOS_CONFIG.apiUrl.replace(/\/$/, '') + '/product';
            
            await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + OCTOPOS_CONFIG.apiToken
                },
                body: JSON.stringify(productData)
            });

            synced++;
        } catch (e) {
            errors++;
            console.error(`❌ Greška za ${item.name}:`, e);
        }
    }

    showAlert(`Sinhronizacija menija:\n✅ ${synced} stavki uspešno\n${errors > 0 ? '❌ ' + errors + ' grešaka' : ''}`);
}


// ============================================
// RENDER OCTOPOS PODEŠAVANJA (za admin panel)
// ============================================
function renderOctoposSettings() {
    const pendingCount = (DB.octoposPending || []).length;
    
    return `
        <div style="border-top:2px solid #2A2A4A;margin:24px 0;padding-top:24px">
            <h3 style="color:#00BCD4;margin-bottom:16px">🧾 OctoPOS Integracija</h3>
            <p style="color:#B0B0B0;font-size:13px;margin-bottom:16px;line-height:1.6">
                Poveži svoju aplikaciju sa OctoPOS fiskalnom kasom. Kad naplatite karticom, 
                račun se automatski kuca na OctoPOS.
            </p>
            
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;background:#16213E;padding:12px;border-radius:8px">
                <label style="color:#FFD700;font-weight:bold;white-space:nowrap">Aktiviraj</label>
                <div onclick="toggleOctopos()" style="cursor:pointer;width:50px;height:26px;border-radius:13px;background:${OCTOPOS_CONFIG.enabled ? '#4CAF50' : '#555'};position:relative;transition:0.3s">
                    <div style="position:absolute;top:3px;${OCTOPOS_CONFIG.enabled ? 'right:3px' : 'left:3px'};width:20px;height:20px;border-radius:50%;background:white;transition:0.3s"></div>
                </div>
                <span style="color:${OCTOPOS_CONFIG.enabled ? '#4CAF50' : '#E94560'};font-weight:bold">${OCTOPOS_CONFIG.enabled ? 'AKTIVNO' : 'NEAKTIVNO'}</span>
            </div>
            
            <label style="color:#E94560;font-weight:bold">OctoPOS API URL</label>
            <input type="text" id="octoposUrl" value="${DB.settings.octoposApiUrl || ''}" 
                   placeholder="https://vas-octopos-server.com/api" 
                   style="font-size:14px">
            <p style="color:#B0B0B0;font-size:11px;margin-top:2px;margin-bottom:12px">
                💡 Primer: https://app.octopos.rs/api ili http://localhost:PORT/api
            </p>
            
            <label style="color:#E94560;font-weight:bold">API Token</label>
            <input type="password" id="octoposToken" value="${DB.settings.octoposApiToken || ''}" 
                   placeholder="Vaš OctoPOS API token">
            <p style="color:#B0B0B0;font-size:11px;margin-top:2px;margin-bottom:12px">
                💡 Kontaktirajte OctoPOS podršku za dobijanje API tokena
            </p>
            
            <label style="color:#E94560;font-weight:bold">Prefix za proizvode</label>
            <input type="text" id="octoposPrefix" value="${DB.settings.octoposProductPrefix || 'WPB_'}" 
                   placeholder="WPB_" style="width:120px">
            <p style="color:#B0B0B0;font-size:11px;margin-top:2px;margin-bottom:16px">
                💡 Prefix za identifikaciju vaših proizvoda u OctoPOS-u (npr. WPB_ za Wood Pizza Bar)
            </p>
            
            <div style="background:#16213E;padding:16px;border-radius:8px;margin-bottom:16px">
                <h4 style="color:#FFD700;margin-bottom:12px">⚡ Automatsko slanje računa</h4>
                <div style="display:flex;gap:24px">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#B0B0B0">
                        <input type="checkbox" id="octoposAutoCard" ${DB.settings.octoposAutoCard !== false ? 'checked' : ''} 
                               style="width:20px;height:20px">
                        💳 Kartica
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#B0B0B0">
                        <input type="checkbox" id="octoposAutoCash" ${DB.settings.octoposAutoCash ? 'checked' : ''} 
                               style="width:20px;height:20px">
                        💵 Keš
                    </label>
                </div>
                <p style="color:#B0B0B0;font-size:11px;margin-top:8px">
                    Štikliraj za koji način plaćanja želiš automatski fiskalni račun
                </p>
            </div>
            
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn" style="flex:1;min-width:140px" onclick="saveOctoposSettings()">💾 Sačuvaj</button>
                <button class="btn btn-secondary" style="flex:1;min-width:140px;background:#00BCD4" onclick="testOctoposConnection()">🔌 Test Konekcije</button>
            </div>
            
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                <button class="btn btn-secondary" style="flex:1;min-width:140px;background:#FF9800" onclick="syncMenuToOctopos()">📋 Sync Meni</button>
                ${pendingCount > 0 ? `
                    <button class="btn btn-secondary" style="flex:1;min-width:140px;background:#E94560" onclick="retryPendingOctoposReceipts()">
                        🔄 Pošalji ponovo (${pendingCount})
                    </button>
                ` : ''}
            </div>
            
            ${pendingCount > 0 ? `
                <div style="background:#1a1a2e;border:1px solid #E94560;padding:12px;border-radius:8px;margin-top:12px">
                    <p style="color:#E94560;font-size:13px">
                        ⚠️ Imate <strong>${pendingCount}</strong> neobrađen${pendingCount === 1 ? '' : 'ih'} račun${pendingCount === 1 ? '' : 'a'} za OctoPOS
                    </p>
                </div>
            ` : ''}
        </div>
    `;
}


// ============================================
// SAVE / TOGGLE OCTOPOS SETTINGS
// ============================================
function saveOctoposSettings() {
    DB.settings.octoposApiUrl = document.getElementById('octoposUrl').value.trim();
    DB.settings.octoposApiToken = document.getElementById('octoposToken').value.trim();
    DB.settings.octoposProductPrefix = document.getElementById('octoposPrefix').value.trim() || 'WPB_';
    DB.settings.octoposAutoCard = document.getElementById('octoposAutoCard').checked;
    DB.settings.octoposAutoCash = document.getElementById('octoposAutoCash').checked;
    
    save();
    showAlert('✅ OctoPOS podešavanja sačuvana!');
}

function toggleOctopos() {
    DB.settings.octoposEnabled = !DB.settings.octoposEnabled;
    save();
    render();
}


// ============================================
// STATUS INDIKATOR (za header/nav)
// ============================================
function getOctoposStatusHTML() {
    if (!OCTOPOS_CONFIG.enabled) return '';
    
    const pendingCount = (DB.octoposPending || []).length;
    const color = pendingCount > 0 ? '#E94560' : '#4CAF50';
    const icon = pendingCount > 0 ? '⚠️' : '🧾';
    
    return `<span style="font-size:12px;color:${color}" title="OctoPOS ${pendingCount > 0 ? pendingCount + ' neobrađenih' : 'aktivno'}">${icon}</span>`;
}


console.log('✅ OctoPOS modul učitan');
