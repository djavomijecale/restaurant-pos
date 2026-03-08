// ============================================
// GEO LOKACIJA - Login samo iz restorana
// ============================================

const GEO_CHECK_INTERVAL = 5 * 60 * 1000; // Provera svakih 5 minuta
let geoCheckTimer = null;
let lastGeoStatus = null; // 'ok', 'out', 'error', 'disabled'

// Računa udaljenost između dve GPS tačke u metrima (Haversine formula)
function getDistanceMeters(lat1, lon1, lat2, lon2) {
    var R = 6371000; // Radijus Zemlje u metrima
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}


function isGeoEnabled() {
    var s = DB.settings || {};
    return s.geoEnabled && s.geoLat && s.geoLng;
}


function getGeoSettings() {
    var s = DB.settings || {};
    return {
        enabled: s.geoEnabled || false,
        lat: parseFloat(s.geoLat) || 0,
        lng: parseFloat(s.geoLng) || 0,
        radius: parseInt(s.geoRadius) || 200
    };
}


// Proveri lokaciju korisnika - vraća Promise
function checkUserLocation() {
    return new Promise(function(resolve) {
        if (!isGeoEnabled()) {
            resolve({ allowed: true, status: 'disabled' });
            return;
        }

        // Admin je uvek dozvoljen
        if (DB.currentUser && DB.currentUser.role === 'admin') {
            resolve({ allowed: true, status: 'admin' });
            return;
        }

        if (!navigator.geolocation) {
            resolve({ allowed: false, status: 'no_gps', message: 'Vaš uređaj ne podržava GPS.' });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            function(position) {
                var geo = getGeoSettings();
                var dist = getDistanceMeters(
                    position.coords.latitude, position.coords.longitude,
                    geo.lat, geo.lng
                );
                var allowed = dist <= geo.radius;
                
                console.log('📍 GPS: ' + Math.round(dist) + 'm od restorana (dozvoljeno: ' + geo.radius + 'm) → ' + (allowed ? '✅' : '❌'));
                
                resolve({
                    allowed: allowed,
                    status: allowed ? 'ok' : 'out',
                    distance: Math.round(dist),
                    radius: geo.radius,
                    message: allowed 
                        ? 'Lokacija OK (' + Math.round(dist) + 'm)' 
                        : 'Niste u restoranu! Udaljenost: ' + Math.round(dist) + 'm (dozvoljeno: ' + geo.radius + 'm)'
                });
            },
            function(error) {
                var msg = 'GPS greška: ';
                switch(error.code) {
                    case 1: msg += 'Pristup lokaciji je odbijen. Dozvolite lokaciju u podešavanjima pregledača.'; break;
                    case 2: msg += 'Lokacija nedostupna.'; break;
                    case 3: msg += 'Timeout - pokušajte ponovo.'; break;
                    default: msg += error.message;
                }
                console.warn('📍 GPS greška:', msg);
                resolve({ allowed: false, status: 'error', message: msg });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    });
}


// Periodična provera lokacije tokom smene
function startGeoTracking() {
    if (!isGeoEnabled()) return;
    if (DB.currentUser && DB.currentUser.role === 'admin') return;
    
    stopGeoTracking();
    
    geoCheckTimer = setInterval(async function() {
        // Samo ako je konobar ulogovan i ima otvorenu smenu
        if (!DB.currentUser || DB.currentUser.role === 'admin') return;
        if (!DB.workdays || !DB.workdays[DB.currentUser.username]) return;
        
        var result = await checkUserLocation();
        lastGeoStatus = result.status;
        
        if (!result.allowed && result.status === 'out') {
            console.warn('📍 Konobar van restorana: ' + result.distance + 'm');
            showAlert('⚠️ Upozorenje\n\nNiste u blizini restorana!\nUdaljenost: ' + result.distance + 'm\n\nAko napustite restoran, smena može biti automatski zatvorena.');
        }
    }, GEO_CHECK_INTERVAL);
    
    console.log('📍 Geo tracking pokrenut (provera svakih ' + (GEO_CHECK_INTERVAL/60000) + ' min)');
}


function stopGeoTracking() {
    if (geoCheckTimer) {
        clearInterval(geoCheckTimer);
        geoCheckTimer = null;
    }
}


// ============================================
// ADMIN PODEŠAVANJA ZA LOKACIJU
// ============================================
function renderGeoSettings() {
    var s = DB.settings || {};
    var hasCoords = s.geoLat && s.geoLng;
    
    return '<div class="card" style="margin-bottom:16px;border:2px solid #FF5722">' +
        '<h3 style="color:#FF5722;margin-bottom:16px">📍 Geo Lokacija (Login iz Restorana)</h3>' +
        '<p style="color:#888;font-size:13px;margin-bottom:12px">Konobari mogu da se uloguju samo kad su u restoranu. Admin nema ograničenje.</p>' +
        
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">' +
            '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
                '<input type="checkbox" id="geoEnabled" ' + (s.geoEnabled ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:#FF5722">' +
                '<span style="color:' + (s.geoEnabled ? '#FF5722' : '#888') + ';font-weight:bold">' + (s.geoEnabled ? 'AKTIVNO' : 'NEAKTIVNO') + '</span>' +
            '</label>' +
        '</div>' +
        
        '<div style="display:flex;gap:8px;margin-bottom:12px">' +
            '<div style="flex:1">' +
                '<label style="color:#888;font-size:12px;display:block;margin-bottom:4px">Latitude</label>' +
                '<input type="text" id="geoLat" value="' + (s.geoLat || '') + '" placeholder="44.XXXXXX" ' +
                    'style="width:100%;padding:8px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:13px;font-family:monospace">' +
            '</div>' +
            '<div style="flex:1">' +
                '<label style="color:#888;font-size:12px;display:block;margin-bottom:4px">Longitude</label>' +
                '<input type="text" id="geoLng" value="' + (s.geoLng || '') + '" placeholder="20.XXXXXX" ' +
                    'style="width:100%;padding:8px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:13px;font-family:monospace">' +
            '</div>' +
            '<div style="min-width:80px">' +
                '<label style="color:#888;font-size:12px;display:block;margin-bottom:4px">Radijus (m)</label>' +
                '<input type="number" id="geoRadius" value="' + (s.geoRadius || 200) + '" min="50" max="1000" step="50" ' +
                    'style="width:100%;padding:8px;background:#16213E;border:1px solid #2A2A4A;border-radius:8px;color:#FFF;font-size:13px;text-align:center">' +
            '</div>' +
        '</div>' +
        
        '<div style="display:flex;gap:8px;margin-bottom:12px">' +
            '<button class="btn" style="flex:1;background:#FF5722" onclick="geoDetectLocation()">📍 Detektuj Moju Lokaciju</button>' +
            '<button class="btn" style="flex:1;background:#4CAF50" onclick="saveGeoSettings()">💾 Sačuvaj</button>' +
        '</div>' +
        
        (hasCoords ? '<div style="background:#16213E;padding:10px;border-radius:8px;color:#4CAF50;font-size:12px;text-align:center">' +
            '✅ Restoran: ' + parseFloat(s.geoLat).toFixed(6) + ', ' + parseFloat(s.geoLng).toFixed(6) + ' · Radijus: ' + (s.geoRadius || 200) + 'm' +
        '</div>' : '<div style="background:#16213E;padding:10px;border-radius:8px;color:#FF9800;font-size:12px;text-align:center">' +
            '⚠️ Kliknite "Detektuj Moju Lokaciju" dok ste u restoranu' +
        '</div>') +
    '</div>';
}


function geoDetectLocation() {
    if (!navigator.geolocation) {
        showAlert('❌ Vaš uređaj ne podržava GPS');
        return;
    }
    
    showAlert('📍 Detektujem lokaciju...');
    
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            document.getElementById('geoLat').value = pos.coords.latitude.toFixed(6);
            document.getElementById('geoLng').value = pos.coords.longitude.toFixed(6);
            showAlert('✅ Lokacija detektovana!\n\n' + pos.coords.latitude.toFixed(6) + ', ' + pos.coords.longitude.toFixed(6) + '\n\nKliknite "Sačuvaj" da potvrdite.');
        },
        function(err) {
            showAlert('❌ Ne mogu da detektujem lokaciju.\n\nDozvolite pristup lokaciji u pregledaču.');
        },
        { enableHighAccuracy: true, timeout: 15000 }
    );
}


function saveGeoSettings() {
    if (!DB.settings) DB.settings = {};
    DB.settings.geoEnabled = document.getElementById('geoEnabled').checked;
    DB.settings.geoLat = document.getElementById('geoLat').value.trim();
    DB.settings.geoLng = document.getElementById('geoLng').value.trim();
    DB.settings.geoRadius = parseInt(document.getElementById('geoRadius').value) || 200;
    save();
    render();
    showAlert('✅ Geo podešavanja sačuvana!' + (DB.settings.geoEnabled ? '\n\n📍 Konobari moraju biti u krugu od ' + DB.settings.geoRadius + 'm.' : '\n\n📍 Geo provera je isključena.'));
}
