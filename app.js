const CACHE_PREFIX = 'seatapp_'; 
function setCache(key, value, ttlMs) { try { const payload = { value, expires: Date.now() + ttlMs }; localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload)); } catch(e){} } 
function getCache(key) { try { const raw = localStorage.getItem(CACHE_PREFIX + key); if(!raw) return null; const payload = JSON.parse(raw); if(!payload || typeof payload.expires!== 'number') return null; if(Date.now() > payload.expires){ localStorage.removeItem(CACHE_PREFIX + key); return null;} return payload.value; } catch(e){ return null; } } 
function clearCache(key) { try { localStorage.removeItem(CACHE_PREFIX + key); } catch(e){} } 
 const BASE_URL = 'https://script.google.com/macros/s/AKfycbxp22XHzfE8JLdVkePwa6xq4ixw3xhCoxioqplh_BkzMCwLCiYAql52xwmYRnpcN475/exec'; 
 const API_KEY = null; 
 function QS(params){ 
 var q = []; 
 for (var k in params){ 
 if(!params.hasOwnProperty(k)) continue; 
 var v = params[k]; 
 if(v !== undefined && v !== null && v !== '') q.push(encodeURIComponent(k)+'='+encodeURIComponent(v)); 
 } 
 return '?' + q.join('&'); 
 } 
 async function parseResponse(res) { 
 const text = await res.text(); 
 try { return JSON.parse(text); } catch { return text; } 
 } 
 function withCommonParams(extra) { 
 var base = { api: '1' }; 
 extra = extra ||{}; 
 for (var k in extra){ if(extra.hasOwnProperty(k)) base[k] = extra[k]; } 
 if (API_KEY) base.apiKey = API_KEY; 
 return base; 
 } 
 function getUrl(action, extraParams) { 
 return BASE_URL + QS(withCommonParams(Object.assign({ action: action }, (extraParams ||{})))); 
 } 
 function postOptions(payloadObj) { 
 return { 
 method: 'POST', 
 redirect: 'follow', 
 headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
 body: JSON.stringify(payloadObj ||{}) 
 }; 
 } 
 // === API (sin cambios públicos) === 
 async function apiGetTrips(folderId) { 
 const res = await fetch(getUrl('trips', { folderId: folderId })); 
 if (!res.ok) throw new Error('GET trips: ' + res.status); 
 return parseResponse(res); 
 } 
 async function apiGetSeats(fileId, sheetName) { 
 const res = await fetch(getUrl('seats', { fileId: fileId, sheetName: sheetName })); 
 if (!res.ok) throw new Error('GET seats: ' + res.status); 
 return parseResponse(res); 
 } 
 async function apiGetSeatsByCi(fileId, sheetName, ci) { 
 const res = await fetch(getUrl('seatsByCi', { fileId: fileId, sheetName: sheetName, ci: ci })); 
 if (!res.ok) throw new Error('GET seatsByCi: ' + res.status); 
 return parseResponse(res); 
 } 
 async function apiGetLogo() { 
 const res = await fetch(getUrl('logo')); 
 if (!res.ok) throw new Error('GET logo: ' + res.status); 
 return parseResponse(res); 
 } 
 // === Cambios para control interno: enviar idToken === 
 async function apiExportPdf(fileId, sheetName){ // GET con idToken en query 
 const res = await fetch(getUrl('exportPdf', { fileId, sheetName, idToken: ID_TOKEN })); 
 if (!res.ok) throw new Error('GET exportPdf: ' + res.status); 
 return parseResponse(res); 
 } 
 async function apiReserve(fileId, sheetName, pairs) { 
 const res = await fetch(getUrl('reserve'), postOptions({ fileId: fileId, sheetName: sheetName, pairs: pairs })); 
 if (!res.ok) throw new Error('POST reserve: ' + res.status); 
 return parseResponse(res); 
 } 
 async function apiMove(fileId, sheetName, sourceCode, targetCode){ // POST con idToken 
 const res = await fetch(getUrl('move'), postOptions({ fileId, sheetName, sourceCode, targetCode, idToken: ID_TOKEN })); 
 if (!res.ok) throw new Error('POST move: ' + res.status); 
 return parseResponse(res); 
 } 
 async function apiFree(fileId, sheetName, code) { // POST con idToken 
 const res = await fetch(getUrl('free'), postOptions({ fileId, sheetName, code, idToken: ID_TOKEN })); 
 if (!res.ok) throw new Error('POST free: ' + res.status); 
 return parseResponse(res); 
 } 
 // === Nuevo: login con Google (GIS) usando idToken 
 async function apiLoginWithToken(idToken){ 
 const res = await fetch(getUrl('login'), postOptions({ idToken })); 
 if (!res.ok) throw new Error('POST login: ' + res.status); 
 return parseResponse(res); 
 } 
 // === NUEVO: crear viaje (Staff Admin)
 async function apiCreateTrip(name, type, startAt){
  const res = await fetch(getUrl('createTrip'), postOptions({ idToken: ID_TOKEN, name, type, startAt }));
  if(!res.ok) throw new Error('POST createTrip: ' + res.status);
  return parseResponse(res);
 }
 
// === NUEVO: archivar (eliminar) viaje - mover a carpeta interna (robusto)
async function apiArchiveTrip(fileId) {
  const token = (typeof window !== 'undefined' && window.ID_TOKEN) ? window.ID_TOKEN : null;
  if (!token) throw new Error('Sesión staff no iniciada. Volvé a iniciar sesión.');

  const res = await fetch(getUrl('archiveTrip'), postOptions({ idToken: token, fileId }));
  const payload = await parseResponse(res); // intenta JSON; si no, vuelve texto
  if (!res.ok) {
    const msg = (payload && payload.message) ? payload.message : ('HTTP ' + res.status);
    throw new Error(msg);
  }
  return payload;
}

window.API = { apiGetTrips, apiGetSeats, apiGetSeatsByCi, apiGetLogo, apiExportPdf, apiReserve, apiMove, apiFree, apiLoginWithToken, apiCreateTrip };
// === STABILIZE: garantizar export apiArchiveTrip sin tocar el objeto
try { window.API = window.API || {}; if (typeof window.API.apiArchiveTrip !== 'function') window.API.apiArchiveTrip = apiArchiveTrip; } catch(_) {}
 
 /* ===== Estado global ===== */ 
 var SEATS = {}; var selected = new Set(); var NUM_LABELS = new Map(); 
 var HIGHLIGHT_CODES = new Set(); var LAST_FOUND_CODES = []; 
 var CONTROL_AUTH = false; var CONTROL_EDIT = false; var EDIT_SRC = null; var EDIT_DST = null; 
 var BUSY = false; 
var BOOTSTRAPING = true;
 /* Viaje/hoja actual */ 
 var CURRENT_TRIP = { fileId: null, name: null, sheets: [], sheetName: null, hasFloors: false }; 
 /* Persistencia staff */ 
 var STAFF_KEY = 'app_staff_mode'; 
 function setStaffSession(enabled){ try { if (enabled) localStorage.setItem(STAFF_KEY, '1'); else localStorage.removeItem(STAFF_KEY); } catch(e){} } 
 function isStaffSession(){ try { return localStorage.getItem(STAFF_KEY) === '1'; } catch(e){ return false; } } 
 /* Staff (multi) */ 
 var STAFF_CONTROL_MULTI = false; 
 var STAFF_ACTIVE_SHEET = null; 
 var STAFF_SHEETS = []; 
 var STAFF_SEATS_BY_SHEET = new Map(); 
 /* ===== Router por hash ===== */ 
 var TRIPS_CACHE = []; 
 var ROUTER_DRIVING = false; 
 function buildHash(segments){ return '#/' + (segments ||[]).map(function(s){ return encodeURIComponent(String(s || '')); }).join('/'); } 
 function setHash(segments){ if (ROUTER_DRIVING) return; location.hash = buildHash(segments); } 
 function getHashSegments(h){ 
 var raw = String(h || (location.hash || '')).replace(/^#\/?/, ''); 
 if (!raw) return []; 
 return raw.split('/').map(function(p){ try { return decodeURIComponent(p); } catch(e){ return p; } }); 
 } 
 async function ensureTripsCache(){ 
 if (TRIPS_CACHE && TRIPS_CACHE.length) return TRIPS_CACHE; 
 try{ 
 var cached = getCache("trips"); 
 var payload = cached ? { trips: cached } : await API.apiGetTrips(); 
 if (!cached) setCache("trips", payload.trips ||[], 5 * 60 * 1000); 
 TRIPS_CACHE = payload.trips ||[]; 
 }catch(e){ 
 TRIPS_CACHE = []; 
 } 
 return TRIPS_CACHE; 
 } 
 async function resolveTripByName(name){ 
 var trips = await ensureTripsCache(); 
 var target = (name || '').trim().toLowerCase(); 
 return trips.find(function(t){ return (t.name || '').trim().toLowerCase() === target; }) || null; 
 } 
 function getFloorLabelFromSheetName(sheetName){ 
 var s = String(sheetName || '').toLowerCase(); 
 if (s.indexOf('alta') >= 0) return 'Planta alta'; 
 if (s.indexOf('baja') >= 0) return 'Planta baja'; 
 return sheetName; 
 } 
 function getSheetNameFromFloorLabel(trip, floorLabel){ 
 if (!trip || !Array.isArray(trip.sheets)) return null; 
 var lbl = String(floorLabel || '').toLowerCase(); 
 if (lbl.indexOf('alta') >= 0){ 
 return trip.sheets.find(function(s){ return s.toLowerCase() === 'asientos alta'; })
 || trip.sheets.find(function(s){ return s.toLowerCase().indexOf('alta') >= 0; })
 || null; 
 } 
 if (lbl.indexOf('baja') >= 0){ 
 return trip.sheets.find(function(s){ return s.toLowerCase() === 'asientos baja'; })
 || trip.sheets.find(function(s){ return s.toLowerCase().indexOf('baja') >= 0; })
 || null; 
 } 
 return trip.sheets.find(function(s){ return s.toLowerCase() === 'asientos'; })
 || trip.sheets[0]
 || null; 
 } 
 async function routeTo(hash){ 
 var segs = getHashSegments(hash); 
 if (!segs.length){ 
 setHash(['Inicio']); 
 showView('view-choose'); 
 await loadTrips(); 
 return; 
 } 
 var head = (segs[0] || '').trim(); 
 ROUTER_DRIVING = true; 
 try{ 
 if (head.toLowerCase() === 'inicio'){
 showView('view-choose'); 
 await loadTrips(); 
 return; 
 } 
 if (head.toLowerCase() === 'staff'){
 if (segs.length === 1){ 
 openStaffLogin(); 
 return; 
 } 
 var tripNameStaff = segs[1]; 
 if (!CONTROL_AUTH){ 
 openStaffLogin(); 
 toast('Inicia sesión para ver el panel Staff de "' + tripNameStaff + '".'); 
 return; 
 } 
 var trS = await resolveTripByName(tripNameStaff); 
 if (!trS){ toast('No se encontró el viaje "'+tripNameStaff+'".'); backToChoose(); return; } 
 selectTrip(trS); 
 return; 
 } 
 if (head.toLowerCase() === 'selección de asientos'){
 var tripNameSel = segs[1]; 
 var trSel = await resolveTripByName(tripNameSel); 
 if (!trSel){ toast('No se encontró el viaje "'+tripNameSel+'".'); backToChoose(); return; } 
 CURRENT_TRIP = { fileId: trSel.fileId, name: trSel.name, sheets: trSel.sheets, sheetName: null, hasFloors: !!trSel.hasFloors }; 
 updateTripTags(); 
 if (segs[2]){ 
 var floorLbl = segs[2]; 
 var sheet = getSheetNameFromFloorLabel(trSel, floorLbl); 
 if (!sheet){ toast('No se encontró la planta en "'+trSel.name+'".'); selectTrip(trSel); return; } 
 await chooseFloor(sheet); 
 return; 
 } 
 if (trSel.hasFloors){ 
 selectTrip(trSel); 
 }else{ 
 var sheetConv = getSheetNameFromFloorLabel(trSel, 'asientos'); 
 CURRENT_TRIP.sheetName = sheetConv; 
 await goSelect(); 
 } 
 return; 
 } 
 var trPlain = await resolveTripByName(head); 
 if (!trPlain){ 
 backToChoose(); 
 await loadTrips(); 
 return; 
 } 
 selectTrip(trPlain); 
 }finally{ 
 ROUTER_DRIVING = false; 
 } 
 } 
 /* ===== Navegación (vistas) ===== */ 
 function showView(id){ var els=document.querySelectorAll('.view'); for(var i=0;i<els.length;i++){ els[i].classList.remove('active'); } var el = document.getElementById(id); if (el) el.classList.add('active'); } 
 function goHome(){ 
 if(!CURRENT_TRIP.fileId || !CURRENT_TRIP.sheetName){ setHash(['Inicio']); showView('view-choose'); return; } 
 updateTripTags(); showView('view-home'); 
 setHash([CURRENT_TRIP.name]); 
 } 
 function goTripMenu(){ 
 if(!CURRENT_TRIP.fileId){ setHash(['Inicio']); showView('view-choose'); return; } 
 if(CURRENT_TRIP.hasFloors){ 
 updateTripTags(); showView('view-floor'); setHash([CURRENT_TRIP.name]); 
 }else{ 
 updateTripTags(); showView('view-home'); setHash([CURRENT_TRIP.name]); 
 } 
 } 
 function handleEnter(ev, cb){ if(ev.key === 'Enter') cb(); } 
 /* ===== UI helpers ===== */ 
 function toast(msg){
function nextPaint(){ return new Promise(requestAnimationFrame); }
 var bar = document.getElementById('snackbar'); if(!bar) return; bar.textContent = msg; bar.classList.add('show'); setTimeout(function(){ bar.classList.remove('show'); }, 2800); } 
 function showLoading(msg){ var ov = document.getElementById('overlay'); if(!ov) return; ov.querySelector('.loader-text').textContent = msg || 'Cargando…'; ov.setAttribute('aria-hidden','false'); ov.classList.add('show'); } 
function hideLoading(){
  if (BOOTSTRAPING) return; // ⛔ no ocultar loader durante arranque inicial
  var ov = document.getElementById('overlay');
  if(!ov) return;
  ov.classList.remove('show');
  ov.setAttribute('aria-hidden','true');
}
 function normalize(code){ return (code || '').toString().replace(/\u00A0/g,' ').replace(/\s+/g,'').trim().toUpperCase(); } 
 function firstName(full){ var t = (full || '').trim(); if(!t) return ''; var name = t.split(/\s+/)[0]; return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(); } 
 function onlyDigits(el){ el.value = el.value.replace(/\D+/g, ''); } 
function syncSelectedCounter() { 
 var badge = document.getElementById('selectedCounter'); 
 var live = document.getElementById('selectedCounterLive'); 
 var btn = document.getElementById('btnReservePersistent'); 
 var count = selected ? selected.size : 0; 
 if (badge) { 
 if (count > 0) { 
 badge.textContent = String(count); 
 badge.classList.remove('hidden'); 
 } else { 
 badge.textContent = '0'; 
 badge.classList.add('hidden'); 
 } 
 } 
 if (live) { 
 live.textContent = count === 0
 ? 'Sin asientos seleccionados'
 : (count === 1 ? 'Un asiento seleccionado' : (count + ' asientos seleccionados'));
 } 
 if (btn) { 
 btn.disabled = (count === 0); 
 btn.setAttribute('aria-disabled', (count === 0) ? 'true' : 'false'); 
 } 
}
/* ===== Admin (Easter Egg) ===== */ 
function showAdminMenu(){ var m = document.getElementById('adminMenu'); if (m) m.classList.remove('hidden'); } 
function hideAdminMenu(){ var m = document.getElementById('adminMenu'); if (m) m.classList.add('hidden'); } 
function toggleAdminMenu(){ var m = document.getElementById('adminMenu'); if (m) m.classList.toggle('hidden'); } 
function updateAdminMenu(){ 
 var bLogin = document.getElementById('btnAdminLogin'); 
 var bPanel = document.getElementById('btnAdminControl'); 
 var bLogout = document.getElementById('btnAdminLogout'); 
 if(!bLogin || !bPanel || !bLogout) return; 
 var isAuth = CONTROL_AUTH; 
 bLogin.classList.toggle('hidden', isAuth); 
 bPanel.classList.toggle('hidden', !isAuth); 
 bLogout.classList.toggle('hidden', !isAuth); 
} 
function syncStaffBadge(){ var el = document.getElementById('staffBadge'); if (el) el.classList.toggle('hidden', !CONTROL_AUTH); } 
// ====== GIS: estado Staff (frontend) 
const GOOGLE_CLIENT_ID = '273442733710-1eqf1erm1vl9vsad2lb4krennldt1jhf.apps.googleusercontent.com'; 
var ID_TOKEN = null; 
var STAFF_ROLE = null; 
var STAFF_EMAIL = null; 
function isAdmin(){ return CONTROL_AUTH && STAFF_ROLE === 'admin'; } 
function syncControlFormVisibility(){ 
 var box = document.getElementById('googleSigninBox'); 
 if (!box) return; 
 box.hidden = !!CONTROL_AUTH; // si está logueado, ocultar login 
} 
// ===== NUEVO: visibilidad de botón Agregar viaje =====
function syncAddTripVisibility(){
  var btn = document.getElementById('btnAddTrip');
  var actions = document.getElementById('tripListActions');
  var show = CONTROL_AUTH && isAdmin();
  if(btn) btn.classList.toggle('hidden', !show);
  if(actions) actions.classList.toggle('hidden', !show);
}
/* ===== Elegir viaje ===== */ 

// ===== NUEVO: cálculo de cuenta regresiva del viaje =====
function getCountdownText(startAt){
  if(!startAt) return null;

  const now = new Date();
  const start = new Date(startAt);
  if (isNaN(start.getTime())) return null;

  const diffMs = start - now;
  if (diffMs <= 0) {
    return { text: 'En curso', status: 'live' };
  }

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) {
    return { text: `Faltan ${days} días`, status: 'future' };
  }

  if (hours > 0) {
    return { text: `Faltan ${hours}h ${minutes}m ${seconds}s`, status: 'future' };
  }

  return { text: `Faltan ${minutes}m ${seconds}s`, status: 'future' };
}


async function loadTrips(){ 
 showLoading('Cargando viajes…'); 
 try{ 
 var cached = getCache("trips"); 
 var payload = cached ? { trips: cached } : await API.apiGetTrips(); 
 if (!cached) setCache("trips", payload.trips ||[], 5 * 60 * 1000); 
 var trips = payload.trips ||[]; 
 TRIPS_CACHE = trips; 
 var list = document.getElementById('tripList'); if(!list) return; list.innerHTML = ''; 
 // Mostrar botón Agregar si corresponde
 syncAddTripVisibility();
 trips.forEach(function(tr){ 
 var card = document.createElement('div'); card.className='trip-card'; card.tabIndex=0; 
 var head = document.createElement('div'); head.className='trip-head'; 
 var title = document.createElement('h3'); title.textContent = tr.name; 
 var pill = document.createElement('span'); pill.className='trip-pill'; pill.textContent = tr.hasFloors ? 'Doble piso' : 'Convencional'; 
 head.appendChild(title); head.appendChild(pill); 
 card.appendChild(head);
  // NUEVO: cuenta regresiva del viaje
  if (tr.startAt) { const info = getCountdownText(tr.startAt); if (info) { const cd = document.createElement('div'); cd.className = 'trip-countdown ' + info.status; cd.textContent = info.text;
 cd.dataset.startAt = tr.startAt; card.appendChild(cd); } } 
 card.onclick = function(){ selectTrip(tr); }; 
 card.onkeypress = function(ev){ if(ev.key==='Enter') selectTrip(tr); }; 
 
    // === NUEVO: botón Eliminar (solo admin) ===
    if (CONTROL_AUTH && isAdmin()) {
      var foot = document.createElement('div');
      foot.className = 'actions';
      foot.style.justifyContent = 'flex-end';
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn danger';
      del.textContent = 'Eliminar';
      del.onclick = async function(ev){ ev.stopPropagation(); await promptArchiveTrip(tr); };
      foot.appendChild(del);
      card.appendChild(foot);
    }

    list.appendChild(card); 
 }); 
 if(!trips.length){
      list.innerHTML = `
        <div class="empty-state">
          <h3>No hay viajes disponibles en este momento</h3>
          <p>Nos estaremos viendo próximamente en nuevos destinos 🌍</p>
        </div>
      `;
    } 
 }catch(err){ 
 toast('No se pudieron cargar los viajes'); 
 } 
 finally{ hideLoading(); } 
 } 
function backToChoose(){ 
 CURRENT_TRIP = { fileId:null, name:null, sheets:[], sheetName:null, hasFloors:false }; 
 STAFF_CONTROL_MULTI = false; STAFF_ACTIVE_SHEET = null; 
 showView('view-choose');
 syncAddTripVisibility();
 setHash(['Inicio']); 
 } 
function selectTrip(tr){ 
 CURRENT_TRIP = { fileId: tr.fileId, name: tr.name, sheets: tr.sheets, sheetName: null, hasFloors: !!tr.hasFloors }; 
 if (CONTROL_AUTH && CURRENT_TRIP.hasFloors) { 
 showView('view-control'); 
 showLoading('Cargando ocupación (ambas plantas)…'); 
 setHash(['Staff', CURRENT_TRIP.name]); 
 refreshStaffMulti().then(function(){ hideLoading(); }); 
 return; 
 } 
 if (CONTROL_AUTH && !CURRENT_TRIP.hasFloors) { 
 showView('view-control'); 
 showLoading('Cargando ocupación…'); 
 setHash(['Staff', CURRENT_TRIP.name]); 
 var sheetStaff = tr.sheets.find(function(s){ return s.toLowerCase() === 'asientos'; }) || tr.sheets[0]; 
 CURRENT_TRIP.sheetName = sheetStaff; 
 refreshSeats(null, function(){ renderControlBoard(); hideLoading(); }); 
 return; 
 } 
 if(CURRENT_TRIP.hasFloors){ 
 var floorBox = document.getElementById('floorCards'); if (floorBox) floorBox.innerHTML = ''; 
 var extraBox = document.getElementById('floorFindCard'); if (extraBox) extraBox.innerHTML = ''; 
 var bajaName = tr.sheets.find(function(s){ return s.toLowerCase() === 'asientos baja'; }); 
 var altaName = tr.sheets.find(function(s){ return s.toLowerCase() === 'asientos alta'; }); 
 var candidates = []; 
 if(bajaName) candidates.push({ label:'Planta baja', sheetName:bajaName, desc:'Acceso rápido, usualmente cerca del conductor.' }); 
 if(altaName) candidates.push({ label:'Planta alta', sheetName:altaName, desc:'Mayor altura y vista panorámica.' }); 
 if(!candidates.length){ tr.sheets.forEach(function(s){ candidates.push({ label:s, sheetName:s, desc:null }); }); } 
 function makeCard(label, desc, onClick){ 
 var card = document.createElement('article'); card.className='card'; card.tabIndex=0; card.setAttribute('role','button'); 
 var h2 = document.createElement('h2'); h2.textContent = label; 
 var p = document.createElement('p'); p.textContent = desc || ''; 
 card.appendChild(h2); card.appendChild(p); 
 card.onclick = onClick; 
 card.onkeypress = function(ev){ if(ev.key==='Enter') onClick(); }; 
 return card; 
 } 
 candidates.forEach(function(c){ 
 var el = makeCard(c.label, c.desc ? c.desc : ('Hoja: ' + c.sheetName), function(){ chooseFloor(c.sheetName); }); 
 if (floorBox) floorBox.appendChild(el); 
 }); 
 var findCard = makeCard('Mirá tu asiento', 'Buscá tus asientos por CI en ambas plantas.', function(){ goFind(); }); 
 if (extraBox) extraBox.appendChild(findCard); 
 updateTripTags(); 
 showView('view-floor'); 
 setHash([CURRENT_TRIP.name]); 
 }else{ 
 var sheet = tr.sheets.find(function(s){ return s.toLowerCase() === 'asientos'; }) || tr.sheets[0]; 
 CURRENT_TRIP.sheetName = sheet; 
 updateTripTags(); 
 showView('view-home'); 
 setHash([CURRENT_TRIP.name]); 
 } 
 } 
/* ===== Helpers doble piso ===== */ 
function getFloorSheets(){ 
 var sheets = CURRENT_TRIP.sheets || []; 
 var baja = sheets.find(function(s){ return s.toLowerCase() === 'asientos baja'; }); 
 var alta = sheets.find(function(s){ return s.toLowerCase() === 'asientos alta'; }); 
 var result = []; 
 if(baja) result.push({ sheetName:baja, label:'Planta baja' }); 
 if(alta) result.push({ sheetName:alta, label:'Planta alta' }); 
 if(!result.length) sheets.forEach(function(s){ result.push({ sheetName:s, label:s }); }); 
 return result; 
 } 
/* ===== STAFF: tooltip ===== */ 
function ensureSeatTooltip(){ 
 var t = document.getElementById('seatTooltip'); 
 if(!t){ 
 t = document.createElement('div'); 
 t.id = 'seatTooltip'; 
 t.className = 'seat-tooltip'; 
 document.body.appendChild(t); 
 } 
 return t; 
 } 
function showSeatTooltipFor(btn){ 
 var status = (btn.getAttribute('data-status') || '').toLowerCase().trim(); 
 if (status !== 'ocupado') return; 
 var full = ''; 
 var occSpan = btn.querySelector('.occ-full'); 
 if (occSpan) full = (occSpan.textContent || '').trim(); 
 if (!full) return; 
 var num = btn.getAttribute('data-num') || ''; 
 var code = btn.getAttribute('data-code') || ''; 
 var rect = btn.getBoundingClientRect(); 
 var x = rect.left + rect.width/2; 
 var y = rect.top; 
 var tip = ensureSeatTooltip(); 
 tip.innerHTML = '<div>'+full+'</div>' + 
 '<div class="meta">Asiento '+code+(num?(' • N° '+num):'')+'</div>'; 
 tip.style.left = Math.round(x) + 'px'; 
 tip.style.top = Math.round(y) + 'px'; 
 tip.classList.add('show'); 
 btn.classList.add('expanded'); 
 btn.setAttribute('aria-expanded','true'); 
 } 
function hideSeatTooltip(){ 
 var tip = document.getElementById('seatTooltip'); 
 if (tip) tip.classList.remove('show'); 
 collapseExpandedSeats(); 
 } 
function collapseExpandedSeats(){ 
 var exps = document.querySelectorAll('#controlCroquis .seat.expanded, #controlCroquisMulti .seat.expanded'); 
 for(var i=0;i<exps.length;i++){ 
 exps[i].classList.remove('expanded'); 
 exps[i].setAttribute('aria-expanded','false'); 
 } 
 } 
function toggleSeatExpand(btn){ 
 if (CONTROL_EDIT) return; 
 var status = (btn.getAttribute('data-status') || '').toLowerCase().trim(); 
 if (status !== 'ocupado') return; 
 var isExpanded = btn.classList.contains('expanded'); 
 hideSeatTooltip(); 
 if (!isExpanded){ 
 showSeatTooltipFor(btn); 
 } 
 } 
function wireStaffExpandAutoCollapse(){ 
 window.addEventListener('scroll', hideSeatTooltip, { passive:true }); 
 window.addEventListener('touchmove', hideSeatTooltip, { passive:true }); 
 window.addEventListener('resize', hideSeatTooltip, { passive:true }); 
 document.addEventListener('click', function(ev){ 
 var seat = ev.target.closest('.seat'); 
 var insideControl = ev.target.closest('#controlCroquis, #controlCroquisMulti'); 
 if (!insideControl || !seat) hideSeatTooltip(); 
 }, { passive:true }); 
 } 
/* ===== STAFF: cargar ambas plantas con numeración continua ===== */ 
async function refreshStaffMulti(){ 
 STAFF_CONTROL_MULTI = true; 
 STAFF_ACTIVE_SHEET = null; 
 STAFF_SHEETS = getFloorSheets(); 
 STAFF_SEATS_BY_SHEET = new Map(); 
 var container = document.getElementById('controlCroquisMulti'); 
 var single = document.getElementById('controlCroquis'); 
 if (container) container.innerHTML = ''; 
 if (single) single.innerHTML = ''; 
 for (var i=0;i<STAFF_SHEETS.length;i++){ 
 var f = STAFF_SHEETS[i]; 
 var resp = await API.apiGetSeats(CURRENT_TRIP.fileId, f.sheetName); 
 var rows = resp.rows ||[]; 
 var seatsMap = {}; 
 rows.forEach(function(r){ seatsMap[ normalize(r.asiento) ] = { estado: r.estado, pasajero: r.pasajero || '', ci: r.ci || '' }; }); 
 STAFF_SEATS_BY_SHEET.set(f.sheetName, seatsMap); 
 } 
 renderControlBoardMulti(); 
 attachStickyAnimation(); 
 } 
function countActiveNumbersInMap(seatsMap){ 
 var rows = getRowsToRenderFromMap(seatsMap); 
 var count = 0; 
 rows.forEach(function(row){ 
 ['A','B','C','D'].forEach(function(letter){ 
 var code = row + letter; 
 var st = computeClassForWith(seatsMap, code); 
 if(st === 'libre' || st === 'ocupado') count++; 
 }); 
 }); 
 return count; 
 } 
function renderControlBoardMulti(){ 
 var board = document.getElementById('controlBoard'); 
 var container = document.getElementById('controlCroquisMulti'); 
 var fb = document.getElementById('pdfLinkFallback'); 
 if (board) board.hidden = false; 
 if (container) container.innerHTML = ''; 
 if (fb) { fb.classList.add('hidden'); fb.innerHTML = ''; } 
 CONTROL_EDIT = false; EDIT_SRC = null; EDIT_DST = null; updateEditTags(); syncToolbarUI(); 
 var btnExp = document.getElementById('btnExportPdf'); if (btnExp) btnExp.textContent = 'Exportar PDF (todas las plantas)'; 
 var ordered = []; 
 var alta = STAFF_SHEETS.find(function(f){ return f.label.toLowerCase().indexOf('alta')>=0; }); 
 var baja = STAFF_SHEETS.find(function(f){ return f.label.toLowerCase().indexOf('baja')>=0; }); 
 if (alta) ordered.push(alta); 
 if (baja) ordered.push(baja); 
 STAFF_SHEETS.forEach(function(f){ if (!(ordered.find(function(o){ return o.sheetName === f.sheetName; }))) ordered.push(f); }); 
 var seatOffset = 1; 
 for (var i=0;i<ordered.length;i++){ 
 var f = ordered[i]; 
 var seatsMap = STAFF_SEATS_BY_SHEET.get(f.sheetName) ||{}; 
 var section = document.createElement('div'); 
 section.className = 'form'; 
 section.style.marginBottom = '12px'; 
 var title = document.createElement('h4'); 
 title.textContent = f.label; 
 title.style.margin = '0 0 8px 0'; 
 var grid = document.createElement('div'); 
 grid.className = 'grid'; 
 grid.setAttribute('aria-live','polite'); 
 section.appendChild(title); 
 section.appendChild(grid); 
 if (container) container.appendChild(section); 
 buildControlGridForSheet(grid, f.sheetName, seatsMap, seatOffset); 
 var added = countActiveNumbersInMap(seatsMap); 
 seatOffset += added; 
 } 
 if (board) board.scrollIntoView({behavior:'smooth'}); 
 } 
function buildControlGridForSheet(gridEl, sheetName, seatsMap, startNumber){ 
 gridEl.innerHTML = ''; 
 var rows = getRowsToRenderFromMap(seatsMap); 
 if(rows.length === 0){ gridEl.innerHTML = '<p class="empty">No hay asientos cargados en la hoja.</p>'; return; } 
 var seatNumber = (typeof startNumber === 'number' && startNumber > 0) ? startNumber : 1; 
 function isNum(klass){ return (klass === 'libre' || klass === 'ocupado'); } 
 function computeClassForWith(seatsMapLocal, code){ 
 var key = normalize(code); 
 if(!seatsMapLocal.hasOwnProperty(key)) return 'inexistente'; 
 var st = (seatsMapLocal[key].estado || '').toLowerCase().trim(); 
 if(st === 'ocupado') return 'ocupado'; 
 if(st === 'inhabilitado') return 'inexistente'; 
 return 'libre'; 
 } 
 rows.forEach(function(row){ 
 var rowEl = document.createElement('div'); rowEl.className = 'row'; 
 var left = document.createElement('div'); left.className = 'block'; 
 var right = document.createElement('div'); right.className = 'block'; 
 function renderSeat(letter, container){ 
 var code = row + letter; 
 var norm = normalize(code); 
 var klass= computeClassForWith(seatsMap, code); 
 var btn=document.createElement('button'); btn.type='button'; btn.className='seat ' + klass; 
 btn.setAttribute('data-code',code); 
 btn.setAttribute('data-sheet',sheetName); 
 btn.setAttribute('data-status',klass); 
 if(isNum(klass)){
 var occFull = (seatsMap[norm] && seatsMap[norm].pasajero) || ''; 
 var occName = (klass==='ocupado') ? firstName(occFull) : ''; 
 btn.innerHTML =
 '<span class="num">'+seatNumber+'</span>' +
 (occName ? '<span class="occ-name">'+occName+'</span>' : '') +
 (occFull ? '<span class="occ-full" aria-hidden="true">'+occFull+'</span>' : ''); 
 btn.setAttribute('data-num',seatNumber); 
 btn.setAttribute('aria-label','['+sheetName+'] Asiento '+code+' ('+seatNumber+') '+klass + (occName ? (' — Ocupa: '+occName) : '')); 
 btn.setAttribute('aria-expanded','false'); 
 btn.disabled = false; 
 seatNumber++; 
 }else{ 
 btn.innerHTML=' '; 
 btn.setAttribute('aria-label','['+sheetName+'] Asiento '+code+' inhabilitado/no disponible'); 
 btn.disabled=true; 
 } 
 btn.onclick = function(){ 
 if (CONTROL_EDIT) onControlSeatClick(btn); 
 else toggleSeatExpand(btn); 
 }; 
 container.appendChild(btn); 
 } 
 ['A','B'].forEach(function(l){ renderSeat(l, left); }); 
 var aisle=document.createElement('div'); aisle.className='aisle'; 
 ['C','D'].forEach(function(l){ renderSeat(l, right); }); 
 rowEl.appendChild(left); rowEl.appendChild(aisle); rowEl.appendChild(right); 
 gridEl.appendChild(rowEl); 
 }); 
 } 
/* ===== Público: numeración continua ===== */ 
async function countActiveNumbers(fileId, sheetName){ 
 try{ 
 var resp = await API.apiGetSeats(fileId, sheetName); 
 var rows = resp.rows ||[]; 
 var map = {}; 
 rows.forEach(function(r){ map[ normalize(r.asiento) ] = { estado: r.estado }; }); 
 var rowsActive = getRowsToRenderFromMap(map); 
 var count = 0; 
 rowsActive.forEach(function(row){ 
 ['A','B','C','D'].forEach(function(letter){ 
 var code = row + letter; 
 var st = computeClassForWith(map, code); 
 if(st === 'libre' || st === 'ocupado') count++; 
 }); 
 }); 
 return count; 
 }catch(e){ return 0; } 
 } 
async function computeGridOptions(){ 
 if(!CURRENT_TRIP.hasFloors) return { offset:0, hideMissing:true }; 
 var floors = getFloorSheets(); 
 var alta = floors.find(function(f){ return f.sheetName.toLowerCase() === 'asientos alta'; }); 
 var baja = floors.find(function(f){ return f.sheetName.toLowerCase() === 'asientos baja'; }); 
 if(alta && baja && CURRENT_TRIP.sheetName && CURRENT_TRIP.sheetName.toLowerCase() === baja.sheetName.toLowerCase()){
 var offset = await countActiveNumbers(CURRENT_TRIP.fileId, alta.sheetName); 
 return { offset: offset, hideMissing:true }; 
 } 
 return { offset:0, hideMissing:true }; 
 } 
function computeClassForWith(seatsMap, code){ 
 var key = normalize(code); 
 if(!seatsMap.hasOwnProperty(key)) return 'inexistente'; 
 var st = (seatsMap[key].estado || '').toLowerCase().trim(); 
 if(st === 'ocupado') return 'ocupado'; 
 if(st === 'inhabilitado') return 'inexistente'; 
 return 'libre'; 
 } 
/* ===== Vistas principales ===== */ 
async function chooseFloor(sheetName){ 
 CURRENT_TRIP.sheetName = sheetName; 
 updateTripTags(); 
 var lbl = getFloorLabelFromSheetName(sheetName); 
 if (CONTROL_AUTH) { 
 showView('view-control'); 
 showLoading('Cargando ocupación…'); 
 if (CURRENT_TRIP.hasFloors) { 
 await refreshStaffMulti(); 
 } else { 
 await refreshSeats(null, function(){} , null); 
 renderControlBoard(); 
 } 
 hideLoading(); 
 setHash(['Staff', CURRENT_TRIP.name]); 
 } else { 
 if (CURRENT_TRIP.hasFloors) { 
 showView('view-select'); 
 showLoading('Cargando asientos…'); 
 var opts = await computeGridOptions(); 
 refreshSeats('grid-select', function(){ hideLoading(); }, opts); 
 setHash(['Selección de asientos', CURRENT_TRIP.name, lbl]); 
 } else { 
 goHome(); 
 setHash([CURRENT_TRIP.name]); 
 } 
 } 
 } 

function updateTripTags() {
  var tripTitleHome  = document.getElementById('tripTitleHome');
  var tripTitleFloor = document.getElementById('tripTitleFloor');

  var name = CURRENT_TRIP.name || '—';

  // Vista convencional
  if (tripTitleHome && !CURRENT_TRIP.hasFloors) {
    tripTitleHome.textContent = name;
    tripTitleHome.dataset.type = 'Convencional';
  }

  // Vista doble piso
  if (tripTitleFloor && CURRENT_TRIP.hasFloors) {
    tripTitleFloor.textContent = name;
    tripTitleFloor.dataset.type = 'Doble piso';
  }

  syncStaffBadge();
} 
async function goSelect(){ 
 if(!CURRENT_TRIP.fileId || !CURRENT_TRIP.sheetName){ setHash(['Inicio']); showView('view-choose'); return; } 
 showView('view-select'); 
 showLoading('Cargando asientos…'); 
 var opts = await computeGridOptions(); 
 refreshSeats('grid-select', function(){ hideLoading(); }, opts); 
 if (CURRENT_TRIP.hasFloors) setHash(['Selección de asientos', CURRENT_TRIP.name, getFloorLabelFromSheetName(CURRENT_TRIP.sheetName)]); 
 else setHash(['Selección de asientos', CURRENT_TRIP.name]); 
 } 
function goFind(){ if(!CURRENT_TRIP.fileId){ setHash(['Inicio']); showView('view-choose'); return; } showView('view-find'); clearFindView(); clearFindViewMulti(); } 
function goControl(){ openStaffLogin(); } 
function goToControlBoard(){ 
 if(!CONTROL_AUTH){ openStaffLogin(); return; } 
 showView('view-control'); 
 showLoading('Cargando ocupación…'); 
 setHash(['Staff', CURRENT_TRIP.name || '—']); 
 if (CURRENT_TRIP.hasFloors) { 
 refreshStaffMulti().then(function(){ hideLoading(); }); 
 } else { 
 refreshSeats(null, function(){ renderControlBoard(); hideLoading(); }); 
 } 
 } 
/* ====== Datos (una hoja) ====== */ 
async function refreshSeats(targetId, onDone, gridOptions){ 
 var gridEl = targetId ? document.getElementById(targetId) : null; 
 if(gridEl) gridEl.setAttribute('aria-busy','true'); 
 try{ 
 var resp = await API.apiGetSeats(CURRENT_TRIP.fileId, CURRENT_TRIP.sheetName); 
 var rows = resp.rows ||[]; 
 SEATS = {}; 
 rows.forEach(function(r){ SEATS[ normalize(r.asiento) ] = { estado: r.estado, pasajero: r.pasajero || '', ci: r.ci || '' }; }); 
 if(gridEl){ buildGrid(targetId, gridOptions); } 
 }catch(err){ 
 console.error('refreshSeats error:', err); 
 toast('Error al cargar asientos: ' + (err && err.message ? err.message : 'desconocido')); 
 if(gridEl){ buildGrid(targetId, gridOptions); } 
 }finally{ 
 if (typeof onDone === 'function') { try { onDone(); } catch(e){} } 
 } 
 } 
async function refreshSeatsWithSpinner(targetId, onDone, gridOptions){ 
 showLoading('Actualizando asientos…'); 
 await refreshSeats(targetId, function(){ hideLoading(); if (typeof onDone === 'function') onDone(); }, gridOptions); 
 } 
function getRowsToRenderFromMap(seatsMap){ 
 var rows = new Set(); 
 Object.keys(seatsMap ||{}).forEach(function(code){ 
 var m = code.match(/^(\d+)[A-Z]$/); 
 if(!m) return; 
 var row = parseInt(m[1], 10); 
 var estado = (seatsMap[code].estado || '').toLowerCase().trim(); 
 if(estado !== 'inhabilitado') rows.add(row); 
 }); 
 return Array.from(rows).sort(function(a,b){ return a-b; }); 
 } 
function getRowsToRender(){ return getRowsToRenderFromMap(SEATS); } 
function computeClassFor(code){ 
 var key = normalize(code); 
 var s = SEATS[key]; 
 if(!s) return 'inexistente'; 
 var st = (s.estado || '').toLowerCase().trim(); 
 if(st === 'ocupado') return 'ocupado'; 
 if(st === 'inhabilitado') return 'inexistente'; 
 return 'libre'; 
 } 
function getSeatState(code){ 
 var key = normalize(code); 
 var s = SEATS[key]; 
 if(!s) return 'inexistente'; 
 var st = (s.estado || '').toLowerCase().trim(); 
 if(st === 'ocupado') return 'ocupado'; 
 if(st === 'inhabilitado') return 'inhabilitado'; 
 return 'libre'; 
 } 
/* ====== Croquis (público) ====== */ 
function buildGrid(targetId, options){ 
 options = options ||{}; 
 var offset = options.offset || 0; 
 var hideMissing = (typeof options.hideMissing==='undefined') ? true : !!options.hideMissing; 
 var grid = document.getElementById(targetId || 'grid-select'); if(!grid) return; 
 grid.innerHTML = ''; grid.removeAttribute('aria-busy'); selected = new Set(); NUM_LABELS = new Map(); 
 // NUEVO: resetear y sincronizar contador de seleccionados 
 if (typeof syncSelectedCounter === 'function') { try { syncSelectedCounter(); } catch(e){} } 
 var rows = getRowsToRender(); 
 if(rows.length === 0){ grid.innerHTML = '<p class="empty">No hay asientos cargados en la hoja.</p>'; return; } 
 var seatNumber = 1 + offset; 
 rows.forEach(function(row){ 
 var rowEl = document.createElement('div'); rowEl.className = 'row'; 
 var left = document.createElement('div'); left.className = 'block'; 
 var right = document.createElement('div'); right.className = 'block'; 
 function renderSeat(letter, container){ 
 var code = row + letter; 
 var state = getSeatState(code); 
 var isNum = (state === 'libre' || state === 'ocupado'); 
 var norm = normalize(code); 
 if(isNum){ 
 var btn = document.createElement('button'); btn.type='button'; btn.className = 'seat ' + state; 
 btn.textContent = seatNumber; 
 btn.setAttribute('data-code', code); 
 btn.setAttribute('aria-label', 'Asiento ' + code + ' ('+seatNumber+') ' + state); 
 NUM_LABELS.set(norm, seatNumber); seatNumber++; 
 if(targetId === 'grid-select'){ 
 if(state === 'libre'){ btn.onclick = function(){ toggleSeat(code, btn); }; } 
 else { btn.disabled = true; } 
 } else { btn.disabled = true; } 
 if(HIGHLIGHT_CODES.has(norm)){ btn.classList.add('mine'); } 
 container.appendChild(btn); 
 return; 
 } 
 if(state === 'inhabilitado'){ 
 var btn2 = document.createElement('button'); btn2.type='button'; btn2.className = 'seat inhabilitado'; 
 btn2.innerHTML = ' '; 
 btn2.setAttribute('aria-label', 'Asiento ' + code + ' inhabilitado/no disponible'); 
 btn2.disabled = true; 
 container.appendChild(btn2); 
 return; 
 } 
 if(state === 'inexistente' && hideMissing){ 
 var ph = document.createElement('div'); ph.className = 'seat-placeholder'; ph.setAttribute('aria-hidden','true'); 
 container.appendChild(ph); 
 return; 
 } 
 var btn3 = document.createElement('button'); btn3.type='button'; btn3.className = 'seat inexistente'; 
 btn3.innerHTML = ' '; 
 btn3.setAttribute('aria-label', 'Asiento ' + code + ' inexistente/no disponible'); 
 btn3.disabled = true; 
 container.appendChild(btn3); 
 } 
 ['A','B'].forEach(function(l){ renderSeat(l, left); }); 
 var aisle = document.createElement('div'); aisle.className = 'aisle'; 
 ['C','D'].forEach(function(l){ renderSeat(l, right); }); 
 rowEl.appendChild(left); rowEl.appendChild(aisle); rowEl.appendChild(right); 
 grid.appendChild(rowEl); 
 }); 
 if(HIGHLIGHT_CODES.size){ 
 var first = grid.querySelector('.seat.mine'); 
 if(first) first.scrollIntoView({behavior:'smooth', block:'center'}); 
 } 
 } 
/* ===== Selección (público) ===== */ 
function cancelSingle(){ var f = document.getElementById('detailsSingle'); if(f) f.classList.add('hidden'); } 
async function confirmSingle(){ 
 if(BUSY) return; 
 var name = (document.getElementById('nombreSingle')||{}).value || ''; 
 var ci = (document.getElementById('ciSingle')||{}).value || ''; 
 name = name.trim(); ci = ci.trim(); 
 if(!name || !ci){ toast('Completá nombre y CI'); return; } 
 if(selected.size !== 1){ toast('Seleccioná exactamente un asiento'); return; } 
 var only = Array.from(selected)[0]; var onlyNorm = normalize(only); 
 var pairs = [{ asiento: onlyNorm, pasajero: name, ci: ci }]; 
 BUSY = true; showLoading('Reservando…'); 
 try{ 
 await API.apiReserve(CURRENT_TRIP.fileId, CURRENT_TRIP.sheetName, pairs); 
 showConfirmedModal(pairs); 
 var f = document.getElementById('detailsSingle'); if(f) f.classList.add('hidden'); 
 (document.getElementById('nombreSingle')||{}).value = ''; 
 (document.getElementById('ciSingle')||{}).value = ''; 
 await refreshSelectGrid(); 
 }catch(err){ toast('No se pudo reservar'); } 
 finally{ hideLoading(); BUSY = false; } 
} 
  var m = document.getElementById('createTripModal');
  if(!m) return;
  // Defaults
  try{ document.getElementById('newTripName').value=''; }catch(e){}
  try{ document.getElementById('tripTypeSingle').checked = true; }catch(e){}
  var btn = document.getElementById('createTripConfirmBtn');
  if(btn) btn.onclick = confirmCreateTrip;
  m.classList.add('show');
  m.setAttribute('aria-hidden','false');
  try{ document.getElementById('newTripName').focus(); }catch(e){}
}
function closeCreateTripModal(){
  var m = document.getElementById('createTripModal');
  if(!m) return;
  m.classList.remove('show');
  m.setAttribute('aria-hidden','true');
}
async function confirmCreateTrip(){
 if(BUSY) return;

 var name = (document.getElementById('newTripName') || {}).value || '';
 name = name.trim();

 var type = (document.getElementById('tripTypeDouble') || {}).checked
   ? 'double'
   : 'single';

 // NUEVO: fecha y hora
 var startAtInput = document.getElementById('newTripStartAt');
 var startAt = startAtInput ? startAtInput.value : '';

 if(!name){ toast('Ingresá el nombre del viaje'); return; }
 if(!startAt){ toast('Ingresá la fecha y hora del viaje'); return; }
 if(!CONTROL_AUTH || !isAdmin()){ toast('Solo administradores'); return; }

 closeCreateTripModal();
 showLoading('Creando viaje…');
 BUSY = true;

 try{
   var resp = await API.apiCreateTrip(name, type, startAt);
   if(resp && (resp.ok || resp.fileId || resp.trip)){
     clearCache('trips');
     await loadTrips();
     toast('Viaje creado');
   }else{
     toast((resp && resp.message) ? resp.message : 'No se pudo crear el viaje');
   }
 }catch(e){
   toast('Error al crear el viaje');
 }finally{
   BUSY = false; hideLoading();
 }
}

async function promptArchiveTrip(tr) {
  if (!CONTROL_AUTH || !isAdmin()) { toast('Solo administradores'); return; }
  const name = (tr && tr.name) ? tr.name : '(sin nombre)';
  const ok = window.confirm(`¿Eliminar "${name}"? El viaje dejará de mostrarse en la web y se moverá a la carpeta interna.`);
  if (!ok) return;

  showLoading('Eliminando viaje…');
  try {
    const resp = await API.apiArchiveTrip(tr.fileId);
    clearCache('trips');
    await loadTrips();
    toast((resp && resp.message) ? resp.message : 'Viaje eliminado');
  } catch (e) {
    toast('No se pudo eliminar el viaje' + (e && e.message ? (': ' + e.message) : ''));
  } finally {
    hideLoading();
  }
}

window.openCreateTripModal = openCreateTripModal;
window.closeCreateTripModal = closeCreateTripModal;
/* ===== Inicio ===== */ 
(function(){ 
 function start(){ 
  document.body.classList.remove('app-ready');  
showLoading('Cargando…');
 // Quitar nodos de texto sueltos dentro del chip (si existieran)
 var chip = document.querySelector('.brand-chip'); 
 if (chip){ 
 var childNodes = chip.childNodes; 
 for (var i = childNodes.length - 1; i >= 0; i-- ) { 
 var n = childNodes[i]; 
 if (n && n.nodeType === Node.TEXT_NODE) chip.removeChild(n); 
 } 
 } 
 // Logo + skeleton + admin menu 
 var img = document.getElementById('heroLogo'); var skel = document.getElementById('logoSkeleton'); 
 if (img){ 
 img.addEventListener('click', function(ev){ ev.stopPropagation(); toggleAdminMenu(); }); 
 document.addEventListener('click', function(ev){ 
 var menu = document.getElementById('adminMenu'); 
 if (!menu) return; 
 if (!chip || !chip.contains(ev.target)) { menu.classList.add('hidden'); } 
 }, { passive:true }); 
 } 
// Cargar logo desde backend con cache local (TTL = 7 días)
(async function () { 
 var CACHE_KEY = "logo_v1"; // cambia a v2 si necesitás invalidar todas las cachés 
 var TTL = 7 * 24 * 60 * 60 * 1000; // 7 días en ms 
 function safeGetLogoCache() { 
 try { return getCache(CACHE_KEY); } catch(e){ return null; } 
 } 
 function safeSetLogoCache(val, ttl) { 
 try { setCache(CACHE_KEY, val, ttl); } catch(e){} 
 } 
 function safeClearLogoCache() { 
 try { clearCache(CACHE_KEY); } catch(e){} 
 } 
 var cached = safeGetLogoCache(); 
 function applyImgSrc(srcFromAny){ 
 if (!srcFromAny || !img) return; 
 img.onload = function(){ 
 img.classList.add('ready'); 
 if (skel) skel.style.display = 'none'; 
 }; 
 img.onerror = function(){ 
 // Recurso cacheado/servido falló: limpiar e intentar desde red si veníamos del cache 
 safeClearLogoCache(); 
 if (skel) skel.style.display = 'block'; 
 if (!cached || (cached && cached.src === srcFromAny)) { 
 loadFromNetwork(true); 
 } 
 }; 
 img.src = srcFromAny; 
 } 
 if (cached && cached.src){ 
 // 1) Intento desde caché (instantáneo)
 applyImgSrc(cached.src); 
 } else { 
 // 2) No hay caché → ir a red
 loadFromNetwork(false); 
 } 
 async function loadFromNetwork(retryingAfterCacheError){ 
 try { 
 var payload = await API.apiGetLogo(); 
 var src = ''; 
 if (payload && payload.dataUrl) src = payload.dataUrl; 
 else if (payload && payload.publicUrl) src = payload.publicUrl; 
 if (src){ 
 applyImgSrc(src); 
 // Guardar en cache sólo si obtuvimos un src válido
 safeSetLogoCache({ src: src }, TTL); 
 } else { 
 if (skel) skel.style.display = 'block'; 
 } 
 } catch (e) { 
 // Error en API: mostrar skeleton si no veníamos de un cache exitoso
 if (!retryingAfterCacheError && skel) skel.style.display = 'block'; 
 } 
 } 
})(); 
 // Entradas de CI 
 var ciP = document.getElementById('ciSingle'); if (ciP) ciP.addEventListener('input', function(e){ onlyDigits(e.target); }); 
 var ciS = document.getElementById('ciSearch'); if (ciS) ciS.addEventListener('input', function(e){ onlyDigits(e.target); }); 
 wireAdminMenuButtons(); 
 wireStaffExpandAutoCollapse(); 
 // Cargar viajes 
 loadTrips(); 
 // Router hash 
  window.addEventListener('hashchange', function(){
    if (!ROUTER_DRIVING) routeTo(location.hash);
  }, { passive:true });

(async function initialRoute(){
  await routeTo(location.hash);
  document.body.classList.add('app-ready');
  BOOTSTRAPING = false; // ✅ fin del arranque
  hideLoading();        // ahora sí se puede ocultar
})();
 // Sesión previa 
 if (isStaffSession()) { 
 CONTROL_AUTH = true; 
 updateAdminMenu(); 
 syncStaffBadge(); 
 syncControlFormVisibility();
 syncAddTripVisibility();
 } else { 
 updateAdminMenu(); 
 syncStaffBadge(); 
 syncControlFormVisibility();
 syncAddTripVisibility();
 } 
 // Atajo: botón Agregar viaje
 var btnAdd = document.getElementById('btnAddTrip');
 if(btnAdd) btnAdd.addEventListener('click', openCreateTripModal);
 } 
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); 
 else start(); 
})(); 
  showView('view-reserve');
  renderReservePage();
}

function renderReservePage(){
  const body = document.getElementById('reservePageBody');
  const title = document.getElementById('reservePageTitle');
  body.innerHTML = '';
  const seats = Array.from(selected);
  if (seats.length === 1){
    title.textContent = 'Confirmar asiento';
    const norm = normalize(seats[0]);
    const num = NUM_LABELS.get(norm) || norm;
    body.innerHTML = `<div class="form">
      <h4>Asiento ${num}</h4>
      <div class="form-grid two">
        <input id="singleName" placeholder="Nombre y Apellido">
        <input id="singleCI" placeholder="CI" inputmode="numeric">
      </div>
    </div>`;
  } else {
    title.textContent = 'Asignar datos a los asientos';
    const list = document.createElement('div'); list.className='assign-list';
    seats.forEach(s=>{
      const n=normalize(s); const num=NUM_LABELS.get(n)||n;
      list.innerHTML += `<div class="assign-row" data-code="${n}">
        <div class="assign-title">Asiento ${num}</div>
        <div class="assign-grid">
          <input class="assign-name" placeholder="Nombre">
          <input class="assign-ci" placeholder="CI" inputmode="numeric">
        </div>
      </div>`;
    });
    body.appendChild(list);
  }
}

async function confirmReservationPage(){
  if (BUSY) return;
  let pairs=[];
  if (selected.size===1){
    pairs.push({asiento: normalize([...selected][0]), pasajero: document.getElementById('singleName').value.trim(), ci: document.getElementById('singleCI').value.trim()});
  } else {
    document.querySelectorAll('#reservePageBody .assign-row').forEach(r=>{
      pairs.push({asiento:r.dataset.code, pasajero:r.querySelector('.assign-name').value.trim(), ci:r.querySelector('.assign-ci').value.trim()});
    });
  }
  BUSY=true; showLoading('Reservando…');
  try{
    await API.apiReserve(CURRENT_TRIP.fileId, CURRENT_TRIP.sheetName, pairs);
    renderConfirmedPage(pairs);
    showView('view-confirmed');
    await refreshSelectGrid();
  }catch(e){ toast('No se pudo reservar'); }
  finally{ BUSY=false; hideLoading(); }
}

function renderConfirmedPage(pairs){
  const body=document.getElementById('confirmedPageBody'); body.innerHTML='';
  pairs.forEach(p=>{
    const num=NUM_LABELS.get(p.asiento)||p.asiento;
    body.innerHTML += `<div class="assign-row"><div class="assign-title">Asiento ${num}</div><div>${p.pasajero}</div></div>`;
  });
}
// 🔁 Alias para no romper botones existentes
function startSelectionModal() {
  startSelectionPage();
}
// 🔁 Volver desde la pantalla de reserva al croquis
function backToSelect() {
  showView('view-select');
}
