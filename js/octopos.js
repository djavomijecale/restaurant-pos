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
    var productMap = DB.settings.octoposProductMap || {};
    var octoProducts = DB.settings.octoposProducts || [];
    
    var items = [];
    order.items.forEach(function(item) {
        var octoCode = productMap[item.name];
        if (!octoCode) {
            console.warn('⚠️ OctoPOS: nema mapiranja za "' + item.name + '"');
            return;
        }
        var octoProd = octoProducts.find(function(p) { return p.code === octoCode; });
        items.push({
            ProductId: octoProd ? octoProd.id : 0,
            Quantity: item.qty,
            Price: octoProd ? octoProd.price : item.price
        });
    });
    
    // FiscalPaymentTypeId: 1=Cash, 2=Card, 4=WireTransfer
    var fiscalPayment;
    switch (order.method) {
        case 'Card': fiscalPayment = 2; break;
        case 'Wire': fiscalPayment = 4; break;
        default: fiscalPayment = 1; break;
    }

    var totalAmount = items.reduce(function(sum, it) { return sum + it.Price * it.Quantity; }, 0);

    return {
        ExternalId: 'WPB_' + order.id,
        Items: items,
        Payments: [{
            Amount: totalAmount,
            FiscalPaymentTypeId: fiscalPayment
        }],
        FiscalReceiptData: {
            ReturnTextualRepresentation: true,
            LineWidth: 40
        },
        Note: (order.tableName || 'Sto ' + order.table) + ' | ' + (order.createdBy || 'Admin')
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


async function sendToOctopos(order, skipAutoCheck) {
    if (!OCTOPOS_CONFIG.enabled) {
        console.log('⚠️ OctoPOS integracija nije aktivirana');
        return { success: false, error: 'OctoPOS nije aktiviran' };
    }

    if (!OCTOPOS_CONFIG.apiUrl || !OCTOPOS_CONFIG.apiToken) {
        console.error('❌ OctoPOS: Nedostaje API URL ili Token');
        return { success: false, error: 'Nedostaje API URL ili Token. Podesi u Postavkama.' };
    }

    // Proveri auto-send podešavanja (preskoči ako je konobar ručno izabrao)
    if (!skipAutoCheck) {
        if (order.method === 'Card' && !OCTOPOS_CONFIG.autoSendCard) {
            return { success: false, error: 'Auto-slanje za karticu isključeno' };
        }
        if (order.method === 'Cash' && !OCTOPOS_CONFIG.autoSendCash) {
            return { success: false, error: 'Auto-slanje za keš isključeno' };
        }
        if (order.method === 'Wire' && !DB.settings.octoposAutoWire) {
            return { success: false, error: 'Auto-slanje za prenos isključeno' };
        }
    }

    const octoposData = mapOrderToOctopos(order);

    if (octoposData.Items.length === 0) {
        console.warn('⚠️ OctoPOS: nijedan artikal nije mapiran! Otvorite Postavke → OctoPOS → Mapiranje');
        showAlert('⚠️ OctoPOS: Nijedan artikal nije mapiran na OctoPOS proizvod.\n\nOtvorite Postavke → OctoPOS → Povuci Proizvode');
        return { success: false, error: 'Nema mapiranih artikala' };
    }

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
// POVLAČENJE PROIZVODA IZ OCTOPOS-a
// ============================================
async function fetchOctoposProducts() {
    if (!OCTOPOS_CONFIG.apiUrl || !OCTOPOS_CONFIG.apiToken) {
        showAlert('❌ OctoPOS nije konfigurisan');
        return;
    }
    
    showAlert('🔄 Povlačim proizvode iz OctoPOS-a...');
    
    try {
        var data = await octoposApiCall('GET', '/product?active=true&isForSale=true&pageSize=500');
        
        if (!data.Data || data.Data.length === 0) {
            showAlert('⚠️ Nema proizvoda u OctoPOS-u (ili su svi neaktivni)');
            return;
        }
        
        var products = data.Data;
        DB.settings.octoposProducts = products.map(function(p) {
            return { id: p.Id, code: p.Code, name: p.Name, price: p.Price };
        });
        
        // Auto-mapiranje po imenu
        var autoMapped = 0;
        if (!DB.settings.octoposProductMap) DB.settings.octoposProductMap = {};
        
        DB.menu.forEach(function(menuItem) {
            if (DB.settings.octoposProductMap[menuItem.name]) return; // Već mapirano
            
            // Traži tačno poklapanje po imenu (case insensitive)
            var match = products.find(function(p) {
                return p.Name.toLowerCase().trim() === menuItem.name.toLowerCase().trim();
            });
            if (match) {
                DB.settings.octoposProductMap[menuItem.name] = match.Code;
                autoMapped++;
            }
        });
        
        save();
        
        var mapped = Object.keys(DB.settings.octoposProductMap).length;
        var total = DB.menu.length;
        
        showAlert('✅ Povučeno ' + products.length + ' proizvoda!\n\n' +
            '🔗 Auto-mapirano: ' + autoMapped + ' novih\n' +
            '📊 Ukupno mapirano: ' + mapped + '/' + total + ' artikala\n\n' +
            (mapped < total ? 'Kliknite "Mapiranje" da ručno povežete ostale.' : 'Sve je mapirano!'));
        
        render();
        
    } catch (e) {
        showAlert('❌ Greška: ' + e.message);
    }
}


// ============================================
// UI ZA RUČNO MAPIRANJE PROIZVODA
// ============================================
function showProductMapping() {
    var octoProducts = DB.settings.octoposProducts || [];
    var productMap = DB.settings.octoposProductMap || {};
    
    if (octoProducts.length === 0) {
        showAlert('❌ Prvo povucite proizvode iz OctoPOS-a!');
        return;
    }
    
    // Renderuj kao zasebnu stranicu
    page = 'octoposMapping';
    render();
}

function renderOctoposMapping(c) {
    var octoProducts = DB.settings.octoposProducts || [];
    var productMap = DB.settings.octoposProductMap || {};
    var mapped = Object.keys(productMap).length;
    var total = DB.menu.length;
    var pct = total > 0 ? Math.round(mapped / total * 100) : 0;
    
    var h = '<h2>🔗 Mapiranje Proizvoda</h2>';
    h += '<p style="color:#888;font-size:13px;text-align:center;margin-bottom:8px">Tvoj meni → OctoPOS proizvodi · Mapirano: <strong style="color:#FFD700">' + mapped + '/' + total + '</strong></p>';
    
    // Progress bar
    var barColor = pct === 100 ? '#4CAF50' : (pct > 50 ? '#FF9800' : '#E94560');
    h += '<div style="background:#2A2A4A;height:8px;border-radius:4px;overflow:hidden;margin-bottom:16px">';
    h += '<div style="background:' + barColor + ';height:100%;width:' + pct + '%;border-radius:4px"></div></div>';
    
    // Search
    h += '<input type="text" id="mapSearchInput" oninput="filterMappingList()" placeholder="🔍 Pretraži artikle..." style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px;margin-bottom:12px">';
    
    h += '<div id="mappingList">';
    DB.menu.forEach(function(item, idx) {
        var currentCode = productMap[item.name] || '';
        var statusColor = currentCode ? '#4CAF50' : '#E94560';
        var statusIcon = currentCode ? '✅' : '❌';
        
        h += '<div class="mapItem" data-name="' + item.name.toLowerCase() + '" style="background:#16213E;padding:10px;border-radius:8px;margin-bottom:6px;border-left:3px solid ' + statusColor + '">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">';
        h += '<div style="min-width:120px">';
        h += '<div style="color:#FFD700;font-size:13px;font-weight:bold">' + statusIcon + ' ' + item.name + '</div>';
        h += '<div style="color:#888;font-size:11px">' + item.price + ' din</div>';
        h += '</div>';
        h += '<select id="octoMap_' + idx + '" onchange="updateProductMap(' + idx + ')" style="flex:1;min-width:150px;padding:8px;background:#0F3460;border:1px solid #2A2A4A;border-radius:6px;color:#FFF;font-size:12px">';
        h += '<option value="">-- Izaberi OctoPOS proizvod --</option>';
        octoProducts.forEach(function(p) {
            var selected = (p.code === currentCode) ? ' selected' : '';
            h += '<option value="' + p.code + '"' + selected + '>' + p.name + ' (' + p.price + ' din)</option>';
        });
        h += '</select>';
        h += '</div></div>';
    });
    h += '</div>';
    
    h += '<div style="display:flex;gap:8px;margin-top:16px;position:sticky;bottom:0;background:#1a1a2e;padding:12px 0">';
    h += '<button class="btn" style="flex:1;background:#4CAF50" onclick="saveProductMapping()">💾 Sačuvaj</button>';
    h += '<button class="btn btn-secondary" style="flex:1" onclick="page=\'settings\';render()">← Nazad</button>';
    h += '</div>';
    
    c.innerHTML = h;
}

function filterMappingList() {
    var query = (document.getElementById('mapSearchInput') || {}).value || '';
    query = query.toLowerCase();
    var items = document.querySelectorAll('.mapItem');
    items.forEach(function(el) {
        var name = el.getAttribute('data-name') || '';
        el.style.display = name.includes(query) ? '' : 'none';
    });
}

function saveProductMapping() {
    save();
    showAlert('✅ Mapiranje sačuvano!');
    page = 'settings';
    render();
}

function updateProductMap(menuIdx) {
    var item = DB.menu[menuIdx];
    if (!item) return;
    
    var select = document.getElementById('octoMap_' + menuIdx);
    if (!select) return;
    
    if (!DB.settings.octoposProductMap) DB.settings.octoposProductMap = {};
    
    if (select.value) {
        DB.settings.octoposProductMap[item.name] = select.value;
    } else {
        delete DB.settings.octoposProductMap[item.name];
    }
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
            <p style="color:#B0B0B0;font-size:11px;margin-top:2px;margin-bottom:16px">
                💡 Token ste dobili na email od OctoPOS podrške (Đorđe Pandurović)
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
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#B0B0B0">
                        <input type="checkbox" id="octoposAutoWire" ${DB.settings.octoposAutoWire ? 'checked' : ''} 
                               style="width:20px;height:20px">
                        🏦 Prenos
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
                <button class="btn btn-secondary" style="flex:1;min-width:140px;background:#FF9800" onclick="fetchOctoposProducts()">📦 Povuci Proizvode</button>
                <button class="btn btn-secondary" style="flex:1;min-width:140px;background:#9C27B0" onclick="showProductMapping()">🔗 Mapiranje</button>
                ${pendingCount > 0 ? `
                    <button class="btn btn-secondary" style="flex:1;min-width:140px;background:#E94560" onclick="retryPendingOctoposReceipts()">
                        🔄 Pošalji ponovo (${pendingCount})
                    </button>
                ` : ''}
            </div>
            
            ${(() => {
                var map = DB.settings.octoposProductMap || {};
                var mapped = Object.keys(map).length;
                var total = DB.menu.length;
                var pct = total > 0 ? Math.round(mapped / total * 100) : 0;
                var barColor = pct === 100 ? '#4CAF50' : (pct > 50 ? '#FF9800' : '#E94560');
                return mapped > 0 ? '<div style="background:#16213E;padding:12px;border-radius:8px;margin-top:12px">' +
                    '<div style="display:flex;justify-content:space-between;margin-bottom:6px">' +
                    '<span style="color:#B0B0B0;font-size:12px">🔗 Mapirano proizvoda</span>' +
                    '<span style="color:' + barColor + ';font-weight:bold;font-size:12px">' + mapped + '/' + total + ' (' + pct + '%)</span></div>' +
                    '<div style="background:#2A2A4A;height:6px;border-radius:3px;overflow:hidden">' +
                    '<div style="background:' + barColor + ';height:100%;width:' + pct + '%;border-radius:3px"></div></div></div>' : '';
            })()}
            
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
    DB.settings.octoposAutoCard = document.getElementById('octoposAutoCard').checked;
    DB.settings.octoposAutoCash = document.getElementById('octoposAutoCash').checked;
    DB.settings.octoposAutoWire = document.getElementById('octoposAutoWire').checked;
    
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
