// ============================================
// eFAKTURA API INTEGRATION
// ============================================
// Automatsko povlačenje ulaznih faktura sa SEF
// (Sistem Elektronskih Faktura - efaktura.mfin.gov.rs)
// ============================================

const EFAKTURA_PROD_URL = 'https://efaktura.mfin.gov.rs';
const EFAKTURA_DEMO_URL = 'https://demoefaktura.mfin.gov.rs';

let efakturaLoading = false;
let efakturaInvoices = []; // Cached list of fetched invoices
let efakturaError = '';


// ============================================
// API CALL HELPER
// ============================================
async function efakturaApiCall(method, endpoint, body) {
    const settings = DB.settings || {};
    const apiKey = settings.efakturaApiKey || '';
    const useDemo = settings.efakturaUseDemo || false;
    const proxyUrl = (settings.efakturaProxyUrl || '').trim();
    
    if (!apiKey) {
        throw new Error('API ključ nije podešen. Idite na Admin → eFaktura podešavanja.');
    }
    
    const baseUrl = useDemo ? EFAKTURA_DEMO_URL : EFAKTURA_PROD_URL;
    const targetUrl = baseUrl + endpoint;
    let fetchUrl = targetUrl;
    
    // If proxy is configured, route through it
    // Proxy format: https://proxy.workers.dev/<target_url> (NOT encoded)
    if (proxyUrl) {
        let cleanProxy = proxyUrl.replace(/\/+$/, ''); // Remove trailing slashes
        // Auto-add https:// if missing
        if (!cleanProxy.startsWith('http://') && !cleanProxy.startsWith('https://')) {
            cleanProxy = 'https://' + cleanProxy;
        }
        fetchUrl = cleanProxy + '/' + targetUrl;
    }
    
    console.log('eFaktura API:', method, fetchUrl);
    
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };
    
    // Pass ApiKey - both as header and custom header (proxy forwards it)
    headers['ApiKey'] = apiKey;
    headers['X-EFaktura-ApiKey'] = apiKey;
    
    const options = {
        method: method,
        headers: headers
    };
    
    if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(fetchUrl, options);
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            if (response.status === 429) {
                // Rate limit - sačekaj i probaj ponovo
                console.warn('⏳ eFaktura rate limit (429), čekam 2 sec...');
                await new Promise(r => setTimeout(r, 2000));
                const retryResp = await fetch(fetchUrl, options);
                if (retryResp.ok) {
                    const ct = retryResp.headers.get('content-type') || '';
                    return ct.includes('json') ? await retryResp.json() : await retryResp.text();
                }
                throw new Error('API greška 429: Previše zahteva. Sačekajte par sekundi i pokušajte ponovo.');
            }
            if (response.status === 401) {
                throw new Error('Neispravan API ključ (401). Proverite ključ u podešavanjima.');
            } else if (response.status === 403) {
                throw new Error('Pristup odbijen (403). Proverite da li je API aktiviran na portalu.');
            } else if (response.status === 404) {
                throw new Error('Endpoint nije pronađen (404). Proverite URL i API verziju.');
            }
            throw new Error(`API greška ${response.status}: ${errorText.substring(0, 300)}`);
        }
        
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('json')) {
            return await response.json();
        }
        return await response.text();
        
    } catch (err) {
        // Detect CORS / network errors
        if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
            if (proxyUrl) {
                throw new Error(
                    'Proxy nije dostupan ili ne prosleđuje zahteve. Proverite:\n' +
                    '1. Da li je Worker deployovan i aktivan\n' +
                    '2. Da li URL proxy-ja tačan: ' + proxyUrl + '\n' +
                    '3. Otvorite konzolu pregledača za više detalja (F12)'
                );
            } else {
                throw new Error('CORS blokiran - pregledač ne dozvoljava direktan pristup. Podesite CORS proxy u Admin podešavanjima.');
            }
        }
        throw err;
    }
}


// ============================================
// FETCH PURCHASE INVOICES (CHANGES ENDPOINT)
// ============================================
async function efakturaFetchInvoices(dateFrom, dateTo) {
    efakturaLoading = true;
    efakturaError = '';
    efakturaInvoices = [];
    render();
    
    try {
        const body = {};
        if (dateFrom) body.dateFrom = dateFrom;
        if (dateTo) body.dateTo = dateTo;
        
        console.log('📥 eFaktura: Tražim fakture za period:', dateFrom, '-', dateTo);
        
        const result = await efakturaApiCall('POST', '/api/publicApi/purchase-invoice/ids', body);
        
        console.log('📥 eFaktura API odgovor (tip: ' + typeof result + '):', JSON.stringify(result).substring(0, 500));
        
        // Parsiranje ID-jeva - probaj razne formate
        let invoiceIds = [];
        if (Array.isArray(result)) {
            invoiceIds = result;
        } else if (result && result.PurchaseInvoiceIds) {
            invoiceIds = result.PurchaseInvoiceIds;
        } else if (result && result.purchaseInvoiceIds) {
            invoiceIds = result.purchaseInvoiceIds;
        } else if (result && result.Invoices) {
            invoiceIds = result.Invoices;
        } else if (result && result.invoices) {
            invoiceIds = result.invoices;
        } else if (result && result.Content) {
            invoiceIds = Array.isArray(result.Content) ? result.Content : [result.Content];
        } else if (result && result.content) {
            invoiceIds = Array.isArray(result.content) ? result.content : [result.content];
        } else if (result && typeof result === 'object') {
            // Pronadji bilo koji niz u odgovoru
            for (const [key, val] of Object.entries(result)) {
                if (Array.isArray(val) && val.length > 0) {
                    console.log('📥 Pronađen niz u polju "' + key + '" sa ' + val.length + ' stavki');
                    invoiceIds = val;
                    break;
                }
            }
        }
        
        console.log('📥 Pronađeno ' + invoiceIds.length + ' ID-jeva faktura');
        
        if (invoiceIds.length === 0) {
            // Ako je result sam po sebi niz objekata (fakture umesto ID-jeva)
            if (result && typeof result === 'object' && !Array.isArray(result)) {
                // Možda je odgovor sam faktura ili lista faktura kao objekat
                const keys = Object.keys(result);
                console.log('📥 Ključevi u odgovoru:', keys.join(', '));
            }
            efakturaError = 'Nema faktura za izabrani period.\n\nOtvori F12 → Console za detalje API odgovora.';
            efakturaLoading = false;
            render();
            return;
        }
        
        // Fetch details for each invoice - SA PAUZOM (API limit: 3 req/sec)
        const idsToFetch = invoiceIds.slice(0, 50);
        const invoices = [];
        let errors = 0;
        
        for (let i = 0; i < idsToFetch.length; i++) {
            const id = idsToFetch[i];
            
            // ✅ Pauza 400ms između zahteva (max 3/sec = 333ms, +buffer)
            if (i > 0) {
                await new Promise(r => setTimeout(r, 400));
            }
            try {
                // Izvuci ID iz raznih formata
                let invoiceId;
                if (typeof id === 'string' || typeof id === 'number') {
                    invoiceId = id;
                } else if (typeof id === 'object') {
                    invoiceId = id.purchaseInvoiceId || id.PurchaseInvoiceId || 
                                id.invoiceId || id.InvoiceId || 
                                id.id || id.Id || id.ID;
                    
                    // Ako objekat već sadrži podatke fakture, koristi ga direktno
                    if (id.supplierName || id.SupplierName || id.accountingSupplierParty || 
                        id.AccountingSupplierParty || id.totalAmount || id.TotalAmount ||
                        id.invoiceNumber || id.InvoiceNumber) {
                        console.log('📥 Faktura ' + (i+1) + ': Koristi podatke iz liste (bez extra fetch-a)');
                        invoices.push({ id: invoiceId || ('inv_' + i), ...id });
                        continue;
                    }
                }
                
                if (!invoiceId) {
                    console.warn('📥 Faktura ' + (i+1) + ': Nema ID-a:', JSON.stringify(id).substring(0, 200));
                    errors++;
                    continue;
                }
                
                console.log('📥 Učitavam fakturu ' + (i+1) + '/' + idsToFetch.length + ': ' + invoiceId);
                const detail = await efakturaApiCall('GET', '/api/publicApi/purchase-invoice?invoiceId=' + invoiceId);
                if (detail) {
                    invoices.push({ id: invoiceId, ...detail });
                }
            } catch (err) {
                errors++;
                console.warn('📥 Greška faktura ' + (i+1) + ':', err.message);
            }
        }
        
        efakturaInvoices = invoices;
        efakturaLoading = false;
        
        if (invoices.length === 0) {
            efakturaError = 'Pronađeno ' + invoiceIds.length + ' ID-jeva ali nijedna faktura nije učitana (' + errors + ' grešaka).\n\nOtvori F12 → Console za detalje.';
        } else if (errors > 0) {
            console.log('📥 Učitano ' + invoices.length + '/' + idsToFetch.length + ' faktura (' + errors + ' grešaka)');
        }
        
        render();
        
    } catch (err) {
        console.error('eFaktura API error:', err);
        efakturaError = err.message;
        efakturaLoading = false;
        render();
    }
}


// ============================================
// FETCH SINGLE INVOICE XML AND PARSE
// ============================================
async function efakturaFetchAndImport(invoiceId) {
    try {
        efakturaLoading = true;
        render();
        
        // Fetch the UBL XML of this invoice
        const xmlText = await efakturaApiCall('GET', `/api/publicApi/purchase-invoice/xml?invoiceId=${invoiceId}`);
        
        if (!xmlText || typeof xmlText !== 'string') {
            throw new Error('Server nije vratio XML sadržaj.');
        }
        
        // Parse the XML using existing parser from inventory.js
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        const parseError = xmlDoc.getElementsByTagName('parsererror');
        if (parseError.length > 0) {
            throw new Error('Nevalidan XML odgovor sa servera.');
        }
        
        const result = parseUBLInvoice(xmlDoc, xmlText);
        
        if (result.items.length === 0) {
            throw new Error('Faktura ne sadrži stavke.');
        }
        
        efakturaLoading = false;
        
        // Switch to inventory tab and show import UI
        inventoryTab = 'invoice';
        render();
        
        // After render, show results in invoiceFormArea
        setTimeout(() => {
            showEfakturaApiResults(result, invoiceId);
        }, 100);
        
    } catch (err) {
        console.error('eFaktura XML fetch error:', err);
        efakturaLoading = false;
        showAlert('❌ ' + err.message);
        render();
    }
}


// ============================================
// SHOW API RESULTS (reuses showEfakturaResults from inventory.js)
// ============================================
function showEfakturaApiResults(result, invoiceId) {
    // Use the same display as the XML upload but inject into invoiceFormArea
    const area = document.getElementById('invoiceFormArea');
    if (!area) return;
    
    const info = result.info;
    const items = result.items;
    
    let h = `<div class="card" style="border:2px solid #4CAF50;padding:12px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h3 style="color:#4CAF50;margin:0">✅ Faktura učitana sa API</h3>
            <span style="color:#FFD700;font-weight:bold;font-size:16px">${(info.payableAmount || info.totalWithTax || 0).toFixed(0)} ${info.currency || 'RSD'}</span>
        </div>
        <div style="color:#888;font-size:12px;line-height:1.6">
            ${info.supplierName ? `<div>🏢 <strong style="color:#FFF">${escapeHtml(info.supplierName)}</strong>${info.supplierPIB ? ' · PIB: ' + info.supplierPIB.replace('RS','') : ''}</div>` : ''}
            ${info.invoiceNumber ? `<div>📄 Broj: <strong style="color:#FFF">${escapeHtml(info.invoiceNumber)}</strong></div>` : ''}
            ${info.issueDate ? `<div>📅 Datum: ${info.issueDate}</div>` : ''}
        </div>
    </div>`;
    
    h += `<div class="card" style="border:2px solid #9C27B0">
        <h3 style="color:#9C27B0;margin-bottom:12px">📋 ${items.length} stavki</h3>`;
    
    items.forEach((item, idx) => {
        const existingMatch = findInventoryMatch(item.name);
        const isExisting = !!existingMatch;
        const matchColor = isExisting ? '#4CAF50' : '#2196F3';
        const matchIcon = isExisting ? '🟢' : '🔵';
        const matchLabel = isExisting ? `→ ${existingMatch.name} (${existingMatch.stock} ${existingMatch.unit})` : 'Nova stavka';
        
        h += `<div style="background:#16213E;border-radius:10px;padding:10px 12px;margin-bottom:8px;border-left:4px solid ${matchColor}">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                <input type="checkbox" id="efkapi_check_${idx}" checked style="accent-color:${matchColor};width:16px;height:16px">
                <span style="font-weight:bold;font-size:13px;flex:1">${escapeHtml(item.name)}</span>
                <span style="font-weight:bold;color:#FFD700">${item.lineTotal.toFixed(0)} din</span>
            </div>
            <div style="color:${matchColor};font-size:11px;margin-left:22px">${matchIcon} ${matchLabel}</div>
            <div style="display:flex;gap:6px;margin-top:6px;margin-left:22px">
                <span style="color:#888;font-size:12px">${item.qty} ${item.unit} × ${item.unitPrice.toFixed(0)} din</span>
            </div>
            <input type="hidden" id="efkapi_name_${idx}" value="${escapeHtml(item.name)}">
            <input type="hidden" id="efkapi_qty_${idx}" value="${item.qty}">
            <input type="hidden" id="efkapi_unit_${idx}" value="${item.unit}">
            <input type="hidden" id="efkapi_price_${idx}" value="${item.unitPrice}">
            <input type="hidden" id="efkapi_cat_${idx}" value="${item.category}">
        </div>`;
    });
    
    h += `<div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-secondary" style="flex:1" onclick="inventoryTab='efaktura';render()">← Nazad</button>
        <button class="btn" style="flex:1;background:#4CAF50" onclick="confirmEfakturaApiImport(${items.length}, '${escapeHtml(info.supplierName || '')}', '${info.invoiceNumber || ''}')">✅ Dodaj u Lager</button>
    </div></div>`;
    
    area.innerHTML = h;
}


function confirmEfakturaApiImport(count, supplierName, invoiceNumber) {
    const checkedItems = [];
    
    for (let i = 0; i < count; i++) {
        const checkbox = document.getElementById('efkapi_check_' + i);
        if (!checkbox || !checkbox.checked) continue;
        
        const name = document.getElementById('efkapi_name_' + i)?.value?.trim();
        const qty = parseFloat(document.getElementById('efkapi_qty_' + i)?.value) || 0;
        const unit = document.getElementById('efkapi_unit_' + i)?.value || 'kom';
        const unitPrice = parseFloat(document.getElementById('efkapi_price_' + i)?.value) || 0;
        const category = document.getElementById('efkapi_cat_' + i)?.value || 'Ostalo';
        
        if (name && qty > 0) {
            checkedItems.push({ name, qty, unit, unitPrice, category });
        }
    }
    
    if (checkedItems.length === 0) {
        showAlert('⚠️ Nije označena nijedna stavka!');
        return;
    }
    
    const total = checkedItems.reduce((s, i) => s + (i.qty * i.unitPrice), 0);
    
    showConfirm('📥 Uvezi u Lager',
        `Dodaj ${checkedItems.length} stavki u lager?\n\n` +
        (supplierName ? `Dobavljač: ${supplierName}\n` : '') +
        `Ukupno: ${total.toFixed(0)} din`,
        (confirmed) => {
            if (!confirmed) return;
            
            let newCount = 0, updatedCount = 0;
            
            const invoice = {
                id: 'efk_' + Date.now(),
                date: new Date().toISOString(),
                items: [...checkedItems],
                total: total,
                addedBy: DB.currentUser ? DB.currentUser.username : 'admin',
                source: 'eFaktura API',
                supplierName: supplierName,
                invoiceNumber: invoiceNumber
            };
            
            if (!DB.invoices) DB.invoices = [];
            DB.invoices.push(invoice);
            
            checkedItems.forEach(invItem => {
                const existing = findInventoryMatch(invItem.name);
                if (existing) {
                    existing.stock = (parseFloat(existing.stock) || 0) + parseFloat(invItem.qty);
                    existing.costPrice = parseFloat(invItem.unitPrice) || existing.costPrice;
                    updatedCount++;
                } else {
                    DB.inventory.push({
                        id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        name: invItem.name,
                        unit: invItem.unit || 'kom',
                        stock: parseFloat(invItem.qty),
                        minStock: 0,
                        costPrice: parseFloat(invItem.unitPrice) || 0,
                        category: invItem.category || 'Ostalo',
                        menuItemId: null,
                        deductQty: 1
                    });
                    newCount++;
                }
            });
            
            save();
            showAlert(`✅ Uvezeno!\n${updatedCount} ažurirano\n${newCount} novih\nUkupno: ${total.toFixed(0)} din`);
            inventoryTab = 'stock';
            render();
        }
    );
}


// ============================================
// eFAKTURA TAB RENDER (inside Inventory page)
// ============================================
function renderEfakturaTab() {
    const settings = DB.settings || {};
    const apiKey = settings.efakturaApiKey || '';
    const isConfigured = apiKey.length > 10;
    
    let h = '';
    
    if (!isConfigured) {
        h += `<div class="card" style="border:2px solid #FF9800;text-align:center;padding:24px">
            <div style="font-size:48px">🔑</div>
            <h3 style="color:#FF9800;margin:12px 0 8px">API ključ nije podešen</h3>
            <p style="color:#888;font-size:13px;margin-bottom:16px">
                Idite na <strong style="color:#FFF">Admin → eFaktura Podešavanja</strong> i unesite vaš API ključ sa efaktura.mfin.gov.rs portala.
            </p>
            <button class="btn" style="background:#FF9800;width:auto;padding:10px 24px" onclick="page='admin';render()">⚙️ Otvori Podešavanja</button>
        </div>`;
        return h;
    }
    
    // Date range picker
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    
    h += `<div class="card" style="border:2px solid #9C27B0;margin-bottom:16px">
        <h3 style="color:#9C27B0;margin-bottom:12px">📥 Povuci fakture sa eFaktura</h3>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:120px">
                <label style="color:#888;font-size:11px;display:block;margin-bottom:4px">Od datuma</label>
                <input type="date" id="efkDateFrom" value="${weekAgo}" 
                    style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
            </div>
            <div style="flex:1;min-width:120px">
                <label style="color:#888;font-size:11px;display:block;margin-bottom:4px">Do datuma</label>
                <input type="date" id="efkDateTo" value="${today}" 
                    style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
            </div>
        </div>
        <button class="btn" style="background:#9C27B0;width:100%" onclick="efakturaFetchBtn()" ${efakturaLoading ? 'disabled' : ''}>
            ${efakturaLoading ? '⏳ Učitavam...' : '📥 Povuci Ulazne Fakture'}
        </button>
        
        <div style="margin-top:8px;display:flex;gap:6px">
            <button class="btn btn-secondary" style="flex:1;font-size:12px;padding:6px" onclick="efakturaTestConnection()">🔗 Test Konekcije</button>
            <button class="btn btn-secondary" style="flex:1;font-size:12px;padding:6px" onclick="showEfakturaUpload()">📄 Ručni XML Upload</button>
        </div>
    </div>`;
    
    // Error display
    if (efakturaError) {
        h += `<div class="card" style="border:2px solid #E94560;margin-bottom:12px">
            <div style="display:flex;gap:8px;align-items:flex-start">
                <span style="font-size:20px">❌</span>
                <div>
                    <div style="color:#E94560;font-weight:bold;font-size:14px">Greška</div>
                    <div style="color:#888;font-size:13px;margin-top:4px">${escapeHtml(efakturaError)}</div>
                    ${efakturaError.includes('CORS') ? `
                        <div style="margin-top:8px;padding:10px;background:#16213E;border-radius:8px">
                            <div style="color:#FF9800;font-weight:bold;font-size:12px;margin-bottom:6px">💡 Rešenje za CORS:</div>
                            <div style="color:#888;font-size:11px;line-height:1.5">
                                eFaktura API ne dozvoljava pozive iz pregledača. Potreban vam je CORS proxy.<br><br>
                                <strong style="color:#FFF">Opcija 1:</strong> Koristite "📄 Ručni XML Upload" dugme iznad<br>
                                <strong style="color:#FFF">Opcija 2:</strong> Pokrenite lokalni proxy (uputstvo u Admin podešavanjima)
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>`;
    }
    
    // Invoice list
    if (efakturaInvoices.length > 0) {
        h += `<div style="color:#888;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px">
            📋 Pronađeno ${efakturaInvoices.length} faktura
        </div>`;
        
        efakturaInvoices.forEach(inv => {
            const supplierName = extractSupplierName(inv);
            const invNumber = inv.invoiceNumber || inv.InvoiceNumber || inv.number || '';
            const issueDate = inv.issueDate || inv.IssueDate || inv.date || '';
            const total = inv.totalAmount || inv.TotalAmount || inv.payableAmount || inv.PayableAmount || 0;
            const status = inv.status || inv.Status || '';
            
            h += `<div class="card" style="margin-bottom:8px;cursor:pointer;border-left:4px solid #9C27B0" 
                onclick="efakturaFetchAndImport('${inv.id}')">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:bold;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                            📥 ${escapeHtml(supplierName || 'Faktura')}
                        </div>
                        <div style="color:#888;font-size:12px;margin-top:2px">
                            ${invNumber ? '#' + invNumber + ' · ' : ''}${issueDate}
                            ${status ? ' · <span style="color:#9C27B0">' + status + '</span>' : ''}
                        </div>
                    </div>
                    <div style="text-align:right;white-space:nowrap;margin-left:12px">
                        <div style="font-size:18px;font-weight:bold;color:#FFD700">${parseFloat(total).toFixed(0)}</div>
                        <div style="color:#888;font-size:11px">din</div>
                    </div>
                </div>
            </div>`;
        });
    }
    
    return h;
}


// Helper to extract supplier name from various response formats
function extractSupplierName(inv) {
    if (inv.supplierName) return inv.supplierName;
    if (inv.SupplierName) return inv.SupplierName;
    if (inv.accountingSupplierParty) {
        const sp = inv.accountingSupplierParty;
        return sp.partyName || sp.PartyName || sp.registrationName || sp.RegistrationName || '';
    }
    if (inv.AccountingSupplierParty) {
        const sp = inv.AccountingSupplierParty;
        return sp.PartyName || sp.partyName || sp.RegistrationName || '';
    }
    return '';
}


function efakturaFetchBtn() {
    const dateFrom = document.getElementById('efkDateFrom')?.value || '';
    const dateTo = document.getElementById('efkDateTo')?.value || '';
    efakturaFetchInvoices(dateFrom, dateTo);
}


// ============================================
// TEST CONNECTION
// ============================================
async function efakturaTestConnection() {
    try {
        efakturaLoading = true;
        efakturaError = '';
        render();
        
        // Try to fetch unit measures as a simple test (GET, no body)
        const result = await efakturaApiCall('GET', '/api/publicApi/get-unit-measures');
        
        efakturaLoading = false;
        efakturaError = '';
        render();
        
        const count = Array.isArray(result) ? result.length : Object.keys(result || {}).length;
        showAlert(`✅ Konekcija uspešna!\n\nAPI ključ je validan.\nPrimljeno ${count} jedinica mere.`);
        
    } catch (err) {
        efakturaLoading = false;
        efakturaError = err.message;
        render();
    }
}


// ============================================
// ADMIN SETTINGS UI FOR eFAKTURA
// ============================================
function renderEfakturaSettings() {
    const settings = DB.settings || {};
    
    return `<div class="card" style="margin-bottom:16px;border:2px solid #9C27B0">
        <h3 style="color:#9C27B0;margin-bottom:16px">📥 eFaktura API Podešavanja</h3>
        
        <div style="display:flex;flex-direction:column;gap:12px">
            <div>
                <label style="color:#888;font-size:12px;display:block;margin-bottom:4px">🔑 API Ključ za Autentifikaciju</label>
                <input type="password" id="efkApiKey" value="${settings.efakturaApiKey || ''}" 
                    placeholder="208a75aa-4c9d-4ef4-8fe3-3867c9ac5e21"
                    style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:13px;font-family:monospace">
                <div style="color:#888;font-size:11px;margin-top:4px">
                    Pronađite ga na: efaktura.mfin.gov.rs → Podešavanja → API menadžment → Ključ za autentifikaciju
                </div>
            </div>
            
            <div style="display:flex;align-items:center;gap:10px">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                    <input type="checkbox" id="efkUseDemo" ${settings.efakturaUseDemo ? 'checked' : ''} 
                        style="width:18px;height:18px;accent-color:#FF9800">
                    <span style="color:#FF9800;font-size:13px;font-weight:bold">Demo režim</span>
                </label>
                <span style="color:#888;font-size:11px">(demoefaktura.mfin.gov.rs za testiranje)</span>
            </div>
            
            <div>
                <label style="color:#888;font-size:12px;display:block;margin-bottom:4px">🌐 CORS Proxy URL (opciono)</label>
                <input type="text" id="efkProxyUrl" value="${settings.efakturaProxyUrl || ''}" 
                    placeholder="https://shiny-block-9ea0.dusan-radanovic.workers.dev"
                    style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:13px;font-family:monospace">
                <div style="color:#888;font-size:11px;margin-top:4px">
                    Potreban samo ako API pozivi ne rade direktno (CORS blokada). Ostavite prazno za direktan pristup.
                </div>
            </div>
            
            <details style="margin-top:4px">
                <summary style="color:#9C27B0;cursor:pointer;font-size:13px;font-weight:bold">📋 Uputstvo za CORS Proxy</summary>
                <div style="margin-top:10px;padding:12px;background:#16213E;border-radius:8px;color:#888;font-size:12px;line-height:1.8">
                    <p>eFaktura API ne dozvoljava pozive direktno iz pregledača (CORS zaštita). Imate dva rešenja:</p>
                    <br>
                    <strong style="color:#FFF">A) Besplatan Cloudflare Worker (preporučeno):</strong><br>
                    1. Napravite nalog na <strong style="color:#FFF">workers.cloudflare.com</strong><br>
                    2. Kreirajte novi Worker sa kodom:<br>
                    <pre style="background:#0F3460;padding:8px;border-radius:6px;color:#4CAF50;font-size:11px;margin:6px 0;white-space:pre-wrap;overflow-x:auto">export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        }
      });
    }
    const url = new URL(request.url);
    let target = url.pathname.substring(1) + url.search;
    if (target.startsWith('https:/') &amp;&amp; !target.startsWith('https://'))
      target = 'https://' + target.substring(7);
    if (target.startsWith('http:/') &amp;&amp; !target.startsWith('http://'))
      target = 'http://' + target.substring(6);
    if (!target || !target.startsWith('http'))
      return new Response('Proxy OK', {status:200,
        headers:{'Access-Control-Allow-Origin':'*'}});
    const headers = new Headers();
    for (const [k, v] of request.headers) {
      const kl = k.toLowerCase();
      if (!['host','origin','referer','cf-connecting-ip',
            'cf-ray','cf-ipcountry'].includes(kl))
        headers.set(k, v);
    }
    try {
      const resp = await fetch(target, {
        method: request.method, headers: headers,
        body: ['GET','HEAD'].includes(request.method)
          ? undefined : await request.arrayBuffer()
      });
      const r = new Response(resp.body, resp);
      r.headers.set('Access-Control-Allow-Origin','*');
      r.headers.set('Access-Control-Allow-Headers','*');
      return r;
    } catch(e) {
      return new Response('Error: '+e.message, {status:502,
        headers:{'Access-Control-Allow-Origin':'*'}});
    }
  }
}</pre>
                    3. Deploy i kopirajte URL (npr. <strong style="color:#FFF">https://shiny-block-9ea0.dusan-radanovic.workers.dev</strong>)<br>
                    4. Nalepite URL gore u "CORS Proxy URL" polje (BEZ trailing slash)<br><br>
                    
                    <strong style="color:#FFF">B) Koristite XML Upload:</strong><br>
                    Ako ne želite proxy, uvek možete ručno skinuti XML sa eFaktura portala i uvesti ga u app kroz "📄 Ručni XML Upload".
                </div>
            </details>
            
            <div style="display:flex;gap:8px;margin-top:4px">
                <button class="btn" style="flex:1;background:#4CAF50" onclick="saveEfakturaSettings()">💾 Sačuvaj</button>
                <button class="btn" style="flex:1;background:#2196F3" onclick="efakturaTestConnection()">🔗 Test Konekcije</button>
            </div>
        </div>
    </div>`;
}


function saveEfakturaSettings() {
    if (!DB.settings) DB.settings = {};
    
    DB.settings.efakturaApiKey = document.getElementById('efkApiKey')?.value?.trim() || '';
    DB.settings.efakturaUseDemo = document.getElementById('efkUseDemo')?.checked || false;
    DB.settings.efakturaProxyUrl = document.getElementById('efkProxyUrl')?.value?.trim() || '';
    
    save();
    showAlert('✅ eFaktura podešavanja sačuvana!');
}
