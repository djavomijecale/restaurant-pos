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
    const items = order.items.map(function(item, idx) {
        // Koristi indeks artikla u meniju za stabilan Code
        var menuIdx = DB.menu.findIndex(function(m) { return m.name === item.name; });
        var code = OCTOPOS_CONFIG.productPrefix + (menuIdx >= 0 ? menuIdx : idx);
        return {
            ProductCode: code,
            Name: item.name,
            Quantity: item.qty,
            UnitPrice: item.price,
            TotalPrice: item.price * item.qty,
            TaxRateLabel: item.taxLabel || String.fromCharCode(0x402) // Ђ = 20% PDV
        };
    });

    if (order.disc > 0) {
        items.push({
            ProductCode: OCTOPOS_CONFIG.productPrefix + 'POPUST',
            Name: 'Popust ' + (order.discountPercent || 0) + '%',
            Quantity: 1,
            UnitPrice: -order.disc,
            TotalPrice: -order.disc,
            TaxRateLabel: String.fromCharCode(0x402)
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
async function octoposApiCall(method, endpoint, body) {
    const apiUrl = OCTOPOS_CONFIG.apiUrl.replace(/\/$/, '');
    const token = OCTOPOS_CONFIG.apiToken;
    
    if (!apiUrl || !token) {
        throw new Error('Nedostaje API URL ili Token');
    }
    
    let fetchUrl = apiUrl + endpoint;
    
    // Ako imamo CORS proxy (isti kao za eFaktura), koristi ga
    const proxyUrl = (DB.settings.efakturaProxyUrl || '').trim();
    if (proxyUrl) {
        let cleanProxy = proxyUrl.replace(/\/+$/, '');
        if (!cleanProxy.startsWith('http')) cleanProxy = 'https://' + cleanProxy;
        fetchUrl = cleanProxy + '/' + fetchUrl;
    }
    
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    };
    
    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }
    
    console.log('🧾 OctoPOS ' + method + ':', endpoint, body ? JSON.stringify(body).substring(0, 200) : '');
    
    const response = await fetch(fetchUrl, options);
    
    const text = await response.text();
    
    // Probaj JSON parse
    try {
        return JSON.parse(text);
    } catch (e) {
        // Nije JSON - verovatno HTML error
        console.error('🧾 OctoPOS odgovor (nije JSON):', response.status, text.substring(0, 300));
        throw new Error('OctoPOS ' + response.status + ': ' + text.substring(0, 200));
    }
}


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
        const result = await octoposApiCall('POST', '/weborder', octoposData);

        if (result.Success) {
            console.log('✅ OctoPOS: Račun uspešno kreiran!', result);
            
            // Sačuvaj OctoPOS ID u narudžbini
            order.octoposId = result.Data ? result.Data.Id : null;
            order.octoposSent = true;
            order.octoposSentAt = new Date().toISOString();
            
            // Preuzmi fiskalni račun
            if (order.octoposId) {
                try {
                    const fiscal = await octoposApiCall('GET', '/weborder/' + order.octoposId + '/fiscalreceipt?lineWidth=48');
                    if (fiscal.Success && fiscal.Data) {
                        order.fiscalReceipt = fiscal.Data;
                        console.log('🧾 Fiskalni račun preuzet');
                    }
                } catch (e) {
                    console.warn('⚠️ Fiskalni račun nije preuzet:', e.message);
                }
            }
            
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
            error: 'Mrežna greška: ' + error.message + '. Račun je sačuvan za ponovno slanje.'
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

        const data = await octoposApiCall('GET', '/product?active=true&pageSize=1');

        if (data.Success) {
            const productCount = data.TotalCount || (data.Data ? data.Data.length : 0);
            showAlert('✅ OctoPOS konekcija uspešna!\n\n📦 Proizvoda u bazi: ' + productCount);
        } else {
            showAlert('⚠️ Povezan ali greška: ' + (data.Errors?.join(', ') || 'Nepoznata'));
        }

    } catch (error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            const hasProxy = (DB.settings.efakturaProxyUrl || '').trim();
            showAlert('❌ Ne mogu da se povežem!\n\n' + 
                (hasProxy 
                    ? 'Proxy je podešen ali ne prosleđuje OctoPOS. Proverite Worker.'
                    : 'Potreban CORS proxy (isti kao za eFaktura u podešavanjima).'));
        } else {
            showAlert('❌ Greška: ' + error.message);
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

    let synced = 0;
    let errors = 0;
    let lastError = '';

    for (let i = 0; i < DB.menu.length; i++) {
        const item = DB.menu[i];
        try {
            var code = OCTOPOS_CONFIG.productPrefix + i;
            const productData = {
                Code: code,
                Name: item.name.substring(0, 100),
                Price: parseFloat(item.price) || 0,
                Active: true,
                IsForSale: true,
                TaxRateLabel: String.fromCharCode(0x402) // Ђ = 20% PDV
            };

            const result = await octoposApiCall('POST', '/product', productData);
            
            if (result.Success) {
                synced++;
            } else {
                errors++;
                lastError = (result.Errors || []).join(', ') || 'Nepoznata greška';
                console.warn('⚠️ OctoPOS product error for ' + item.name + ':', lastError);
            }
            
            // Pauza da ne pogodimo rate limit
            await new Promise(r => setTimeout(r, 200));
        } catch (e) {
            errors++;
            lastError = e.message;
            console.error('❌ Greška za ' + item.name + ':', e.message);
        }
    }

    let msg = 'Sinhronizacija menija:\n✅ ' + synced + ' stavki uspešno';
    if (errors > 0) msg += '\n❌ ' + errors + ' grešaka';
    if (lastError) msg += '\n\nPoslednja greška:\n' + lastError.substring(0, 150);
    showAlert(msg);
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
                   placeholder="https://sandbox.octopos.rs/api" 
                   style="font-size:14px">
            <p style="color:#B0B0B0;font-size:11px;margin-top:2px;margin-bottom:12px">
                💡 Sandbox: https://sandbox.octopos.rs/api · Produkcija: https://app.octopos.rs/api
            </p>
            
            ${!(DB.settings.efakturaProxyUrl || '').trim() ? '<div style="background:#16213E;padding:10px;border-radius:8px;margin-bottom:12px;border-left:3px solid #FF9800"><p style="color:#FF9800;font-size:12px;margin:0">⚠️ CORS proxy nije podešen. OctoPOS API zahteva proxy — podesite ga u eFaktura podešavanjima iznad.</p></div>' : '<div style="background:#16213E;padding:10px;border-radius:8px;margin-bottom:12px;border-left:3px solid #4CAF50"><p style="color:#4CAF50;font-size:12px;margin:0">✅ Koristi se CORS proxy: ' + (DB.settings.efakturaProxyUrl || '') + '</p></div>'}
            
            <label style="color:#E94560;font-weight:bold">API Token</label>
            <input type="password" id="octoposToken" value="${DB.settings.octoposApiToken || ''}" 
                   placeholder="Vaš OctoPOS API token">
            <p style="color:#B0B0B0;font-size:11px;margin-top:2px;margin-bottom:12px">
                💡 Token ste dobili na email od OctoPOS podrške (Đorđe Pandurović)
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
