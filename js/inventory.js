// ============================================
// INVENTORY / LAGER MANAGEMENT
// ============================================

let inventoryTab = 'stock';
let invoiceItems = [];
let ocrProcessing = false;
let inventorySearch = '';

function renderInventory(c) {
    if (!DB.inventory) DB.inventory = [];
    if (!DB.invoices) DB.invoices = [];
    
    const lowStock = DB.inventory.filter(i => i.stock <= (i.minStock || 0));
    const outOfStock = DB.inventory.filter(i => i.stock <= 0);
    const totalValue = DB.inventory.reduce((s, i) => s + (i.stock * (i.costPrice || 0)), 0);
    
    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <h2>📦 Lager</h2>
        <button class="btn" style="width:auto;padding:8px 16px;background:#4CAF50" onclick="showAddInventoryItem()">+ Dodaj Stavku</button>
    </div>`;
    
    // Stats
    h += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
        <div style="background:#0F3460;padding:12px;border-radius:8px;text-align:center">
            <div style="color:#FFD700;font-size:20px;font-weight:bold">${DB.inventory.length}</div>
            <div style="color:#B0B0B0;font-size:10px">Stavki</div>
        </div>
        <div style="background:#0F3460;padding:12px;border-radius:8px;text-align:center">
            <div style="color:${outOfStock.length > 0 ? '#E94560' : '#4CAF50'};font-size:20px;font-weight:bold">${outOfStock.length}</div>
            <div style="color:#B0B0B0;font-size:10px">Nema</div>
        </div>
        <div style="background:#0F3460;padding:12px;border-radius:8px;text-align:center">
            <div style="color:${lowStock.length > 0 ? '#FF9800' : '#4CAF50'};font-size:20px;font-weight:bold">${lowStock.length}</div>
            <div style="color:#B0B0B0;font-size:10px">Nisko</div>
        </div>
        <div style="background:#0F3460;padding:12px;border-radius:8px;text-align:center">
            <div style="color:#B0B0B0;font-size:20px;font-weight:bold">${totalValue.toFixed(0)}</div>
            <div style="color:#B0B0B0;font-size:10px">Vrednost</div>
        </div>
    </div>`;
    
    // Tabs
    const tabs = [
        {id:'stock', label:'📋 Stanje', color:'#FFD700'},
        {id:'invoice', label:'📄 Faktura', color:'#4CAF50'},
        {id:'efaktura', label:'📥 eFaktura', color:'#9C27B0'},
        {id:'links', label:'🍕 Recepti', color:'#2196F3'},
        {id:'history', label:'📜 Istorija', color:'#B0B0B0'}
    ];
    h += '<div style="display:flex;gap:6px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px">';
    tabs.forEach(t => {
        const active = inventoryTab === t.id;
        h += `<button onclick="inventoryTab='${t.id}';render()" style="
            padding:8px 16px;border-radius:8px;border:none;cursor:pointer;white-space:nowrap;font-weight:bold;font-size:13px;
            background:${active ? t.color : '#16213E'};color:${active ? (t.id==='stock'?'#000':'#FFF') : '#888'}
        ">${t.label}</button>`;
    });
    h += '</div>';
    
    switch(inventoryTab) {
        case 'stock': h += renderStockList(); break;
        case 'invoice': h += renderInvoiceEntry(); break;
        case 'efaktura': h += (typeof renderEfakturaTab === 'function') ? renderEfakturaTab() : '<p style="color:#888">eFaktura modul nije učitan.</p>'; break;
        case 'links': h += renderInventoryLinks(); break;
        case 'history': h += renderInvoiceHistory(); break;
    }
    
    c.innerHTML = h;
}


// ============================================
// TAB 1: STOCK LIST
// ============================================
function renderStockList() {
    let h = `<div style="margin-bottom:12px">
        <input type="text" id="invSearch" placeholder="🔍 Pretraži lager..." value="${inventorySearch}" 
            oninput="inventorySearch=this.value;render()" 
            style="width:100%;padding:10px 16px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
    </div>`;
    
    let items = [...DB.inventory];
    if (inventorySearch) {
        const q = inventorySearch.toLowerCase();
        items = items.filter(i => i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
    }
    
    // Sort: out of stock first, then low stock, then by name
    items.sort((a, b) => {
        const aLevel = a.stock <= 0 ? 0 : a.stock <= (a.minStock || 0) ? 1 : 2;
        const bLevel = b.stock <= 0 ? 0 : b.stock <= (b.minStock || 0) ? 1 : 2;
        if (aLevel !== bLevel) return aLevel - bLevel;
        return a.name.localeCompare(b.name, 'sr');
    });
    
    if (items.length === 0) {
        h += `<div class="empty">
            <div style="font-size:64px">📦</div>
            <h3>${inventorySearch ? 'Nema rezultata' : 'Lager je prazan'}</h3>
            <p>${inventorySearch ? 'Pokušajte drugu pretragu' : 'Dodajte stavke ili unesite fakturu'}</p>
        </div>`;
        return h;
    }
    
    // Group by category
    const categories = {};
    items.forEach(item => {
        const cat = item.category || 'Ostalo';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);
    });
    
    Object.entries(categories).forEach(([cat, catItems]) => {
        h += `<div style="color:#888;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px;padding-left:4px">${cat}</div>`;
        
        catItems.forEach(item => {
            const pct = item.minStock > 0 ? (item.stock / item.minStock) * 100 : (item.stock > 0 ? 100 : 0);
            let color = '#4CAF50';
            let statusIcon = '✅';
            if (item.stock <= 0) { color = '#E94560'; statusIcon = '❌'; }
            else if (pct <= 100) { color = '#FF9800'; statusIcon = '⚠️'; }
            
            // Nađi sve artikle iz menija koji koriste ovu namirnic u receptu
            const linkedMenuItems = DB.menu.filter(m => m.recipe && m.recipe.some(r => r.inventoryId === item.id));
            const linkedLabel = linkedMenuItems.length > 0 
                ? '🍕 ' + linkedMenuItems.map(m => m.name).slice(0, 3).join(', ') + (linkedMenuItems.length > 3 ? ' +' + (linkedMenuItems.length - 3) : '')
                : '';
            
            h += `<div class="card" style="margin-bottom:8px;cursor:pointer;border-left:4px solid ${color}" onclick="showEditInventoryItem('${item.id}')">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="flex:1">
                        <div style="font-weight:bold;font-size:15px">${statusIcon} ${item.name}</div>
                        <div style="color:#888;font-size:12px;margin-top:2px">
                            ${linkedLabel}
                        </div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-size:20px;font-weight:bold;color:${color}">${item.stock}</div>
                        <div style="color:#888;font-size:11px">${item.unit || 'kom'}${item.minStock ? ' · min: ' + item.minStock : ''}</div>
                    </div>
                </div>
                ${item.minStock > 0 ? `<div style="margin-top:8px;background:#16213E;border-radius:4px;height:6px;overflow:hidden">
                    <div style="height:100%;width:${Math.min(pct, 100)}%;background:${color};border-radius:4px;transition:width 0.3s"></div>
                </div>` : ''}
            </div>`;
        });
    });
    
    return h;
}


// ============================================
// TAB 2: INVOICE ENTRY
// ============================================
function renderInvoiceEntry() {
    let h = `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn" style="flex:1;min-width:120px;background:#FF9800" onclick="showOCRInvoice()">📸 Skeniraj</button>
        <button class="btn" style="flex:1;min-width:120px;background:#2196F3" onclick="showManualInvoice()">✏️ Ručni Unos</button>
        <button class="btn" style="flex:1;min-width:120px;background:#9C27B0" onclick="showEfakturaUpload()">📥 eFaktura XML</button>
    </div>`;
    
    h += `<div id="invoiceFormArea"></div>`;
    
    // Current invoice items (if adding)
    if (invoiceItems.length > 0) {
        h += renderInvoiceItemsList();
    }
    
    return h;
}

function renderInvoiceItemsList() {
    let h = `<div style="margin-top:16px">
        <h3 style="color:#4CAF50;margin-bottom:12px">📋 Stavke Fakture (${invoiceItems.length})</h3>`;
    
    let total = 0;
    invoiceItems.forEach((item, idx) => {
        const itemTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
        total += itemTotal;
        h += `<div class="card" style="margin-bottom:6px;padding:10px 12px">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="flex:1">
                    <span style="font-weight:bold">${item.name}</span>
                    <span style="color:#888;font-size:12px;margin-left:8px">${item.qty} ${item.unit || 'kom'} × ${(parseFloat(item.unitPrice) || 0).toFixed(0)} din</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-weight:bold;color:#FFD700">${itemTotal.toFixed(0)}</span>
                    <button onclick="invoiceItems.splice(${idx},1);render()" style="background:#E94560;border:none;color:#FFF;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px">✕</button>
                </div>
            </div>
        </div>`;
    });
    
    h += `<div style="display:flex;justify-content:space-between;padding:12px;background:#0F3460;border-radius:8px;margin-top:8px">
        <span style="font-weight:bold;font-size:16px">UKUPNO:</span>
        <span style="font-weight:bold;font-size:16px;color:#FFD700">${total.toFixed(0)} din</span>
    </div>`;
    
    h += `<div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-secondary" style="flex:1" onclick="invoiceItems=[];render()">🗑️ Obriši Sve</button>
        <button class="btn" style="flex:1;background:#4CAF50" onclick="saveInvoice()">💾 Sačuvaj Fakturu</button>
    </div>`;
    
    h += '</div>';
    return h;
}


// ============================================
// MANUAL INVOICE
// ============================================
function showManualInvoice() {
    const area = document.getElementById('invoiceFormArea');
    if (!area) return;
    
    area.innerHTML = `
        <div class="card" style="border:2px solid #2196F3">
            <h3 style="color:#2196F3;margin-bottom:12px">✏️ Ručni Unos Stavke</h3>
            <div style="display:flex;flex-direction:column;gap:10px">
                <div style="display:flex;gap:8px">
                    <div style="flex:2">
                        <label style="color:#888;font-size:11px;display:block;margin-bottom:4px">Naziv</label>
                        <input type="text" id="invItemName" placeholder="Coca Cola 0.33" list="inventoryNamesList"
                            style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
                        <datalist id="inventoryNamesList">
                            ${DB.inventory.map(i => `<option value="${i.name}">`).join('')}
                        </datalist>
                    </div>
                    <div style="flex:1">
                        <label style="color:#888;font-size:11px;display:block;margin-bottom:4px">Kategorija</label>
                        <select id="invItemCat" style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
                            <option value="Piće">Piće</option>
                            <option value="Hrana">Hrana</option>
                            <option value="Namirnice">Namirnice</option>
                            <option value="Ostalo">Ostalo</option>
                        </select>
                    </div>
                </div>
                <div style="display:flex;gap:8px">
                    <div style="flex:1">
                        <label style="color:#888;font-size:11px;display:block;margin-bottom:4px">Količina</label>
                        <input type="number" id="invItemQty" placeholder="24" min="0" step="0.1"
                            style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
                    </div>
                    <div style="flex:1">
                        <label style="color:#888;font-size:11px;display:block;margin-bottom:4px">Jedinica</label>
                        <select id="invItemUnit" style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
                            <option value="kom">kom</option>
                            <option value="kg">kg</option>
                            <option value="l">l</option>
                            <option value="g">g</option>
                            <option value="ml">ml</option>
                            <option value="pak">pak</option>
                        </select>
                    </div>
                    <div style="flex:1">
                        <label style="color:#888;font-size:11px;display:block;margin-bottom:4px">Cena (din)</label>
                        <input type="number" id="invItemPrice" placeholder="80" min="0" step="0.01"
                            style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
                    </div>
                </div>
                <div style="display:flex;gap:8px">
                    <button class="btn" style="flex:1;background:#2196F3" onclick="addInvoiceItem()">➕ Dodaj Stavku</button>
                    <button class="btn" style="flex:1;background:#4CAF50" onclick="addInvoiceItemAndMore()">➕ Dodaj i Nastavi</button>
                </div>
            </div>
        </div>`;
    
    setTimeout(() => document.getElementById('invItemName')?.focus(), 100);
}

function addInvoiceItem() {
    const name = document.getElementById('invItemName')?.value?.trim();
    const qty = parseFloat(document.getElementById('invItemQty')?.value) || 0;
    const unit = document.getElementById('invItemUnit')?.value || 'kom';
    const unitPrice = parseFloat(document.getElementById('invItemPrice')?.value) || 0;
    const category = document.getElementById('invItemCat')?.value || 'Ostalo';
    
    if (!name) { showAlert('⚠️ Unesite naziv stavke!'); return; }
    if (qty <= 0) { showAlert('⚠️ Unesite količinu!'); return; }
    
    invoiceItems.push({ name, qty, unit, unitPrice, category });
    render();
}

function addInvoiceItemAndMore() {
    const name = document.getElementById('invItemName')?.value?.trim();
    const qty = parseFloat(document.getElementById('invItemQty')?.value) || 0;
    const unit = document.getElementById('invItemUnit')?.value || 'kom';
    const unitPrice = parseFloat(document.getElementById('invItemPrice')?.value) || 0;
    const category = document.getElementById('invItemCat')?.value || 'Ostalo';
    
    if (!name) { showAlert('⚠️ Unesite naziv stavke!'); return; }
    if (qty <= 0) { showAlert('⚠️ Unesite količinu!'); return; }
    
    invoiceItems.push({ name, qty, unit, unitPrice, category });
    
    // Clear form but keep it open
    render();
    setTimeout(() => showManualInvoice(), 50);
}


// ============================================
// OCR INVOICE SCANNING
// ============================================
function showOCRInvoice() {
    const area = document.getElementById('invoiceFormArea');
    if (!area) return;
    
    area.innerHTML = `
        <div class="card" style="border:2px solid #FF9800">
            <h3 style="color:#FF9800;margin-bottom:12px">📸 Skeniraj Fakturu</h3>
            <p style="color:#888;font-size:13px;margin-bottom:12px">
                Slikajte fakturu ili izaberite sliku iz galerije. Program će automatski prepoznati stavke.
            </p>
            <div style="display:flex;gap:8px;margin-bottom:12px">
                <label style="flex:1;display:flex;align-items:center;justify-content:center;padding:40px 16px;background:#16213E;border:2px dashed #FF9800;border-radius:12px;cursor:pointer;text-align:center">
                    <input type="file" accept="image/*" capture="environment" onchange="processOCRFile(this.files[0])" style="display:none">
                    <div>
                        <div style="font-size:48px">📷</div>
                        <div style="color:#FF9800;font-weight:bold;margin-top:8px">Slikaj / Izaberi Sliku</div>
                    </div>
                </label>
            </div>
            <div id="ocrStatus" style="display:none"></div>
            <div id="ocrResults" style="display:none"></div>
        </div>`;
}

async function processOCRFile(file) {
    if (!file) return;
    
    const status = document.getElementById('ocrStatus');
    const results = document.getElementById('ocrResults');
    if (!status || !results) return;
    
    status.style.display = 'block';
    status.innerHTML = `<div style="text-align:center;padding:20px">
        <div style="font-size:32px;animation:spin 1s linear infinite">⚙️</div>
        <p style="color:#FF9800;margin-top:8px;font-weight:bold">Učitavam OCR engine...</p>
        <div id="ocrProgress" style="margin-top:8px;background:#16213E;border-radius:4px;height:8px;overflow:hidden">
            <div id="ocrProgressBar" style="height:100%;width:0%;background:#FF9800;transition:width 0.3s;border-radius:4px"></div>
        </div>
        <p id="ocrStatusText" style="color:#888;font-size:12px;margin-top:4px">Inicijalizacija...</p>
    </div>
    <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>`;
    
    try {
        // Lazy load Tesseract.js
        if (!window.Tesseract) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error('Nije moguće učitati OCR biblioteku'));
                document.head.appendChild(script);
            });
        }
        
        updateOCRStatus('Obrađujem sliku...', 20);
        
        // Read file as data URL for preview
        const imageUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
        
        updateOCRStatus('Pokrećem OCR prepoznavanje...', 30);
        
        const worker = await Tesseract.createWorker('srp+eng', 1, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const pct = Math.round(30 + (m.progress * 60));
                    updateOCRStatus('Prepoznajem tekst...', pct);
                }
            }
        });
        
        const { data } = await worker.recognize(imageUrl);
        await worker.terminate();
        
        updateOCRStatus('Analiziram rezultate...', 95);
        
        // Parse OCR results
        const parsed = parseInvoiceText(data.text);
        
        status.style.display = 'none';
        
        if (parsed.length === 0) {
            results.style.display = 'block';
            results.innerHTML = `<div class="card" style="border:2px solid #E94560">
                <h3 style="color:#E94560">⚠️ Nije prepoznato</h3>
                <p style="color:#888;margin:8px 0">OCR nije uspeo da prepozna stavke na fakturi. Pokušajte:</p>
                <ul style="color:#888;font-size:13px;padding-left:20px;margin:8px 0">
                    <li>Bolji kvalitet slike / osvetljenje</li>
                    <li>Fotografišite bliže</li>
                    <li>Ili koristite ručni unos</li>
                </ul>
                <details style="margin-top:12px">
                    <summary style="color:#888;cursor:pointer;font-size:12px">Prikaži sirovi tekst</summary>
                    <pre style="background:#16213E;padding:12px;border-radius:8px;color:#888;font-size:11px;white-space:pre-wrap;margin-top:8px;max-height:200px;overflow-y:auto">${data.text}</pre>
                </details>
            </div>`;
        } else {
            showOCRResults(parsed, data.text);
        }
        
    } catch (err) {
        status.innerHTML = `<div class="card" style="border:2px solid #E94560">
            <h3 style="color:#E94560">❌ Greška</h3>
            <p style="color:#888">${err.message || 'Greška pri obradi slike'}</p>
            <p style="color:#888;font-size:12px;margin-top:8px">Proverite internet konekciju i pokušajte ponovo.</p>
        </div>`;
    }
}

function updateOCRStatus(text, pct) {
    const bar = document.getElementById('ocrProgressBar');
    const txt = document.getElementById('ocrStatusText');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = text;
}

function parseInvoiceText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
    const parsed = [];
    
    // Common patterns in Serbian invoices:
    // "Coca Cola 0.33  24  kom  80.00  1920.00"
    // "1. Coca Cola 0.33  24 kom  80,00  1920,00"
    // Various separators: tabs, multiple spaces, pipes
    
    for (const line of lines) {
        // Skip header/footer lines
        if (/faktura|datum|račun|ukupno|total|pdv|osnovica|rabat|valuta|dospeva|napomena|potpis|mp|pib|matični|žiro/i.test(line)) continue;
        if (/^[\d\-\/\.]+$/.test(line)) continue; // Date-only lines
        if (/^\d{1,3}[\.,]\d{2}$/.test(line.replace(/\s/g, ''))) continue; // Just a number
        
        // Try to extract: name, quantity, unit, price
        // Pattern: text then numbers
        const match = line.match(/^(?:\d+[\.\)]\s*)?(.+?)\s{2,}([\d.,]+)\s*(kom|kg|l|g|ml|pak|lit|kut)?\s*([\d.,]+)?\s*([\d.,]+)?$/i);
        
        if (match) {
            const name = match[1].trim();
            const num1 = parseNumber(match[2]);
            const unit = match[3] || 'kom';
            const num2 = match[4] ? parseNumber(match[4]) : 0;
            const num3 = match[5] ? parseNumber(match[5]) : 0;
            
            if (name.length >= 2 && num1 > 0) {
                let qty, unitPrice;
                if (num3 > 0) {
                    // qty, unitPrice, total
                    qty = num1;
                    unitPrice = num2;
                } else if (num2 > 0) {
                    // qty, total (calculate unit price)
                    qty = num1;
                    unitPrice = num2 / num1;
                } else {
                    qty = num1;
                    unitPrice = 0;
                }
                
                parsed.push({ name, qty, unit, unitPrice: Math.round(unitPrice * 100) / 100, category: guessCategory(name) });
            }
        }
    }
    
    return parsed;
}

function parseNumber(str) {
    if (!str) return 0;
    // Handle both "1.920,00" and "1920.00" formats
    str = str.replace(/\s/g, '');
    if (str.includes(',') && str.includes('.')) {
        // European: 1.920,00
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }
    return parseFloat(str) || 0;
}

function guessCategory(name) {
    const n = name.toLowerCase();
    if (/cola|fanta|sprite|sok|juice|voda|water|pivo|beer|vino|wine|viski|votka|rakija|schweppes|tonic|guarana|rosa|knjaz|jelen|lav|heineken|jack|coca|pepsi|redbull|red bull|cedevita/i.test(n)) return 'Piće';
    if (/brašno|flour|kvas|sir|cheese|šunka|ham|salama|kečap|majonez|ulje|oil|paradajz|paprika|luk|pečurke|šampinjon|mozzarella|gorgonzola|parmezan|oregano|pesto|olive|masline|rukola|tunjevina|tuna|pilet|svinj|govedj|mleveno|meso/i.test(n)) return 'Namirnice';
    if (/salveta|čaša|escajg|papir|kesa|sredstvo|deterdžent|sunđer/i.test(n)) return 'Ostalo';
    return 'Namirnice';
}

function showOCRResults(parsed, rawText) {
    const results = document.getElementById('ocrResults');
    if (!results) return;
    
    results.style.display = 'block';
    let h = `<div class="card" style="border:2px solid #4CAF50">
        <h3 style="color:#4CAF50;margin-bottom:12px">✅ Prepoznato ${parsed.length} stavki</h3>
        <p style="color:#888;font-size:12px;margin-bottom:12px">Proverite i ispravite podatke pre dodavanja:</p>`;
    
    parsed.forEach((item, idx) => {
        h += `<div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;flex-wrap:wrap">
            <input type="text" value="${item.name}" id="ocr_name_${idx}" 
                style="flex:2;min-width:120px;padding:8px;background:#16213E;border:1px solid #2A2A4A;border-radius:6px;color:#FFF;font-size:13px">
            <input type="number" value="${item.qty}" id="ocr_qty_${idx}" step="0.1"
                style="width:60px;padding:8px;background:#16213E;border:1px solid #2A2A4A;border-radius:6px;color:#FFF;font-size:13px;text-align:center">
            <select id="ocr_unit_${idx}" style="width:60px;padding:8px;background:#16213E;border:1px solid #2A2A4A;border-radius:6px;color:#FFF;font-size:13px">
                ${['kom','kg','l','g','ml','pak'].map(u => `<option value="${u}" ${item.unit===u?'selected':''}>${u}</option>`).join('')}
            </select>
            <input type="number" value="${item.unitPrice}" id="ocr_price_${idx}" step="0.01"
                style="width:70px;padding:8px;background:#16213E;border:1px solid #2A2A4A;border-radius:6px;color:#FFF;font-size:13px;text-align:right">
            <button onclick="this.parentElement.remove()" style="background:#E94560;border:none;color:#FFF;width:28px;height:28px;border-radius:50%;cursor:pointer">✕</button>
        </div>`;
    });
    
    h += `<div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn" style="flex:1;background:#4CAF50" onclick="confirmOCRItems(${parsed.length})">✅ Dodaj u Fakturu</button>
    </div>`;
    
    h += `<details style="margin-top:12px">
        <summary style="color:#888;cursor:pointer;font-size:12px">Prikaži sirovi tekst</summary>
        <pre style="background:#16213E;padding:12px;border-radius:8px;color:#888;font-size:11px;white-space:pre-wrap;margin-top:8px;max-height:200px;overflow-y:auto">${rawText}</pre>
    </details>`;
    
    h += '</div>';
    results.innerHTML = h;
}

function confirmOCRItems(count) {
    for (let i = 0; i < count; i++) {
        const nameEl = document.getElementById('ocr_name_' + i);
        if (!nameEl || !nameEl.closest('div')) continue; // Removed
        
        const name = nameEl.value.trim();
        const qty = parseFloat(document.getElementById('ocr_qty_' + i)?.value) || 0;
        const unit = document.getElementById('ocr_unit_' + i)?.value || 'kom';
        const unitPrice = parseFloat(document.getElementById('ocr_price_' + i)?.value) || 0;
        
        if (name && qty > 0) {
            invoiceItems.push({ name, qty, unit, unitPrice, category: guessCategory(name) });
        }
    }
    render();
}


// ============================================
// SAVE INVOICE → UPDATE STOCK
// ============================================
function saveInvoice() {
    if (invoiceItems.length === 0) {
        showAlert('⚠️ Nema stavki za čuvanje!');
        return;
    }
    
    showConfirm('💾 Sačuvaj Fakturu', 
        `Da li želite da sačuvate fakturu sa ${invoiceItems.length} stavki?\n\nStanje lagera će biti ažurirano.`,
        (confirmed) => {
            if (!confirmed) return;
            
            const total = invoiceItems.reduce((s, i) => s + (i.qty * i.unitPrice), 0);
            
            // Create invoice record
            const invoice = {
                id: 'fak_' + Date.now(),
                date: new Date().toISOString(),
                items: [...invoiceItems],
                total: total,
                addedBy: DB.currentUser ? DB.currentUser.username : 'admin'
            };
            
            if (!DB.invoices) DB.invoices = [];
            DB.invoices.push(invoice);
            
            // Update stock
            invoiceItems.forEach(invItem => {
                const existing = DB.inventory.find(i => 
                    i.name.toLowerCase() === invItem.name.toLowerCase()
                );
                
                if (existing) {
                    // Add to existing stock
                    existing.stock = (parseFloat(existing.stock) || 0) + parseFloat(invItem.qty);
                    existing.costPrice = parseFloat(invItem.unitPrice) || existing.costPrice;
                    if (invItem.category) existing.category = invItem.category;
                } else {
                    // Create new inventory item
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
                }
            });
            
            invoiceItems = [];
            save();
            showAlert(`✅ Faktura sačuvana!\n\n${invoice.items.length} stavki dodato u lager\nUkupno: ${total.toFixed(0)} din`);
            render();
        }
    );
}




// ============================================
// TAB 3: RECEPTI (Menu → Inventory linking)
// Jedan artikal iz menija može da troši više namirnica
// Više artikala može da troši istu namirnic (npr. malo/veliko pivo → bure)
// ============================================

function migrateOldLinks() {
    // Migriraj stari 1:1 format (inventory.menuItemId) → novi recept format (menu.recipe)
    let migrated = 0;
    DB.inventory.forEach(inv => {
        if (inv.menuItemId) {
            const menuItem = DB.menu.find(m => m.id == inv.menuItemId);
            if (menuItem) {
                if (!menuItem.recipe) menuItem.recipe = [];
                if (!menuItem.recipe.some(r => r.inventoryId === inv.id)) {
                    menuItem.recipe.push({ inventoryId: inv.id, qty: inv.deductQty || 1 });
                    migrated++;
                }
            }
            inv.menuItemId = null;
        }
    });
    if (migrated > 0) {
        console.log('🔄 Migrirano ' + migrated + ' starih veza u recept format');
        save();
    }
}

function renderInventoryLinks() {
    migrateOldLinks();
    
    let h = '<div style="margin-bottom:16px">';
    h += '<p style="color:#888;font-size:13px;line-height:1.6">';
    h += 'Povežite artikle sa namirnicama iz lagera. Svaki artikal može imati više namirnica (recept). ';
    h += 'Više artikala može da troši istu namirnic (npr. malo i veliko pivo → isto bure).';
    h += '</p>';
    h += '<input type="text" id="recipeSearch" placeholder="🔍 Pretraži meni..." ';
    h += 'oninput="renderRecipeList(this.value)" ';
    h += 'style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px;margin-top:8px">';
    h += '</div>';
    h += '<div id="recipeListArea">';
    h += buildRecipeList('');
    h += '</div>';
    return h;
}


function renderRecipeList(search) {
    const area = document.getElementById('recipeListArea');
    if (area) area.innerHTML = buildRecipeList(search);
}


function buildRecipeList(search) {
    let h = '';
    const searchLower = (search || '').toLowerCase();
    
    const menuByGroup = {};
    DB.menu.forEach(function(item) {
        if (searchLower && !item.name.toLowerCase().includes(searchLower)) return;
        const grp = item.group || item.cat || 'Ostalo';
        if (!menuByGroup[grp]) menuByGroup[grp] = [];
        menuByGroup[grp].push(item);
    });
    
    if (Object.keys(menuByGroup).length === 0) {
        return '<div style="text-align:center;padding:20px;color:#888">Nema rezultata</div>';
    }
    
    Object.entries(menuByGroup).forEach(function([grp, items]) {
        h += '<div style="color:#888;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px">' + grp + '</div>';
        
        items.forEach(function(menuItem) {
            const recipe = menuItem.recipe || [];
            const borderColor = recipe.length > 0 ? '#4CAF50' : '#2A2A4A';
            
            h += '<div class="card" style="margin-bottom:8px;padding:12px;border-left:4px solid ' + borderColor + '">';
            h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:' + (recipe.length > 0 ? '8' : '0') + 'px">';
            h += '<div>';
            h += '<span style="font-weight:bold;font-size:14px">' + menuItem.name + '</span>';
            h += '<span style="color:#888;font-size:12px;margin-left:8px">' + menuItem.price + ' din</span>';
            if (recipe.length > 0) {
                h += '<span style="color:#4CAF50;font-size:11px;margin-left:6px">(' + recipe.length + ')</span>';
            }
            h += '</div>';
            h += '<button class="btn" style="width:auto;padding:4px 12px;font-size:12px;background:' + (recipe.length > 0 ? '#2196F3' : '#4CAF50') + '" ';
            h += 'onclick="addRecipeIngredient(' + menuItem.id + ')">+ Dodaj</button>';
            h += '</div>';
            
            recipe.forEach(function(ing, idx) {
                const invItem = DB.inventory.find(function(i) { return i.id === ing.inventoryId; });
                const invName = invItem ? invItem.name : '❌ Obrisano';
                const invUnit = invItem ? invItem.unit : '';
                const invStock = invItem ? parseFloat(invItem.stock) : 0;
                const stockColor = (invItem && invItem.minStock && invStock <= invItem.minStock) ? '#E94560' : '#888';
                
                h += '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:#16213E;border-radius:6px;margin-bottom:4px">';
                h += '<span style="color:#4CAF50;font-size:12px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">';
                h += '📦 ' + invName + ' <span style="color:' + stockColor + '">(' + invStock + ' ' + invUnit + ')</span>';
                h += '</span>';
                h += '<input type="number" value="' + ing.qty + '" min="0.01" step="0.1" ';
                h += 'onchange="updateRecipeQty(' + menuItem.id + ', ' + idx + ', this.value)" ';
                h += 'style="width:55px;padding:4px;background:#0F3460;border:1px solid #2A2A4A;border-radius:4px;color:#FFD700;font-size:13px;text-align:center">';
                h += '<span style="color:#888;font-size:11px;min-width:24px">' + invUnit + '</span>';
                h += '<button onclick="removeRecipeIngredient(' + menuItem.id + ', ' + idx + ')" ';
                h += 'style="background:none;border:none;color:#E94560;font-size:16px;cursor:pointer;padding:2px 6px">✕</button>';
                h += '</div>';
            });
            
            h += '</div>';
        });
    });
    
    return h;
}


function addRecipeIngredient(menuItemId) {
    const menuItem = DB.menu.find(function(m) { return m.id === menuItemId; });
    if (!menuItem) return;
    
    const categories = {};
    DB.inventory.forEach(function(inv) {
        const cat = inv.category || 'Ostalo';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(inv);
    });
    
    let invOptions = '';
    Object.entries(categories).forEach(function([cat, items]) {
        invOptions += '<div style="color:#888;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:10px 0 4px;padding:0 4px">' + cat + '</div>';
        items.forEach(function(inv) {
            const alreadyIn = (menuItem.recipe || []).some(function(r) { return r.inventoryId === inv.id; });
            invOptions += '<div class="card ing-item" style="margin-bottom:4px;padding:10px;cursor:pointer;' + (alreadyIn ? 'opacity:0.4;' : '') + '" ';
            if (!alreadyIn) {
                invOptions += 'onclick="selectIngredient(' + menuItemId + ', \'' + inv.id + '\')"';
            }
            invOptions += '>';
            invOptions += '<div style="display:flex;justify-content:space-between;align-items:center">';
            invOptions += '<span style="font-weight:bold;font-size:13px">' + inv.name + '</span>';
            invOptions += '<span style="color:#888;font-size:12px">' + inv.stock + ' ' + inv.unit + (alreadyIn ? ' ✓' : '') + '</span>';
            invOptions += '</div></div>';
        });
    });
    
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'addIngredientModal';
    modal.innerHTML = '<div class="modal-content" style="max-height:80vh;overflow-y:auto">' +
        '<h2 style="color:#2196F3;margin-bottom:4px">+ Dodaj u recept</h2>' +
        '<p style="color:#888;font-size:13px;margin-bottom:12px">' + menuItem.name + '</p>' +
        '<input type="text" placeholder="🔍 Pretraži lager..." id="ingredientSearchInput" ' +
        'oninput="filterIngredientItems(this.value)" ' +
        'style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px;margin-bottom:12px">' +
        '<div id="ingredientList">' + invOptions + '</div>' +
        '<button class="btn btn-secondary" style="margin-top:12px" onclick="document.getElementById(\'addIngredientModal\').remove()">Odustani</button>' +
        '</div>';
    document.body.appendChild(modal);
    document.getElementById('ingredientSearchInput').focus();
}


function filterIngredientItems(search) {
    const list = document.getElementById('ingredientList');
    if (!list) return;
    const s = search.toLowerCase();
    list.querySelectorAll('.ing-item').forEach(function(item) {
        item.style.display = item.textContent.toLowerCase().includes(s) ? '' : 'none';
    });
}


function selectIngredient(menuItemId, inventoryId) {
    const menuItem = DB.menu.find(function(m) { return m.id === menuItemId; });
    if (!menuItem) return;
    
    if (!menuItem.recipe) menuItem.recipe = [];
    menuItem.recipe.push({ inventoryId: inventoryId, qty: 1 });
    
    save();
    const modal = document.getElementById('addIngredientModal');
    if (modal) modal.remove();
    render();
}


function updateRecipeQty(menuItemId, index, value) {
    const menuItem = DB.menu.find(function(m) { return m.id === menuItemId; });
    if (!menuItem || !menuItem.recipe || !menuItem.recipe[index]) return;
    menuItem.recipe[index].qty = parseFloat(value) || 1;
    save();
}


function removeRecipeIngredient(menuItemId, index) {
    const menuItem = DB.menu.find(function(m) { return m.id === menuItemId; });
    if (!menuItem || !menuItem.recipe) return;
    menuItem.recipe.splice(index, 1);
    save();
    render();
}



// ============================================
// TAB 4: INVOICE HISTORY
// ============================================
function renderInvoiceHistory() {
    if (!DB.invoices || DB.invoices.length === 0) {
        return `<div class="empty">
            <div style="font-size:48px">📜</div>
            <h3>Nema faktura</h3>
            <p>Unesite prvu fakturu</p>
        </div>`;
    }
    
    let h = '';
    const sorted = [...DB.invoices].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach(inv => {
        const date = new Date(inv.date);
        const dateStr = date.toLocaleDateString('sr-RS', {day:'2-digit', month:'2-digit', year:'numeric'});
        const timeStr = date.toLocaleTimeString('sr-RS', {hour:'2-digit', minute:'2-digit'});
        
        h += `<div class="card" style="margin-bottom:8px;cursor:pointer" onclick="toggleInvoiceDetails('${inv.id}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                    <div style="font-weight:bold;font-size:15px">${inv.source === 'eFaktura' ? '📥' : '📄'} ${inv.source === 'eFaktura' ? 'eFaktura' : 'Faktura'}</div>
                    <div style="color:#888;font-size:12px;margin-top:2px">
                        ${dateStr} ${timeStr} · ${inv.items ? inv.items.length : 0} stavki · ${inv.addedBy || 'admin'}
                        ${inv.supplierName ? '<br>🏢 ' + inv.supplierName : ''}
                        ${inv.invoiceNumber ? ' · #' + inv.invoiceNumber : ''}
                    </div>
                </div>
                <div style="text-align:right">
                    <div style="font-size:18px;font-weight:bold;color:#FFD700">${(inv.total || 0).toFixed(0)}</div>
                    <div style="color:#888;font-size:11px">din</div>
                </div>
            </div>
            <div id="inv_det_${inv.id}" style="display:none;border-top:1px solid #2A2A4A;margin-top:12px;padding-top:12px">`;
        
        if (inv.items) {
            inv.items.forEach(item => {
                const itemTotal = (item.qty || 0) * (item.unitPrice || 0);
                h += `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#B0B0B0">
                    <span>${item.name} · ${item.qty} ${item.unit || 'kom'}</span>
                    <span>${itemTotal.toFixed(0)} din</span>
                </div>`;
            });
        }
        
        h += `<button class="btn" style="margin-top:12px;background:#E94560;font-size:13px" 
            onclick="event.stopPropagation();deleteInvoice('${inv.id}')">🗑️ Obriši Fakturu</button>`;
        
        h += '</div></div>';
    });
    
    return h;
}

function toggleInvoiceDetails(invId) {
    const el = document.getElementById('inv_det_' + invId);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function deleteInvoice(invId) {
    showConfirm('🗑️ Obriši Fakturu', 'Da li ste sigurni? Stavke neće biti oduzete iz lagera.', (confirmed) => {
        if (!confirmed) return;
        DB.invoices = DB.invoices.filter(i => i.id !== invId);
        save();
        render();
    });
}


// ============================================
// ADD / EDIT INVENTORY ITEM MODALS
// ============================================
function showAddInventoryItem() {
    showModal('addInventoryModal');
}

function showEditInventoryItem(itemId) {
    const item = DB.inventory.find(i => i.id === itemId);
    if (!item) return;
    
    // Build edit modal content dynamically
    const c = document.getElementById('content');
    const existingModal = document.getElementById('editInvModalDynamic');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'editInvModalDynamic';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1001;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `<div style="background:#1A1A2E;padding:24px;border-radius:16px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto">
        <h3 style="margin-bottom:16px">✏️ Izmeni: ${item.name}</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
            <div>
                <label style="color:#888;font-size:11px">Naziv</label>
                <input type="text" id="editInvName" value="${item.name}" style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
            </div>
            <div style="display:flex;gap:8px">
                <div style="flex:1">
                    <label style="color:#888;font-size:11px">Stanje</label>
                    <input type="number" id="editInvStock" value="${item.stock}" step="0.1" style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
                </div>
                <div style="flex:1">
                    <label style="color:#888;font-size:11px">Jedinica</label>
                    <select id="editInvUnit" style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
                        ${['kom','kg','l','g','ml','pak'].map(u => `<option value="${u}" ${item.unit===u?'selected':''}>${u}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div style="display:flex;gap:8px">
                <div style="flex:1">
                    <label style="color:#888;font-size:11px">Min. stanje (upozorenje)</label>
                    <input type="number" id="editInvMin" value="${item.minStock || 0}" min="0" style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
                </div>
                <div style="flex:1">
                    <label style="color:#888;font-size:11px">Nabavna cena</label>
                    <input type="number" id="editInvCost" value="${item.costPrice || 0}" min="0" step="0.01" style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
                </div>
            </div>
            <div>
                <label style="color:#888;font-size:11px">Kategorija</label>
                <select id="editInvCat" style="width:100%;padding:10px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:14px">
                    ${['Piće','Hrana','Namirnice','Ostalo'].map(cat => `<option value="${cat}" ${item.category===cat?'selected':''}>${cat}</option>`).join('')}
                </select>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px">
                <button class="btn btn-secondary" style="flex:1" onclick="this.closest('#editInvModalDynamic').remove()">Otkaži</button>
                <button class="btn" style="flex:1;background:#E94560" onclick="deleteInventoryItem('${item.id}')">🗑️ Obriši</button>
                <button class="btn" style="flex:1;background:#4CAF50" onclick="saveEditInventoryItem('${item.id}')">💾 Sačuvaj</button>
            </div>
        </div>
    </div>`;
    
    document.body.appendChild(modal);
}

function saveEditInventoryItem(itemId) {
    const item = DB.inventory.find(i => i.id === itemId);
    if (!item) return;
    
    item.name = document.getElementById('editInvName')?.value?.trim() || item.name;
    item.stock = parseFloat(document.getElementById('editInvStock')?.value) || 0;
    item.unit = document.getElementById('editInvUnit')?.value || 'kom';
    item.minStock = parseFloat(document.getElementById('editInvMin')?.value) || 0;
    item.costPrice = parseFloat(document.getElementById('editInvCost')?.value) || 0;
    item.category = document.getElementById('editInvCat')?.value || 'Ostalo';
    
    const modal = document.getElementById('editInvModalDynamic');
    if (modal) modal.remove();
    
    save();
    render();
    showAlert('✅ Stavka ažurirana!');
}

function deleteInventoryItem(itemId) {
    showConfirm('🗑️ Obriši Stavku', 'Da li ste sigurni da želite da obrišete ovu stavku iz lagera?', (confirmed) => {
        if (!confirmed) return;
        DB.inventory = DB.inventory.filter(i => i.id !== itemId);
        const modal = document.getElementById('editInvModalDynamic');
        if (modal) modal.remove();
        save();
        render();
    });
}

function saveNewInventoryItem() {
    const name = document.getElementById('newInvName')?.value?.trim();
    const stock = parseFloat(document.getElementById('newInvStock')?.value) || 0;
    const unit = document.getElementById('newInvUnit')?.value || 'kom';
    const minStock = parseFloat(document.getElementById('newInvMin')?.value) || 0;
    const costPrice = parseFloat(document.getElementById('newInvCost')?.value) || 0;
    const category = document.getElementById('newInvCat')?.value || 'Ostalo';
    
    if (!name) { showAlert('⚠️ Unesite naziv!'); return; }
    
    // Check duplicate
    if (DB.inventory.find(i => i.name.toLowerCase() === name.toLowerCase())) {
        showAlert('⚠️ Stavka sa ovim imenom već postoji!');
        return;
    }
    
    DB.inventory.push({
        id: 'inv_' + Date.now(),
        name, unit, stock, minStock, costPrice, category,
        menuItemId: null,
        deductQty: 1
    });
    
    hideModal('addInventoryModal');
    save();
    render();
    showAlert('✅ Stavka dodata u lager!');
}


// ============================================
// DEDUCT FROM INVENTORY ON PAYMENT
// ============================================
function deductInventoryOnPayment(paidItems) {
    if (!DB.inventory || DB.inventory.length === 0) return;
    
    let deducted = [];
    
    paidItems.forEach(item => {
        const qty = parseInt(item.qty) || 1;
        
        // NOVI FORMAT: menu.recipe = [{inventoryId, qty}, ...]
        const menuItem = DB.menu.find(m => m.id == item.id);
        if (menuItem && menuItem.recipe && menuItem.recipe.length > 0) {
            menuItem.recipe.forEach(ing => {
                const invItem = DB.inventory.find(i => i.id === ing.inventoryId);
                if (invItem) {
                    const deductAmount = (parseFloat(ing.qty) || 1) * qty;
                    invItem.stock = Math.max(0, (parseFloat(invItem.stock) || 0) - deductAmount);
                    deducted.push({ name: invItem.name, amount: deductAmount, remaining: invItem.stock });
                }
            });
            return;
        }
        
        // STARI FORMAT (backward compat): inventory.menuItemId
        const invItem = DB.inventory.find(i => i.menuItemId == item.id);
        if (invItem) {
            const deductAmount = (parseFloat(invItem.deductQty) || 1) * qty;
            invItem.stock = Math.max(0, (parseFloat(invItem.stock) || 0) - deductAmount);
            deducted.push({ name: invItem.name, amount: deductAmount, remaining: invItem.stock });
        }
    });
    
    // Log low stock warnings
    deducted.forEach(d => {
        const invItem = DB.inventory.find(i => i.name === d.name);
        if (invItem && invItem.minStock > 0 && invItem.stock <= invItem.minStock) {
            console.log('⚠️ Nisko stanje: ' + invItem.name + ' = ' + invItem.stock + ' ' + invItem.unit);
        }
    });
    
    return deducted;
}


// ============================================
// eFAKTURA XML IMPORT
// ============================================

function showEfakturaUpload() {
    const area = document.getElementById('invoiceFormArea');
    if (!area) return;
    
    area.innerHTML = `
        <div class="card" style="border:2px solid #9C27B0">
            <h3 style="color:#9C27B0;margin-bottom:12px">📥 Uvoz eFaktura XML</h3>
            <p style="color:#888;font-size:13px;margin-bottom:12px">
                Skinite XML fakturu sa <strong style="color:#FFF">efaktura.mfin.gov.rs</strong> portala i izaberite ovde.
            </p>
            
            <div style="background:#16213E;border-radius:10px;padding:14px;margin-bottom:14px">
                <div style="color:#9C27B0;font-weight:bold;font-size:13px;margin-bottom:8px">📋 Kako skinuti XML:</div>
                <div style="color:#888;font-size:12px;line-height:1.6">
                    1. Otvorite <strong style="color:#FFF">efaktura.mfin.gov.rs</strong><br>
                    2. Idite na <strong style="color:#FFF">Ulazne fakture</strong><br>
                    3. Otvorite željenu fakturu<br>
                    4. Kliknite na <strong style="color:#FFF">⬇ Preuzmi XML</strong> (UBL)<br>
                    5. Sačuvajte fajl i izaberite ovde
                </div>
            </div>
            
            <label style="display:flex;align-items:center;justify-content:center;padding:40px 16px;background:#16213E;border:2px dashed #9C27B0;border-radius:12px;cursor:pointer;text-align:center">
                <input type="file" accept=".xml,text/xml,application/xml" onchange="processEfakturaXML(this.files[0])" style="display:none" id="efakturaFileInput">
                <div>
                    <div style="font-size:48px">📄</div>
                    <div style="color:#9C27B0;font-weight:bold;margin-top:8px">Izaberi XML fajl</div>
                    <div style="color:#888;font-size:11px;margin-top:4px">UBL 2.1 format sa eFaktura portala</div>
                </div>
            </label>
            
            <div id="efakturaStatus" style="display:none;margin-top:12px"></div>
            <div id="efakturaResults" style="display:none;margin-top:12px"></div>
        </div>`;
}


function processEfakturaXML(file) {
    if (!file) return;
    
    const status = document.getElementById('efakturaStatus');
    if (status) {
        status.style.display = 'block';
        status.innerHTML = `<div style="text-align:center;padding:12px">
            <div style="font-size:28px">⏳</div>
            <p style="color:#9C27B0;margin-top:6px;font-weight:bold">Čitam XML fajl...</p>
        </div>`;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const xmlText = e.target.result;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            
            // Check for parse errors
            const parseError = xmlDoc.getElementsByTagName('parsererror');
            if (parseError.length > 0) {
                showEfakturaError('XML fajl nije validan. Proverite da li ste skinuli ispravan fajl.');
                return;
            }
            
            // Parse UBL 2.1 invoice
            const result = parseUBLInvoice(xmlDoc, xmlText);
            
            if (result.items.length === 0) {
                showEfakturaError('Nisu pronađene stavke u fakturi. Proverite format XML fajla.', xmlText);
                return;
            }
            
            showEfakturaResults(result);
            
        } catch (err) {
            console.error('eFaktura XML error:', err);
            showEfakturaError('Greška pri obradi: ' + err.message);
        }
    };
    reader.onerror = function() {
        showEfakturaError('Greška pri čitanju fajla.');
    };
    reader.readAsText(file);
}


function parseUBLInvoice(xmlDoc, xmlText) {
    const items = [];
    const info = {};
    
    // UBL 2.1 namespaces used in Serbian eFaktura
    // Try multiple approaches since namespace handling varies
    
    // Extract invoice metadata
    info.invoiceNumber = getXMLText(xmlDoc, 'ID', 0) || '';
    info.issueDate = getXMLText(xmlDoc, 'IssueDate') || '';
    info.dueDate = getXMLText(xmlDoc, 'DueDate') || '';
    info.currency = getXMLAttr(xmlDoc, 'DocumentCurrencyCode') || 'RSD';
    
    // Supplier info
    const supplierParty = xmlDoc.getElementsByTagNameNS('*', 'AccountingSupplierParty')[0];
    if (supplierParty) {
        info.supplierName = getNestedText(supplierParty, 'PartyName', 'Name') 
            || getNestedText(supplierParty, 'PartyLegalEntity', 'RegistrationName')
            || '';
        info.supplierPIB = getNestedText(supplierParty, 'PartyTaxScheme', 'CompanyID') || '';
    }
    
    // Total
    const lma = xmlDoc.getElementsByTagNameNS('*', 'LegalMonetaryTotal')[0];
    if (lma) {
        info.totalWithTax = parseFloat(getChildText(lma, 'TaxInclusiveAmount')) || 0;
        info.totalWithoutTax = parseFloat(getChildText(lma, 'TaxExclusiveAmount')) || 0;
        info.payableAmount = parseFloat(getChildText(lma, 'PayableAmount')) || 0;
    }
    
    // Parse invoice lines
    const lines = xmlDoc.getElementsByTagNameNS('*', 'InvoiceLine');
    // Also try CreditNoteLine for credit notes
    const creditLines = xmlDoc.getElementsByTagNameNS('*', 'CreditNoteLine');
    const allLines = lines.length > 0 ? lines : creditLines;
    
    for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i];
        
        // Get item name
        const itemEl = line.getElementsByTagNameNS('*', 'Item')[0];
        let name = '';
        if (itemEl) {
            name = getChildText(itemEl, 'Name') || getChildText(itemEl, 'Description') || '';
        }
        if (!name) continue;
        
        // Get quantity
        const qtyEl = line.getElementsByTagNameNS('*', 'InvoicedQuantity')[0] 
            || line.getElementsByTagNameNS('*', 'CreditedQuantity')[0];
        let qty = 0;
        let unitCode = 'kom';
        if (qtyEl) {
            qty = parseFloat(qtyEl.textContent) || 0;
            unitCode = qtyEl.getAttribute('unitCode') || 'H87';
        }
        
        // Map UBL unit codes to our units
        const unit = mapUBLUnit(unitCode);
        
        // Get price per unit
        const priceEl = line.getElementsByTagNameNS('*', 'Price')[0];
        let unitPrice = 0;
        if (priceEl) {
            unitPrice = parseFloat(getChildText(priceEl, 'PriceAmount')) || 0;
        }
        
        // Line total (for verification)
        let lineTotal = parseFloat(getChildText(line, 'LineExtensionAmount')) || 0;
        
        // If no unit price but have total, calculate
        if (unitPrice === 0 && lineTotal > 0 && qty > 0) {
            unitPrice = lineTotal / qty;
        }
        
        // Get seller item ID if available
        const sellerId = itemEl ? getNestedText(itemEl, 'SellersItemIdentification', 'ID') : '';
        
        // Get tax info
        let taxPercent = 0;
        const classifiedTax = itemEl ? itemEl.getElementsByTagNameNS('*', 'ClassifiedTaxCategory')[0] : null;
        if (classifiedTax) {
            taxPercent = parseFloat(getChildText(classifiedTax, 'Percent')) || 0;
        }
        
        // Calculate price without tax if price includes tax
        // Serbian invoices typically show prices without PDV in line items
        
        items.push({
            name: name.trim(),
            qty: Math.abs(qty), // Credit notes may have negative
            unit: unit,
            unitPrice: Math.round(unitPrice * 100) / 100,
            lineTotal: Math.round(lineTotal * 100) / 100,
            taxPercent: taxPercent,
            sellerId: sellerId,
            category: guessCategory(name)
        });
    }
    
    return { info, items };
}


// Helper functions for XML parsing
function getXMLText(doc, tagName, index) {
    const els = doc.getElementsByTagNameNS('*', tagName);
    const idx = index || 0;
    return els[idx] ? els[idx].textContent.trim() : '';
}

function getXMLAttr(doc, tagName, attrName) {
    const el = doc.getElementsByTagNameNS('*', tagName)[0];
    if (!el) return '';
    if (attrName) return el.getAttribute(attrName) || '';
    return el.textContent.trim();
}

function getChildText(parent, childTagName) {
    const children = parent.getElementsByTagNameNS('*', childTagName);
    // Get the first DIRECT or near-direct child with this tag
    for (let i = 0; i < children.length; i++) {
        return children[i].textContent.trim();
    }
    return '';
}

function getNestedText(parent, midTag, childTag) {
    const mid = parent.getElementsByTagNameNS('*', midTag)[0];
    if (!mid) return '';
    const child = mid.getElementsByTagNameNS('*', childTag)[0];
    return child ? child.textContent.trim() : '';
}


// Map UBL/UN-ECE unit codes to Serbian units
function mapUBLUnit(code) {
    const unitMap = {
        // Pieces/items
        'H87': 'kom', 'EA': 'kom', 'PCE': 'kom', 'C62': 'kom', 'XPP': 'kom', 'NAR': 'kom',
        // Weight
        'KGM': 'kg', 'GRM': 'g', 'TNE': 'kg',
        // Volume
        'LTR': 'l', 'MLT': 'ml', 'HLT': 'l',
        // Packages
        'XPK': 'pak', 'XBX': 'pak', 'XCT': 'pak', 'XCS': 'pak', 'XBG': 'pak',
        // Bottles
        'XBO': 'kom', 'XBT': 'kom',
        // Other
        'MTR': 'kom', 'MTK': 'kom', 'DAY': 'kom', 'HUR': 'kom',
        // Fallback Serbian codes
        'KOM': 'kom', 'KG': 'kg', 'LIT': 'l', 'PAK': 'pak',
    };
    return unitMap[code?.toUpperCase()] || 'kom';
}


function showEfakturaError(msg, xmlText) {
    const status = document.getElementById('efakturaStatus');
    if (!status) return;
    
    let h = `<div class="card" style="border:2px solid #E94560">
        <h3 style="color:#E94560">⚠️ Greška</h3>
        <p style="color:#888;margin:8px 0">${msg}</p>`;
    
    if (xmlText) {
        h += `<details style="margin-top:8px">
            <summary style="color:#888;cursor:pointer;font-size:12px">Prikaži XML sadržaj</summary>
            <pre style="background:#16213E;padding:12px;border-radius:8px;color:#888;font-size:10px;white-space:pre-wrap;margin-top:8px;max-height:200px;overflow-y:auto">${xmlText.substring(0, 3000).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </details>`;
    }
    
    h += '</div>';
    status.innerHTML = h;
}


function showEfakturaResults(result) {
    const status = document.getElementById('efakturaStatus');
    const results = document.getElementById('efakturaResults');
    if (!status || !results) return;
    
    const info = result.info;
    const items = result.items;
    
    // Show invoice info
    status.style.display = 'block';
    status.innerHTML = `<div class="card" style="border:2px solid #4CAF50;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h3 style="color:#4CAF50;margin:0">✅ Faktura učitana</h3>
            <span style="color:#FFD700;font-weight:bold;font-size:16px">${(info.payableAmount || info.totalWithTax || 0).toFixed(0)} ${info.currency || 'RSD'}</span>
        </div>
        <div style="color:#888;font-size:12px;line-height:1.6">
            ${info.supplierName ? `<div>🏢 <strong style="color:#FFF">${escapeHtml(info.supplierName)}</strong>${info.supplierPIB ? ' · PIB: ' + info.supplierPIB.replace('RS','') : ''}</div>` : ''}
            ${info.invoiceNumber ? `<div>📄 Broj: <strong style="color:#FFF">${escapeHtml(info.invoiceNumber)}</strong></div>` : ''}
            ${info.issueDate ? `<div>📅 Datum: ${info.issueDate}</div>` : ''}
        </div>
    </div>`;
    
    // Show items with matching to existing inventory
    results.style.display = 'block';
    let h = `<div class="card" style="border:2px solid #9C27B0">
        <h3 style="color:#9C27B0;margin-bottom:12px">📋 ${items.length} stavki pronađeno</h3>
        <p style="color:#888;font-size:12px;margin-bottom:12px">Proverite stavke. 🟢 = postoji u lageru, 🔵 = nova stavka.</p>`;
    
    items.forEach((item, idx) => {
        // Try to match with existing inventory
        const existingMatch = findInventoryMatch(item.name);
        const isExisting = !!existingMatch;
        const matchColor = isExisting ? '#4CAF50' : '#2196F3';
        const matchIcon = isExisting ? '🟢' : '🔵';
        const matchLabel = isExisting ? `→ ${existingMatch.name} (stanje: ${existingMatch.stock} ${existingMatch.unit})` : 'Nova stavka';
        
        // ✅ Ako postoji u lageru, koristi jedinicu iz lagera
        // i pokušaj da izvučeš zapreminu iz imena (npr. "20L" → 20)
        let displayQty = item.qty;
        let displayUnit = item.unit;
        
        if (isExisting) {
            displayUnit = existingMatch.unit;
            
            // Ako je faktura u komadima ali lager u litrama/kg, pokušaj da izvučeš zapreminu iz imena
            if (item.unit === 'kom' && (existingMatch.unit === 'l' || existingMatch.unit === 'kg' || existingMatch.unit === 'ml' || existingMatch.unit === 'g')) {
                const volumeMatch = item.name.match(/(\d+[\.,]?\d*)\s*(l|L|lit|kg|g|ml|KG|G|ML)/);
                if (volumeMatch) {
                    const extractedVol = parseFloat(volumeMatch[1].replace(',', '.'));
                    displayQty = item.qty * extractedVol;
                    console.log('📦 ' + item.name + ': ' + item.qty + ' kom × ' + extractedVol + existingMatch.unit + ' = ' + displayQty + existingMatch.unit);
                }
            }
        }
        
        h += `<div style="background:#16213E;border-radius:10px;padding:10px 12px;margin-bottom:8px;border-left:4px solid ${matchColor}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:6px">
                        <input type="checkbox" id="efk_check_${idx}" checked style="accent-color:${matchColor};width:16px;height:16px">
                        <input type="text" value="${escapeHtml(item.name)}" id="efk_name_${idx}" 
                            style="flex:1;padding:6px 8px;background:#0F3460;border:1px solid #2A2A4A;border-radius:6px;color:#FFF;font-size:13px;min-width:0">
                    </div>
                    <div style="color:${matchColor};font-size:11px;margin:4px 0 0 22px">${matchIcon} ${matchLabel}</div>
                </div>
                <div style="text-align:right;white-space:nowrap">
                    <div style="font-weight:bold;color:#FFD700">${item.lineTotal.toFixed(0)} din</div>
                </div>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px;margin-left:22px;flex-wrap:wrap">
                <div style="flex:1;min-width:55px">
                    <div style="color:#888;font-size:10px">Količina</div>
                    <input type="number" value="${displayQty}" id="efk_qty_${idx}" step="0.1" min="0"
                        style="width:100%;padding:5px;background:#0F3460;border:1px solid #2A2A4A;border-radius:6px;color:#FFF;font-size:13px;text-align:center">
                </div>
                <div style="flex:1;min-width:55px">
                    <div style="color:#888;font-size:10px">Jedinica</div>
                    <select id="efk_unit_${idx}" style="width:100%;padding:5px;background:#0F3460;border:1px solid #2A2A4A;border-radius:6px;color:#FFF;font-size:13px">
                        ${['kom','kg','l','g','ml','pak'].map(u => `<option value="${u}" ${displayUnit===u?'selected':''}>${u}</option>`).join('')}
                    </select>
                </div>
                <div style="flex:1;min-width:55px">
                    <div style="color:#888;font-size:10px">Cena/jed</div>
                    <input type="number" value="${item.unitPrice}" id="efk_price_${idx}" step="0.01" min="0"
                        style="width:100%;padding:5px;background:#0F3460;border:1px solid #2A2A4A;border-radius:6px;color:#FFF;font-size:13px;text-align:right">
                </div>
                <div style="flex:1;min-width:55px">
                    <div style="color:#888;font-size:10px">Kategorija</div>
                    <select id="efk_cat_${idx}" style="width:100%;padding:5px;background:#0F3460;border:1px solid #2A2A4A;border-radius:6px;color:#FFF;font-size:13px">
                        ${['Piće','Hrana','Namirnice','Ostalo'].map(c => `<option value="${c}" ${item.category===c?'selected':''}>${c}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>`;
    });
    
    // Summary
    const totalNet = items.reduce((s, i) => s + i.lineTotal, 0);
    h += `<div style="display:flex;justify-content:space-between;padding:12px;background:#0F3460;border-radius:8px;margin-top:8px">
        <span style="font-weight:bold;font-size:15px">Ukupno (${items.length} stavki):</span>
        <span style="font-weight:bold;font-size:15px;color:#FFD700">${totalNet.toFixed(0)} din (bez PDV)</span>
    </div>`;
    
    h += `<div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-secondary" style="flex:1" onclick="document.getElementById('efakturaResults').style.display='none';document.getElementById('efakturaStatus').style.display='none'">✕ Otkaži</button>
        <button class="btn" style="flex:1;background:#4CAF50" onclick="confirmEfakturaImport(${items.length}, '${escapeHtml(info.supplierName || '')}', '${info.invoiceNumber || ''}')">✅ Dodaj u Lager</button>
    </div>`;
    
    h += '</div>';
    results.innerHTML = h;
}


function findInventoryMatch(name) {
    if (!DB.inventory || DB.inventory.length === 0) return null;
    
    const nameLower = name.toLowerCase().trim();
    
    // 1. Exact match
    let match = DB.inventory.find(i => i.name.toLowerCase().trim() === nameLower);
    if (match) return match;
    
    // 2. One contains the other
    match = DB.inventory.find(i => {
        const invName = i.name.toLowerCase().trim();
        return invName.includes(nameLower) || nameLower.includes(invName);
    });
    if (match) return match;
    
    // 3. Fuzzy match - remove common suffixes/prefixes and compare
    const normalize = (s) => s.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[0-9,.]+\s*(l|ml|g|kg|kom|pak|lit)\b/gi, '')
        .replace(/\b(0\.33|0\.5|1\.0|1\.5|2\.0|0,33|0,5)\b/g, '')
        .trim();
    
    const normalized = normalize(nameLower);
    if (normalized.length >= 3) {
        match = DB.inventory.find(i => {
            const invNorm = normalize(i.name.toLowerCase());
            return invNorm === normalized || 
                   (invNorm.length >= 3 && normalized.length >= 3 && 
                    (invNorm.includes(normalized) || normalized.includes(invNorm)));
        });
    }
    
    return match || null;
}


function confirmEfakturaImport(count, supplierName, invoiceNumber) {
    const checkedItems = [];
    
    for (let i = 0; i < count; i++) {
        const checkbox = document.getElementById('efk_check_' + i);
        if (!checkbox || !checkbox.checked) continue;
        
        const name = document.getElementById('efk_name_' + i)?.value?.trim();
        const qty = parseFloat(document.getElementById('efk_qty_' + i)?.value) || 0;
        const unit = document.getElementById('efk_unit_' + i)?.value || 'kom';
        const unitPrice = parseFloat(document.getElementById('efk_price_' + i)?.value) || 0;
        const category = document.getElementById('efk_cat_' + i)?.value || 'Ostalo';
        
        if (name && qty > 0) {
            checkedItems.push({ name, qty, unit, unitPrice, category });
        }
    }
    
    if (checkedItems.length === 0) {
        showAlert('⚠️ Nije označena nijedna stavka!');
        return;
    }
    
    const total = checkedItems.reduce((s, i) => s + (i.qty * i.unitPrice), 0);
    
    showConfirm('📥 Uvezi eFakturu u Lager', 
        `Da li želite da dodate ${checkedItems.length} stavki u lager?\n\n` +
        (supplierName ? `Dobavljač: ${supplierName}\n` : '') +
        (invoiceNumber ? `Br. fakture: ${invoiceNumber}\n` : '') +
        `Ukupno: ${total.toFixed(0)} din`,
        (confirmed) => {
            if (!confirmed) return;
            
            let newCount = 0;
            let updatedCount = 0;
            
            // Create invoice record
            const invoice = {
                id: 'efk_' + Date.now(),
                date: new Date().toISOString(),
                items: [...checkedItems],
                total: total,
                addedBy: DB.currentUser ? DB.currentUser.username : 'admin',
                source: 'eFaktura',
                supplierName: supplierName || '',
                invoiceNumber: invoiceNumber || ''
            };
            
            if (!DB.invoices) DB.invoices = [];
            DB.invoices.push(invoice);
            
            // Update stock
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
            
            invoiceItems = [];
            save();
            
            showAlert(`✅ eFaktura uvezena!\n\n` +
                `${updatedCount} stavki ažurirano\n` +
                `${newCount} novih stavki dodato\n` +
                `Ukupno: ${total.toFixed(0)} din`);
            
            inventoryTab = 'stock';
            render();
        }
    );
}


function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
