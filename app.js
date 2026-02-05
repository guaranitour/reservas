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
 async function apiCreateTrip(name, type){
  const res = await fetch(getUrl('createTrip'), postOptions({ idToken: ID_TOKEN, name, type }));
  if(!res.ok) throw new Error('POST createTrip: ' + res.status);
  return parseResponse(res);
 }
 
// === NUEVO: archivar (eliminar) viaje - mover a carpeta interna
async function apiArchiveTrip(fileId) {
  const res = await fetch(getUrl('archiveTrip'), postOptions({ idToken: ID_TOKEN, fileId }));
  if (!res.ok) throw new Error('POST archiveTrip: ' + res.status);
  return parseResponse(res);
}

window.API = { apiGetTrips, apiGetSeats, apiGetSeatsByCi, apiGetLogo, apiExportPdf, apiReserve, apiMove, apiFree, apiLoginWithToken, apiCreateTrip }; 
 /* ===== Estado global ===== */ 
 var SEATS = {}; var selected = new Set(); var NUM_LABELS = new Map(); 
 var HIGHLIGHT_CODES = new Set(); var LAST_FOUND_CODES = []; 
 var CONTROL_AUTH = false; var CONTROL_EDIT = false; var EDIT_SRC = null; var EDIT_DST = null; 
 var BUSY = false; 
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
 function toast(msg){ var bar = document.getElementById('snackbar'); if(!bar) return; bar.textContent = msg; bar.classList.add('show'); setTimeout(function(){ bar.classList.remove('show'); }, 2800); } 
 function showLoading(msg){ var ov = document.getElementById('overlay'); if(!ov) return; ov.querySelector('.loader-text').textContent = msg || 'Cargando…'; ov.setAttribute('aria-hidden','false'); ov.classList.add('show'); } 
 function hideLoading(){ var ov = document.getElementById('overlay'); if(!ov) return; ov.classList.remove('show'); ov.setAttribute('aria-hidden','true'); } 
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
 if(!trips.length){ list.innerHTML = '<p class="muted">No se encontraron viajes en la carpeta.</p>'; } 
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
function updateTripTags(){ 
 var tagTrip = document.getElementById('tagTrip'); 
 var tagTripFloor = document.getElementById('tagTripFloor'); 
 var text = 'Viaje: ' + (CURRENT_TRIP.name || '—'); 
 if (tagTrip) tagTrip.textContent = text; 
 if (tagTripFloor) tagTripFloor.textContent = text; 
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
function updateAssignVisibility(){ if(selected.size > 1){ document.getElementById('view-assign').classList.remove('hidden'); } else { document.getElementById('view-assign').classList.add('hidden'); } } 
function backToSelect(){ document.getElementById('view-assign').classList.add('hidden'); } 
function toggleSeat(code, el){ 
 var key = normalize(code); 
 var isSel = selected.has(key); 
 if(isSel){ selected.delete(key); el.classList.remove('seleccionado'); } 
 else { selected.add(key); el.classList.add('seleccionado'); } 
 updateAssignVisibility(); 
 // NUEVO: actualizar badge contador 
 if (typeof syncSelectedCounter === 'function') { try { syncSelectedCounter(); } catch(e){} } 
 } 
async function startSelection(){ 
 if(BUSY) return; 
 if(selected.size === 0){ toast('Elegí al menos un asiento'); return; } 
 if(selected.size === 1){ 
 var form = document.getElementById('detailsSingle'); 
 if(form){ form.classList.remove('hidden'); form.scrollIntoView({behavior:'smooth'}); } 
 var nameInput = document.getElementById('nombreSingle'); if(nameInput) try{ nameInput.focus(); }catch(e){} 
 return; 
 } 
 var assign = document.getElementById('assignList'); assign.innerHTML = ''; 
 var codes = Array.from(selected); 
 for(var i=0;i<codes.length;i++){ 
 var codeNorm = normalize(codes[i]); var num = NUM_LABELS.get(codeNorm) || ''; 
 var row = document.createElement('div'); row.className = 'assign-row'; row.setAttribute('data-code', codeNorm); 
 var title = document.createElement('div'); title.className = 'assign-title'; title.textContent = 'Asiento ' + (num || codeNorm); 
 var grid = document.createElement('div'); grid.className = 'assign-grid'; 
 var nameWrap = document.createElement('label'); nameWrap.className = 'field'; 
 var nameLabel = document.createElement('span'); nameLabel.className = 'field-label'; nameLabel.textContent = 'Nombre y Apellido'; 
 var nameInput = document.createElement('input'); nameInput.type='text'; nameInput.placeholder='Luanita Espada'; nameInput.required=true; nameInput.className='assign-name'; nameInput.autocapitalize='words'; nameInput.autocomplete='name'; 
 var ciWrap = document.createElement('label'); ciWrap.className = 'field'; 
 var ciLabel = document.createElement('span'); ciLabel.className = 'field-label'; ciLabel.textContent = 'Número de documento'; 
 var ciInput = document.createElement('input'); ciInput.type='text'; ciInput.placeholder='Ej.: 12345678'; ciInput.required=true; ciInput.className='assign-ci'; ciInput.inputMode='numeric'; ciInput.pattern='[0-9]*'; 
 ciInput.addEventListener('input', function(e){ onlyDigits(e.target); }); 
 nameWrap.appendChild(nameLabel); nameWrap.appendChild(nameInput); 
 ciWrap.appendChild(ciLabel); ciWrap.appendChild(ciInput); 
 grid.appendChild(nameWrap); grid.appendChild(ciWrap); 
 row.appendChild(title); row.appendChild(grid); 
 assign.appendChild(row); 
 } 
 document.getElementById('view-assign').classList.remove('hidden'); 
 document.getElementById('view-assign').scrollIntoView({behavior:'smooth'}); 
} 
async function confirmReservation(){ 
 if(BUSY) return; 
 var inputs = document.querySelectorAll('#assignList .assign-row'); 
 var pairs = []; 
 for(var i=0;i<inputs.length;i++){ 
 var row = inputs[i]; 
 var codeNorm = row.getAttribute('data-code'); 
 var pasajero = row.querySelector('.assign-name').value.trim(); 
 var ci = row.querySelector('.assign-ci').value.trim(); 
 if(!pasajero || !ci){ toast('Faltan datos en ' + codeNorm); return; } 
 pairs.push({ asiento: codeNorm, pasajero: pasajero, ci: ci }); 
 } 
 BUSY = true; showLoading('Reservando…'); 
 try{ 
 await API.apiReserve(CURRENT_TRIP.fileId, CURRENT_TRIP.sheetName, pairs); 
 showConfirmedModal(pairs); 
 document.getElementById('view-assign').classList.add('hidden'); 
 await refreshSelectGrid(); 
 }catch(err){ toast('No se pudo reservar'); } 
 finally{ hideLoading(); BUSY = false; } 
 } 
function showReserveFeedbackDetailed(pairs){ 
 var panel = document.getElementById('reserveFeedback'); var nums = document.getElementById('reserveNums'); nums.innerHTML = ''; 
 (pairs ||[]).forEach(function(p){ 
 var norm = normalize(p.asiento); 
 var num = NUM_LABELS.get(norm); 
 var pill = document.createElement('span'); pill.className = 'pill'; 
 pill.textContent = ((typeof num !== 'undefined') ? num : norm) + ' — ' + p.pasajero + ' (' + p.ci + ')'; 
 nums.appendChild(pill); 
 }); 
 panel.classList.remove('hidden'); panel.scrollIntoView({behavior:'smooth'}); 
 } 
/* ====== Mirá tu asiento (público) ====== */ 
async function findByCI(){ 
 if(CURRENT_TRIP.hasFloors && !CURRENT_TRIP.sheetName){ 
 await findByCIAcrossFloors(); 
 return; 
 } 
 if(!CURRENT_TRIP.fileId || !CURRENT_TRIP.sheetName){ setHash(['Inicio']); showView('view-choose'); return; } 
 var ci = document.getElementById('ciSearch').value.trim(); 
 if(!ci){ toast('Ingresá tu CI'); return; } 
 showLoading('Buscando…'); 
 try{ 
 var respSeats = await API.apiGetSeatsByCi(CURRENT_TRIP.fileId, CURRENT_TRIP.sheetName, ci); 
 var rawCodes = (respSeats.seats ||[]).map(function(s){ return normalize(s); }); 
 LAST_FOUND_CODES = Array.from(new Set(rawCodes)); 
 var respRows = await API.apiGetSeats(CURRENT_TRIP.fileId, CURRENT_TRIP.sheetName); 
 var rows = respRows.rows ||[]; 
 SEATS = {}; 
 rows.forEach(function(r){ SEATS[ normalize(r.asiento) ] = { estado: r.estado, pasajero: r.pasajero || '', ci: r.ci || '' }; }); 
 var nums = computeNumbersForCodes(LAST_FOUND_CODES); 
 renderFindFeedback(nums); 
 HIGHLIGHT_CODES = new Set(LAST_FOUND_CODES); 
 }catch(err){ toast('Error al buscar por CI'); } 
 finally{ hideLoading(); } 
 } 
function computeNumbersForCodes(codes){ 
 NUM_LABELS = new Map(); 
 var rows = getRowsToRender(); 
 var seatNumber = 1; 
 function isNum(klass){ return (klass === 'libre' || klass === 'ocupado'); } 
 rows.forEach(function(row){ 
 ['A','B','C','D'].forEach(function(letter){ 
 var code = row + letter; 
 var klass = computeClassFor(code); 
 var norm = normalize(code); 
 if(isNum(klass)){ NUM_LABELS.set(norm, seatNumber); seatNumber++; } 
 }); 
 }); 
 return codes.map(function(c){ return NUM_LABELS.get(c); }).filter(function(n){ return typeof n !== 'undefined'; }); 
 } 
function renderFindFeedback(nums){ 
 var panel = document.getElementById('findFeedback'); 
 var list = document.getElementById('findNums'); 
 var btn = document.getElementById('btnShowCroquis'); 
 list.innerHTML = ''; 
 if(nums.length){ 
 nums.forEach(function(n){ var pill = document.createElement('span'); pill.className='pill'; pill.textContent = String(n); list.appendChild(pill); }); 
 panel.classList.remove('hidden'); btn.disabled = false; panel.scrollIntoView({behavior:'smooth'}); 
 }else{ 
 panel.classList.remove('hidden'); list.innerHTML = '<span class="pill">Sin asientos</span>'; btn.disabled = true; 
 } 
 } 
function showCroquisForCI(){ 
 showLoading('Cargando croquis…'); 
 refreshSeats('grid-find', function(){ 
 hideLoading(); 
 var firstMarked = document.getElementById('grid-find').querySelector('.seat.mine'); 
 if (firstMarked) firstMarked.scrollIntoView({ behavior:'smooth', block:'center' }); 
 else document.getElementById('grid-find').scrollIntoView({ behavior:'smooth', block:'start' }); 
 toast('Resaltados: ' + HIGHLIGHT_CODES.size); 
 }); 
 } 
function clearFindView(){ 
 document.getElementById('findFeedback').classList.add('hidden'); 
 document.getElementById('findNums').innerHTML = ''; 
 document.getElementById('grid-find').innerHTML = ''; 
 HIGHLIGHT_CODES = new Set(); 
 LAST_FOUND_CODES = []; 
 } 
/* ====== BÚSQUEDA EN AMBAS PLANTAS ====== */ 
var MULTI_SHEETS = []; 
var SEATS_BY_SHEET = new Map(); 
var HIGHLIGHT_BY_SHEET = new Map(); 
var NUMS_BY_SHEET = new Map(); 
async function findByCIAcrossFloors(){ 
 if(!CURRENT_TRIP.fileId){ setHash(['Inicio']); showView('view-choose'); return; } 
 var ci = document.getElementById('ciSearch').value.trim(); 
 if(!ci){ toast('Ingresá tu CI'); return; } 
 showLoading('Buscando en ambas plantas…'); 
 try{ 
 MULTI_SHEETS = getFloorSheets(); 
 SEATS_BY_SHEET = new Map(); 
 HIGHLIGHT_BY_SHEET = new Map(); 
 NUMS_BY_SHEET = new Map(); 
 for(var i=0;i<MULTI_SHEETS.length;i++){ 
 var f = MULTI_SHEETS[i]; 
 var respSeats = await API.apiGetSeatsByCi(CURRENT_TRIP.fileId, f.sheetName, ci); 
 var respRows = await API.apiGetSeats(CURRENT_TRIP.fileId, f.sheetName); 
 var codesRaw = (respSeats.seats ||[]).map(function(s){ return normalize(s); }); 
 var codes = Array.from(new Set(codesRaw)); 
 var rows = respRows.rows ||[]; 
 var seatsMap = {}; 
 rows.forEach(function(r){ seatsMap[ normalize(r.asiento) ] = { estado: r.estado, pasajero: r.pasajero || '', ci: r.ci || '' }; }); 
 SEATS_BY_SHEET.set(f.sheetName, seatsMap); 
 HIGHLIGHT_BY_SHEET.set(f.sheetName, new Set(codes)); 
 var nums = computeNumbersForCodesWith(seatsMap, codes); 
 NUMS_BY_SHEET.set(f.sheetName, nums); 
 } 
 renderFindFeedbackMulti(); 
 }catch(err){ 
 toast('Error al buscar en ambas plantas'); 
 }finally{ 
 hideLoading(); 
 } 
 } 
function computeNumbersForCodesWith(seatsMap, codes){ 
 var rows = getRowsToRenderFromMap(seatsMap); 
 var seatNumber = 1; 
 var labels = new Map(); 
 function isNum(klass){ return (klass === 'libre' || klass === 'ocupado'); } 
 rows.forEach(function(row){ 
 ['A','B','C','D'].forEach(function(letter){ 
 var code = row + letter; 
 var klass = computeClassForWith(seatsMap, code); 
 var norm = normalize(code); 
 if(isNum(klass)){ labels.set(norm, seatNumber); seatNumber++; } 
 }); 
 }); 
 return codes.map(function(c){ return labels.get(c); }).filter(function(n){ return typeof n !== 'undefined'; }); 
 } 
function renderFindFeedbackMulti(){ 
 clearFindView(); 
 var panel = document.getElementById('multiFeedback'); 
 var wrap = document.getElementById('multiNums'); 
 var btn = document.getElementById('btnShowCroquisMulti'); 
 wrap.innerHTML = ''; 
 var totalResults = 0; 
 MULTI_SHEETS.forEach(function(f){ 
 var nums = NUMS_BY_SHEET.get(f.sheetName) ||[]; 
 totalResults += nums.length; 
 var section = document.createElement('div'); 
 section.className = 'form'; 
 section.style.marginBottom = '12px'; 
 var title = document.createElement('h4'); 
 title.textContent = f.label; 
 title.style.margin = '0 0 8px 0'; 
 var list = document.createElement('div'); 
 list.className = 'nums'; 
 if(nums.length){ 
 nums.forEach(function(n){ 
 var pill = document.createElement('span'); pill.className='pill'; 
 pill.textContent = String(n); 
 list.appendChild(pill); 
 }); 
 }else{ 
 var pill2 = document.createElement('span'); pill2.className='pill'; 
 pill2.textContent = 'Sin asientos'; 
 list.appendChild(pill2); 
 } 
 section.appendChild(title); 
 section.appendChild(list); 
 wrap.appendChild(section); 
 }); 
 panel.classList.remove('hidden'); 
 btn.disabled = (totalResults === 0); 
 panel.scrollIntoView({behavior:'smooth'}); 
 } 
async function showCroquisForCIMulti(){ 
 showLoading('Cargando croquis…'); 
 var container = document.getElementById('multiCroquis'); 
 container.innerHTML = ''; 
 var floorsWithResults = MULTI_SHEETS.filter(function(f){ 
 var found = NUMS_BY_SHEET.get(f.sheetName) ||[]; 
 return found.length > 0; 
 }); 
 if (!floorsWithResults.length) { 
 hideLoading(); 
 toast('Tu CI no tiene asientos en ninguna planta de este viaje.'); 
 return; 
 } 
 for(var i=0;i<floorsWithResults.length;i++){ 
 var f = floorsWithResults[i]; 
 var seatsMap = SEATS_BY_SHEET.get(f.sheetName) ||{}; 
 var highlights = HIGHLIGHT_BY_SHEET.get(f.sheetName) || new Set(); 
 var form = document.createElement('div'); 
 form.className = 'form'; 
 form.style.marginBottom = '12px'; 
 var title = document.createElement('h4'); 
 title.textContent = f.label; 
 title.style.margin = '0 0 8px 0'; 
 var gridId = 'grid-find-' + normalize(f.label).toLowerCase(); 
 var grid = document.createElement('div'); 
 grid.id = gridId; 
 grid.className = 'grid'; 
 grid.setAttribute('aria-live','polite'); 
 form.appendChild(title); 
 form.appendChild(grid); 
 container.appendChild(form); 
 buildGridCustom(gridId, seatsMap, highlights); 
 } 
 hideLoading(); 
 var firstMarked = container.querySelector('.seat.mine'); 
 if (firstMarked) { firstMarked.scrollIntoView({ behavior:'smooth', block:'center' }); } 
 else { container.scrollIntoView({ behavior:'smooth', block:'start' }); } 
 } 
function buildGridCustom(targetId, seatsMap, highlightSet){ 
 var grid = document.getElementById(targetId); if(!grid) return; 
 grid.innerHTML = ''; 
 var rows = getRowsToRenderFromMap(seatsMap); 
 if(rows.length === 0){ grid.innerHTML = '<p class="empty">No hay asientos cargados en la hoja.</p>'; return; } 
 var seatNumber = 1; 
 rows.forEach(function(row){ 
 var rowEl = document.createElement('div'); rowEl.className = 'row'; 
 var left = document.createElement('div'); left.className = 'block'; 
 var right = document.createElement('div'); right.className = 'block'; 
 function renderSeat(letter, container){ 
 var code = row + letter; 
 var klass = computeClassForWith(seatsMap, code); 
 var btn = document.createElement('button'); btn.type='button'; btn.className = 'seat ' + klass; 
 var isNum = (klass === 'libre' || klass === 'ocupado'); 
 var norm = normalize(code); 
 if(isNum){ 
 btn.textContent = seatNumber; 
 btn.setAttribute('data-code', code); 
 btn.setAttribute('aria-label', 'Asiento ' + code + ' ('+seatNumber+') ' + klass); 
 seatNumber++; 
 btn.disabled = true; 
 }else{ 
 btn.innerHTML = ' '; 
 btn.setAttribute('aria-label', 'Asiento ' + code + ' inhabilitado/no disponible'); 
 btn.disabled = true; 
 } 
 if(highlightSet.has(norm)){ btn.classList.add('mine'); } 
 container.appendChild(btn); 
 } 
 ['A','B'].forEach(function(l){ renderSeat(l, left); }); 
 var aisle = document.createElement('div'); aisle.className = 'aisle'; 
 ['C','D'].forEach(function(l){ renderSeat(l, right); }); 
 rowEl.appendChild(left); rowEl.appendChild(aisle); rowEl.appendChild(right); 
 grid.appendChild(rowEl); 
 }); 
 var first = grid.querySelector('.seat.mine'); 
 if(first) first.scrollIntoView({behavior:'smooth', block:'center'}); 
 } 
function clearFindViewMulti(){ 
 document.getElementById('multiFeedback').classList.add('hidden'); 
 document.getElementById('multiNums').innerHTML = ''; 
 document.getElementById('multiCroquis').innerHTML = ''; 
 MULTI_SHEETS = []; 
 SEATS_BY_SHEET = new Map(); 
 HIGHLIGHT_BY_SHEET = new Map(); 
 NUMS_BY_SHEET = new Map(); 
 } 
/* ====== Control interno (single) ===== */ 
function renderControlBoard(){ 
 if(!CONTROL_AUTH){ hideControlBoard(); return; } 
 STAFF_CONTROL_MULTI = false; STAFF_ACTIVE_SHEET = CURRENT_TRIP.sheetName; 
 var board = document.getElementById('controlBoard'); 
 var croquis= document.getElementById('controlCroquis'); 
 var multi = document.getElementById('controlCroquisMulti'); 
 var fb = document.getElementById('pdfLinkFallback'); 
 if (board) board.hidden = false; 
 if (croquis) croquis.innerHTML = ''; 
 if (multi) multi.innerHTML = ''; 
 if (fb) { fb.classList.add('hidden'); fb.innerHTML = ''; } 
 CONTROL_EDIT=false; EDIT_SRC=null; EDIT_DST=null; updateEditTags(); syncToolbarUI(); 
 var btnExp = document.getElementById('btnExportPdf'); if (btnExp) btnExp.textContent = 'Exportar PDF'; 
 var maxRow = getMaxRow(); if(maxRow === 0){ if(croquis) croquis.innerHTML = '<p class="empty">No hay asientos cargados en la hoja.</p>'; return; } 
 NUM_LABELS = new Map(); var seatNumber = 1; 
 for(var row=1; row<=maxRow; row++){ 
 var rowEl=document.createElement('div'); rowEl.className='row'; 
 var left=document.createElement('div'); left.className='block'; 
 var right=document.createElement('div'); right.className='block'; 
 function renderSeat(letter, container){ 
 var code = row + letter; 
 var norm = normalize(code); 
 var klass= computeClassFor(code); 
 var isNum= (klass==='libre' || klass==='ocupado'); 
 var btn=document.createElement('button'); btn.type='button'; btn.className='seat ' + klass; 
 btn.setAttribute('data-sheet', CURRENT_TRIP.sheetName || ''); 
 btn.setAttribute('data-code',code); 
 btn.setAttribute('data-status',klass); 
 if(isNum){ 
 var occFull = (SEATS[norm] && SEATS[norm].pasajero) || ''; 
 var occName = (klass==='ocupado') ? firstName(occFull) : ''; 
 btn.innerHTML = 
 '<span class="num">'+seatNumber+'</span>' + 
 (occName ? '<span class="occ-name">'+occName+'</span>' : '') + 
 (occFull ? '<span class="occ-full" aria-hidden="true">'+occFull+'</span>' : ''); 
 btn.setAttribute('data-num',seatNumber); 
 btn.setAttribute('aria-label','Asiento '+code+' ('+seatNumber+') '+klass + (occName ? (' — Ocupa: '+occName) : '')); 
 btn.setAttribute('aria-expanded','false'); 
 btn.disabled = false; 
 NUM_LABELS.set(norm,seatNumber); 
 seatNumber++; 
 }else{ 
 btn.innerHTML=' '; 
 btn.setAttribute('aria-label','Asiento '+code+' inhabilitado/no disponible'); 
 btn.disabled=true; 
 } 
 btn.onclick=function(){ 
 if (CONTROL_EDIT) onControlSeatClick(btn); 
 else toggleSeatExpand(btn); 
 }; 
 container.appendChild(btn); 
 } 
 ['A','B'].forEach(function(l){ renderSeat(l,left); }); 
 var aisle=document.createElement('div'); aisle.className='aisle'; 
 ['C','D'].forEach(function(l){ renderSeat(l,right); }); 
 rowEl.appendChild(left); rowEl.appendChild(aisle); rowEl.appendChild(right); 
 if (croquis) croquis.appendChild(rowEl); 
 } 
 if (board) board.scrollIntoView({behavior:'smooth'}); 
 attachStickyAnimation(); 
 } 
function getMaxRow(){ var maxRow = 0; Object.keys(SEATS).forEach(function(code){ var m = code.match(/^(\d+)[A-Z]$/); if(m){ var row = parseInt(m[1],10); if(row > maxRow) maxRow = row; } }); return maxRow || 0; } 
function attachStickyAnimation(){ 
 var toolbar = document.getElementById('controlToolbar'); 
 function onScroll(){ var y=window.scrollY; if(y>24){ if(toolbar) toolbar.classList.add('scrolled'); } else { if(toolbar) toolbar.classList.remove('scrolled'); } } 
 window.removeEventListener('scroll', onScroll); 
 window.addEventListener('scroll', onScroll, { passive:true }); 
 onScroll(); 
 } 
function hideControlBoard(){ 
 var board = document.getElementById('controlBoard'); 
 if (board) board.hidden = true; 
 var c1 = document.getElementById('controlCroquis'); 
 var c2 = document.getElementById('controlCroquisMulti'); 
 if (c1) c1.innerHTML=''; 
 if (c2) c2.innerHTML=''; 
 var fb=document.getElementById('pdfLinkFallback'); 
 if (fb) { fb.classList.add('hidden'); fb.innerHTML=''; } 
 hideSeatTooltip(); 
 CONTROL_EDIT=false; EDIT_SRC=null; EDIT_DST=null; updateEditTags(); syncToolbarUI(); 
 } 
function toggleControlEdit(){ 
 if (!isAdmin()){ toast('No tenés permisos de edición'); return; } 
 CONTROL_EDIT=!CONTROL_EDIT; 
 hideSeatTooltip(); 
 updateEditTags(); syncToolbarUI(); 
 toast(CONTROL_EDIT ? 'Modo edición activo' : 'Modo edición desactivado'); 
 } 
function onControlSeatClick(btn){ 
 if(!CONTROL_EDIT) return; 
 var status=(btn.getAttribute('data-status') || 'libre').toLowerCase().trim(); 
 var num =parseInt(btn.getAttribute('data-num') || '0',10); 
 var code =btn.getAttribute('data-code'); 
 var sheet = btn.getAttribute('data-sheet') || CURRENT_TRIP.sheetName || null; 
 STAFF_ACTIVE_SHEET = sheet; 
 if(status==='ocupado'){ 
 var srcEls = document.querySelectorAll('.seat.pick-source'); for(var i=0;i<srcEls.length;i++){ srcEls[i].classList.remove('pick-source'); } 
 btn.classList.add('pick-source'); EDIT_SRC={num:num,code:code,sheet:sheet}; 
 }else if(status==='libre'){ 
 var dstEls = document.querySelectorAll('.seat.pick-target'); for(var j=0;j<dstEls.length;j++){ dstEls[j].classList.remove('pick-target'); } 
 btn.classList.add('pick-target'); EDIT_DST={num:num,code:code,sheet:sheet}; 
 }else{ return; } 
 updateEditTags(); syncToolbarUI(); 
 } 
function updateEditTags(){ 
 var tagSrc=document.getElementById('tagSrc'), tagDst=document.getElementById('tagDst'); 
 if (tagSrc) tagSrc.textContent='Origen: ' + (EDIT_SRC ? (EDIT_SRC.num + ' • ' + EDIT_SRC.code) : '—'); 
 if (tagDst) tagDst.textContent='Destino: ' + (EDIT_DST ? (EDIT_DST.num + ' • ' + EDIT_DST.code) : '—'); 
 } 
function syncToolbarUI() { 
 var btnEdit = document.getElementById('btnEditMode'); 
 var btnMove = document.getElementById('btnMove'); 
 var btnFree = document.getElementById('btnFree'); 
 var btnCancel = document.getElementById('btnCancel'); 
 var btnExport = document.getElementById('btnExportPdf'); 
 var toolbar = document.getElementById('controlToolbar'); 
 var tagSrc = document.getElementById('tagSrc'); 
 var tagDst = document.getElementById('tagDst'); 
 var admin = isAdmin(); 
 // Visibilidad base por rol 
 if (btnEdit) btnEdit.style.display = admin ? '' : 'none'; 
 if (btnExport) btnExport.style.display = admin ? '' : 'none'; 
 // Etiquetas Origen/Destino: viewer nunca; admin sólo en modo edición 
 var showTags = admin && CONTROL_EDIT; 
 if (tagSrc) tagSrc.style.display = showTags ? '' : 'none'; 
 if (tagDst) tagDst.style.display = showTags ? '' : 'none'; 
 // Acciones de edición: sólo admin + modo edición 
 var showEditActions = admin && CONTROL_EDIT; 
 if (btnMove) btnMove.style.display = showEditActions ? '' : 'none'; 
 if (btnFree) btnFree.style.display = showEditActions ? '' : 'none'; 
 if (btnCancel) btnCancel.style.display = showEditActions ? '' : 'none'; 
 if (toolbar) toolbar.classList.toggle('editing', CONTROL_EDIT); 
 // Si no es admin, no sigue lógica de edición 
 if (!admin) { 
 return; 
 } 
 if (CONTROL_EDIT) { 
 if (btnEdit) { 
 btnEdit.classList.add('danger'); 
 btnEdit.textContent = 'Salir de edición'; 
 } 
 var canMove = EDIT_SRC && EDIT_DST; 
 if (btnMove) btnMove.disabled = !canMove; 
 if (btnFree) btnFree.disabled = !EDIT_SRC; 
 if (btnCancel) btnCancel.disabled = false; 
 } else { 
 if (btnEdit) { 
 btnEdit.classList.remove('danger'); 
 btnEdit.textContent = 'Modo edición'; 
 } 
 if (btnMove) btnMove.disabled = true; 
 if (btnFree) btnFree.disabled = true; 
 if (btnCancel) btnCancel.disabled = true; 
 } 
} 
function cancelEdit(silent){ 
 EDIT_SRC=null; EDIT_DST=null; 
 var srcEls = document.querySelectorAll('.seat.pick-source'); for(var i=0;i<srcEls.length;i++){ srcEls[i].classList.remove('pick-source'); } 
 var dstEls = document.querySelectorAll('.seat.pick-target'); for(var j=0;j<dstEls.length;j++){ dstEls[j].classList.remove('pick-target'); } 
 updateEditTags(); syncToolbarUI(); 
 if(!silent) toast('Edición cancelada.'); 
 } 
async function movePassenger(){ 
 showLoading('Moviendo pasajero…'); 
 if(!isAdmin()){ hideLoading(); toast('Solo administradores pueden editar'); return; } 
 if(!EDIT_SRC || !EDIT_DST){ hideLoading(); toast('Selecciona origen (ocupado) y destino (libre).'); return; } 
 try{ 
 var sheet = STAFF_CONTROL_MULTI ? EDIT_SRC.sheet : CURRENT_TRIP.sheetName; 
 var resp=await API.apiMove(CURRENT_TRIP.fileId, sheet, EDIT_SRC.code, EDIT_DST.code); 
 toast(resp && resp.message ? resp.message : 'Movimiento realizado'); 
 cancelEdit(true); 
 await refreshControlBoardSmart(); 
 }catch(err){ 
 toast('No se pudo mover al pasajero'); 
 }finally{ 
 hideLoading(); 
 } 
 } 
async function freeSelectedSeat(){ 
 showLoading('Liberando asiento…'); 
 if(!isAdmin()){ hideLoading(); toast('Solo administradores pueden editar'); return; } 
 if(!EDIT_SRC){ hideLoading(); toast('Selecciona primero un asiento ocupado (origen) para liberar.'); return; } 
 try{ 
 var sheet = STAFF_CONTROL_MULTI ? EDIT_SRC.sheet : CURRENT_TRIP.sheetName; 
 var resp=await API.apiFree(CURRENT_TRIP.fileId, sheet, EDIT_SRC.code); 
 toast(resp && resp.message ? resp.message : 'Asiento liberado'); 
 cancelEdit(true); 
 await refreshControlBoardSmart(); 
 }catch(err){ 
 toast('No se pudo liberar el asiento'); 
 }finally{ 
 hideLoading(); 
 } 
 } 
/* ===== Exportar PDFs ===== */ 
async function doExportPdfSmart(){ 
 if(!CONTROL_AUTH){ toast('Debes iniciar sesión'); return; } 
 if(!isAdmin()){ toast('Solo administradores pueden exportar PDF'); return; } 
 showLoading('Generando PDF…'); 
 try{ 
 if (STAFF_CONTROL_MULTI) { 
 var floors = getFloorSheets(); 
 var urls = []; 
 for (var i=0;i<floors.length;i++){ 
 var f = floors[i]; 
 var resp = await API.apiExportPdf(CURRENT_TRIP.fileId, f.sheetName); 
 if(resp && resp.url){ urls.push({ label: f.label, url: resp.url }); } 
 } 
 if(urls.length){ 
 var openedAll = true; 
 for (var j=0;j<urls.length;j++){ 
 var w = window.open(urls[j].url,'_blank'); 
 if(!w) openedAll = false; 
 } 
 if(!openedAll){ 
 var fb=document.getElementById('pdfLinkFallback'); 
 var listHtml = ''; 
 for(var k=0;k<urls.length;k++){ 
 var u = urls[k]; 
 listHtml += '<li><a href="'+u.url+'" target="_blank" rel="noopener">'+u.label+'</a></li>'; 
 } 
 if (fb) { 
 fb.innerHTML='Tus PDFs están listos:<ul style="margin:8px 0;padding-left:16px;">'+listHtml+'</ul>'; 
 fb.classList.remove('hidden'); 
 } 
 } else { 
 toast('PDFs listos ('+urls.length+')'); 
 } 
 } else { 
 toast('No se pudo generar los PDFs'); 
 } 
 } else { 
 var sheet = CURRENT_TRIP.sheetName; 
 var resp2 = await API.apiExportPdf(CURRENT_TRIP.fileId, sheet); 
 if(resp2 && resp2.url){ 
 var newWin=window.open(resp2.url,'_blank'); 
 if(!newWin){ 
 var fb2=document.getElementById('pdfLinkFallback'); 
 if (fb2) { 
 fb2.innerHTML='Tu PDF está listo: <a href="'+resp2.url+'" target="_blank" rel="noopener">Abrir PDF</a>'; 
 fb2.classList.remove('hidden'); 
 } 
 }else{ 
 toast('PDF listo'); 
 } 
 }else{ 
 toast(resp2 && resp2.message ? resp2.message : 'No se pudo generar el PDF'); 
 } 
 } 
 }catch(err){ 
 toast('Error al generar PDF'); 
 }finally{ 
 hideLoading(); 
 } 
 } 
async function refreshControlBoardSmart(){ 
 if (STAFF_CONTROL_MULTI) { 
 await refreshStaffMulti(); 
 } else { 
 await refreshSeatsWithSpinner(null, renderControlBoard); 
 } 
 } 
/* ===== Wrapper público ===== */ 
async function refreshSelectGrid(){ 
 var opts = await computeGridOptions(); 
 await refreshSeatsWithSpinner('grid-select', function(){}, opts); 
 } 
/* ===== FIX: cablear botones del menú admin ===== */ 
function wireAdminMenuButtons(){ 
 var bLogin = document.getElementById('btnAdminLogin'); 
 var bInicio = document.getElementById('btnAdminControl'); 
 var bLogout = document.getElementById('btnAdminLogout'); 
 if (bLogin) bLogin.addEventListener('click', function(){ try { openStaffLogin(); hideAdminMenu(); } catch(e){} }); 
 if (bInicio) bInicio.addEventListener('click', function(){ try { backToChoose(); hideAdminMenu(); } catch(e){} }); 
 if (bLogout) bLogout.addEventListener('click', function(){ try { doControlLogout(); hideAdminMenu(); } catch(e){} }); 
} 
window.openStaffLogin = openStaffLogin; 
window.doControlLogout = doControlLogout; 
window.backToChoose = backToChoose; 
window.hideAdminMenu = hideAdminMenu; 
/* ===== GIS: render del botón y manejo de login ===== */ 
function renderGoogleButton(){ 
 const box = document.getElementById('googleSignIn'); 
 if (!box) return; 
 // FIX: aislar el iframe de Google 
 box.innerHTML = ''; 
 box.style.position = 'relative'; 
 box.style.zIndex = '1'; 
 if (!(window.google && google.accounts && google.accounts.id)) return; 
 google.accounts.id.initialize({ 
 client_id: GOOGLE_CLIENT_ID, 
 callback: handleCredentialResponse, 
 cancel_on_tap_outside: true 
 }); 
 google.accounts.id.renderButton(box, { 
 theme: 'outline', 
 size: 'large', 
 shape: 'pill', 
 text: 'signin_with', 
 logo_alignment: 'left' 
 }); 
} 
async function handleCredentialResponse(resp){ 
 try{ 
 const token = resp && resp.credential; 
 if (!token){ toast('No se recibió token'); return; } 
 showLoading('Verificando…'); 
 const out = await API.apiLoginWithToken(token); 
 if (out && out.ok){ 
 ID_TOKEN = token; 
 CONTROL_AUTH = true; 
 STAFF_ROLE = (out.role || 'viewer'); 
 STAFF_EMAIL = out.email || ''; 
 setStaffSession(true); 
 updateAdminMenu(); 
 syncStaffBadge(); 
 syncControlFormVisibility();
 syncAddTripVisibility();
 toast('Acceso staff habilitado'); 
 showView('view-choose'); 
 await loadTrips(); 
 hideControlBoard(); 
 setHash(['Inicio']); 
 }else{ 
 CONTROL_AUTH = false; setStaffSession(false); 
 STAFF_ROLE = null; STAFF_EMAIL = null; ID_TOKEN = null; 
 updateAdminMenu(); syncStaffBadge(); syncControlFormVisibility(); hideControlBoard();
 syncAddTripVisibility(); 
 toast((out && out.message) ? out.message : 'No autorizado'); 
 } 
 }catch(e){ 
 CONTROL_AUTH = false; setStaffSession(false); 
 STAFF_ROLE = null; STAFF_EMAIL = null; ID_TOKEN = null; 
 updateAdminMenu(); syncStaffBadge(); syncControlFormVisibility(); hideControlBoard();
 syncAddTripVisibility(); 
 toast('Error de verificación'); 
 }finally{ 
 hideLoading(); 
 } 
 } 
/* ===== Staff: login / logout ===== */ 
function openStaffLogin(){ 
 hideAdminMenu(); 
 CONTROL_AUTH = false; 
 setStaffSession(false); 
 STAFF_ROLE = null; STAFF_EMAIL = null; ID_TOKEN = null; 
 updateAdminMenu(); 
 syncStaffBadge(); 
 syncControlFormVisibility(); 
 syncAddTripVisibility();
 hideControlBoard(); 
 showView('view-control'); 
 setHash(['Staff']); 
 // Render del botón Google 
 function tryRender(){ if (window.google && google.accounts && google.accounts.id){ renderGoogleButton(); } else { setTimeout(tryRender, 400); } } 
 tryRender(); 
 } 
function doControlLogout(){ 
 CONTROL_AUTH = false; 
 setStaffSession(false); 
 STAFF_ROLE = null; STAFF_EMAIL = null; ID_TOKEN = null; 
 updateAdminMenu(); 
 syncStaffBadge(); 
 syncControlFormVisibility(); 
 syncAddTripVisibility();
 hideControlBoard(); 
 toast('Sesión finalizada'); 
 backToChoose(); 
 } 
/* ====== NUEVO: Crear viaje (UI + lógica) ====== */
function openCreateTripModal(){
  if(!CONTROL_AUTH || !isAdmin()) { toast('Solo administradores'); return; }
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
  var name = (document.getElementById('newTripName')||{}).value || '';
  name = name.trim();
  var type = (document.getElementById('tripTypeDouble')||{}).checked ? 'double' : 'single';
  if(!name){ toast('Ingresá el nombre del viaje'); return; }
  if(!CONTROL_AUTH || !isAdmin()){ toast('Solo administradores'); return; }
  closeCreateTripModal();
  showLoading('Creando viaje…');
  BUSY = true;
  try{
    var resp = await API.apiCreateTrip(name, type);
    if(resp && (resp.ok || resp.fileId || resp.trip)){
      // invalidar cache y recargar
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
    toast('No se pudo eliminar el viaje');
  } finally {
    hideLoading();
  }
}

window.openCreateTripModal = openCreateTripModal;
window.closeCreateTripModal = closeCreateTripModal;
/* ===== Inicio ===== */ 
(function(){ 
 function start(){ 
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
 window.addEventListener('hashchange', function(){ if (!ROUTER_DRIVING) routeTo(location.hash); }, { passive:true }); 
 routeTo(location.hash); 
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
function openReserveModal(){ var m=document.getElementById('reserveModal'); if(!m) return; m.classList.add('show'); m.setAttribute('aria-hidden','false'); var bar=document.getElementById('selectActionBar'); if(bar) bar.classList.add('hidden'); } 
function closeReserveModal(){ var m=document.getElementById('reserveModal'); if(!m) return; m.classList.remove('show'); m.setAttribute('aria-hidden','true'); var bar=document.getElementById('selectActionBar'); if(bar) bar.classList.remove('hidden'); } 
document.addEventListener('keydown', function(ev){ if(ev.key==='Escape') closeReserveModal(); }, { passive:true }); 
function renderSingleFormInModal(){ 
 var title = document.getElementById('reserveTitle'); var body = document.getElementById('reserveBody'); var btn = document.getElementById('reserveConfirmBtn'); 
 if (title){ 
 var only = Array.from(selected)[0]; var onlyNorm = normalize(only); 
 var num = NUM_LABELS.get(onlyNorm) || onlyNorm; 
 title.textContent = 'Asiento ' + num; 
 } 
 if (body) { 
 while (body.firstChild) body.removeChild(body.firstChild); 
 var form = document.createElement('div'); form.className = 'form'; 
 var nameWrap = document.createElement('label'); nameWrap.className = 'field'; 
 var nameLabel = document.createElement('span'); nameLabel.className = 'field-label'; nameLabel.textContent = 'Nombre y Apellido'; 
 var nameInput = document.createElement('input'); nameInput.id='nombreSingleModal'; nameInput.type='text'; nameInput.placeholder='Luanita Espada'; nameInput.required=true; nameInput.autocomplete='name'; nameInput.autocapitalize='words'; 
 nameWrap.appendChild(nameLabel); nameWrap.appendChild(nameInput); 
 var ciWrap = document.createElement('label'); ciWrap.className = 'field'; 
 var ciLabel = document.createElement('span'); ciLabel.className = 'field-label'; ciLabel.textContent = 'Número de documento'; 
 var ciInput = document.createElement('input'); ciInput.id='ciSingleModal'; ciInput.type='text'; ciInput.placeholder='Ej.: 12345678'; ciInput.required=true; ciInput.autocomplete='off'; ciInput.inputMode='numeric'; ciInput.pattern='[0-9]*'; ciInput.addEventListener('input', function(e){ onlyDigits(e.target); }); 
 ciWrap.appendChild(ciLabel); ciWrap.appendChild(ciInput); 
 form.appendChild(nameWrap); form.appendChild(ciWrap); body.appendChild(form); 
 } 
 if (btn) btn.onclick = confirmSingleFromModal; openReserveModal(); try { document.getElementById('nombreSingleModal').focus(); } catch(e){} 
} 
function renderMultiFormInModal(){ 
 var title = document.getElementById('reserveTitle'); var body = document.getElementById('reserveBody'); var btn = document.getElementById('reserveConfirmBtn'); 
 if (title) title.textContent = 'Asignar datos a tus asientos'; 
 if (body) { 
 while (body.firstChild) body.removeChild(body.firstChild); 
 var listWrap = document.createElement('div'); listWrap.id = 'assignListModal'; listWrap.className = 'assign-list'; 
 var codes = Array.from(selected); 
 for (var i = 0; i < codes.length; i++){ 
 var codeNorm = normalize(codes[i]); var num = NUM_LABELS.get(codeNorm) || ''; 
 var row = document.createElement('div'); row.className = 'assign-row'; row.setAttribute('data-code', codeNorm); 
 var titleDiv = document.createElement('div'); titleDiv.className = 'assign-title'; titleDiv.textContent = 'Asiento ' + (num || codeNorm); 
 var grid = document.createElement('div'); grid.className = 'assign-grid'; 
 var nameWrap = document.createElement('label'); nameWrap.className = 'field'; 
 var nameLabel = document.createElement('span'); nameLabel.className = 'field-label'; nameLabel.textContent = 'Nombre y Apellido'; 
 var nameInput = document.createElement('input'); nameInput.type='text'; nameInput.placeholder='Luanita Espada'; nameInput.required=true; nameInput.className='assign-name'; nameInput.autocomplete='name'; nameInput.autocapitalize='words'; 
 nameWrap.appendChild(nameLabel); nameWrap.appendChild(nameInput); 
 var ciWrap = document.createElement('label'); ciWrap.className = 'field'; 
 var ciLabel = document.createElement('span'); ciLabel.className = 'field-label'; ciLabel.textContent = 'Número de documento'; 
 var ciInput = document.createElement('input'); ciInput.type='text'; ciInput.placeholder='Ej.: 12345678'; ciInput.required=true; ciInput.className='assign-ci'; ciInput.inputMode='numeric'; ciInput.pattern='[0-9]*'; ciInput.addEventListener('input', function(e){ onlyDigits(e.target); }); 
 ciWrap.appendChild(ciLabel); ciWrap.appendChild(ciInput); 
 grid.appendChild(nameWrap); grid.appendChild(ciWrap); 
 row.appendChild(titleDiv); row.appendChild(grid); listWrap.appendChild(row); 
 } 
 body.appendChild(listWrap); 
 } 
 if (btn) btn.onclick = confirmReservationFromModal; openReserveModal(); 
} 
function confirmSingleFromModal(){ 
 if (BUSY) return; 
 var name = (document.getElementById('nombreSingleModal')||{}).value || ''; 
 var ci = (document.getElementById('ciSingleModal')||{}).value || ''; 
 name = name.trim(); ci = ci.trim(); 
 if (!name || !ci){ toast('Completá nombre y CI'); return; } 
 if (selected.size !== 1){ toast('Seleccioná exactamente un asiento'); return; } 
 var only = Array.from(selected)[0]; 
 var onlyNorm = normalize(only); 
 var pairs = [{ asiento: onlyNorm, pasajero: name, ci: ci }]; 
 var btn = document.getElementById('reserveConfirmBtn'); if (btn) btn.disabled = true; 
 closeReserveModal(); 
 BUSY = true; showLoading('Reservando…'); 
 API.apiReserve(CURRENT_TRIP.fileId, CURRENT_TRIP.sheetName, pairs) 
 .then(async function(){ showConfirmedModal(pairs); await refreshSelectGrid(); }) 
 .catch(function(){ toast('No se pudo reservar'); }) 
 .finally(function(){ hideLoading(); BUSY = false; if (btn) btn.disabled = false; }); 
} 
function confirmReservationFromModal(){ 
 if (BUSY) return; 
 var inputs = document.querySelectorAll('#assignListModal .assign-row'); 
 var pairs = []; 
 for (var i = 0; i < inputs.length; i++){ 
 var row = inputs[i]; 
 var codeNorm = row.getAttribute('data-code'); 
 var pasajero = row.querySelector('.assign-name').value.trim(); 
 var ci = row.querySelector('.assign-ci').value.trim(); 
 if (!pasajero || !ci){ toast('Faltan datos en ' + codeNorm); return; } 
 pairs.push({ asiento: codeNorm, pasajero: pasajero, ci: ci }); 
 } 
 var btn = document.getElementById('reserveConfirmBtn'); if (btn) btn.disabled = true; 
 closeReserveModal(); 
 BUSY = true; showLoading('Reservando…'); 
 API.apiReserve(CURRENT_TRIP.fileId, CURRENT_TRIP.sheetName, pairs) 
 .then(async function(){ showConfirmedModal(pairs); await refreshSelectGrid(); }) 
 .catch(function(){ toast('No se pudo reservar'); }) 
 .finally(function(){ hideLoading(); BUSY = false; if (btn) btn.disabled = false; }); 
} 
function openConfirmedModal(){ var m=document.getElementById('confirmedModal'); if(!m) return; m.classList.add('show'); m.setAttribute('aria-hidden','false'); try{ var sheet=m.querySelector('.sheet'); if(sheet){ sheet.focus(); } }catch(e){} } 
function closeConfirmedModal(){ var m=document.getElementById('confirmedModal'); if(!m) return; m.classList.remove('show'); m.setAttribute('aria-hidden','true'); } 
document.addEventListener('keydown', function(ev){ if(ev.key==='Escape'){ var m=document.getElementById('confirmedModal'); if(m && m.classList.contains('show')) closeConfirmedModal(); } }, { passive:true }); 
function showConfirmedModal(pairs){ 
 var body = document.getElementById('confirmedBody'); 
 if(body){ while(body.firstChild) body.removeChild(body.firstChild); 
 var panel = document.createElement('div'); panel.className='form'; 
 var list = document.createElement('div'); list.className='assign-list'; 
 for (var i=0;i<pairs.length;i++){ var p = pairs[i]; 
 var row = document.createElement('div'); row.className='assign-row'; 
 var ttl = document.createElement('div'); ttl.className='assign-title'; 
 var seatNum = ((typeof NUM_LABELS!=='undefined' && NUM_LABELS && NUM_LABELS.get(p.asiento)) ? NUM_LABELS.get(p.asiento) : p.asiento); 
 ttl.textContent = 'Asiento ' + seatNum + ': ' + p.pasajero; 
 row.appendChild(ttl); list.appendChild(row); } 
 panel.appendChild(list); 
 var note = document.createElement('div'); note.className='field'; 
 var span = document.createElement('span'); span.className='field-label'; span.textContent = 'Cualquier cambio o cancelación informar a su agente.'; 
 note.appendChild(span); panel.appendChild(note); body.appendChild(panel); 
 } 
 openConfirmedModal(); 
} 
function goToStartAndCloseConfirmed(){ try{ closeConfirmedModal(); }catch(e){} try{ goTripMenu(); }catch(e){} } 
function startSelectionModal(){ if (BUSY) return; if (selected.size === 0){ toast('Elegí al menos un asiento'); return; } if (selected.size === 1){ renderSingleFormInModal(); return; } renderMultiFormInModal(); } 
function updateAssignVisibility(){ /* modal-only */ } 
function backToSelect(){ try { closeReserveModal(); } catch(e){} } 
(function(){ 
 function setVH(){ 
 var h = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight; 
 document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px'); 
 } 
 setVH(); 
 window.addEventListener('resize', setVH, {passive:true}); 
 if (window.visualViewport){ 
 window.visualViewport.addEventListener('resize', setVH, {passive:true}); 
 window.visualViewport.addEventListener('scroll', setVH, {passive:true}); 
 } 
 // Auto-scroll focused input into view inside modal 
 document.addEventListener('focusin', function(ev){ 
 var m = document.getElementById('reserveModal'); 
 if (!m || !m.classList.contains('show')) return; 
 var target = ev.target; 
 if (target && target.tagName === 'INPUT'){ 
 try{ target.scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){} 
 } 
 }, {passive:true}); 
})(); 
// === Fin de scripts extraídos del HTML original ===
