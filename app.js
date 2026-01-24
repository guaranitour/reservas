// app.js (migrado parcialmente a módulos)
import { BASE_URL, API_KEY } from './lib/constants.js';
import { setCache, getCache, clearCache } from './lib/cache.js';
import { renderGoogleButton, handleCredentialResponse, openStaffLogin, doControlLogout } from './lib/auth.js';
import { getHashSegments, setHash, initRouter } from './lib/router.js';

// BASE_URL importado desde lib/constants.js
// API_KEY importado desde lib/constants.js

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
      extra = extra || {};
      for (var k in extra){ if(extra.hasOwnProperty(k)) base[k] = extra[k]; }
      if (API_KEY) base.apiKey = API_KEY;
      return base;
    }
    function getUrl(action, extraParams) {
      return BASE_URL + QS(withCommonParams(Object.assign({ action: action }, (extraParams || {}))));
    }
    function postOptions(payloadObj) {
      return {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payloadObj || {})
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

    window.API = { apiGetTrips, apiGetSeats, apiGetSeatsByCi, apiGetLogo, apiExportPdf, apiReserve, apiMove, apiFree, apiLoginWithToken };
  



// === Callbacks de autenticación (escuchados desde lib/auth.js) ===
window.addEventListener('auth:reset', () => {
  try{ CONTROL_AUTH = false; try { localStorage.removeItem('app_staff_mode'); } catch {} STAFF_ROLE = null; STAFF_EMAIL = null; ID_TOKEN = null; updateAdminMenu(); syncStaffBadge(); syncControlFormVisibility(); hideControlBoard(); }catch(e){}
});
window.addEventListener('auth:login', async (ev) => {
  const d = ev.detail || {}; if (d.ok){ ID_TOKEN = d.idToken; CONTROL_AUTH = true; STAFF_ROLE = d.role || 'viewer'; STAFF_EMAIL = d.email || ''; try { localStorage.setItem('app_staff_mode', '1'); } catch {} updateAdminMenu(); syncStaffBadge(); syncControlFormVisibility(); toast('Acceso staff habilitado'); showView('view-choose'); await loadTrips(); hideControlBoard(); setHash(['Inicio']); } else { CONTROL_AUTH = false; STAFF_ROLE = null; STAFF_EMAIL = null; ID_TOKEN = null; try { localStorage.removeItem('app_staff_mode'); } catch {} updateAdminMenu(); syncStaffBadge(); syncControlFormVisibility(); hideControlBoard(); toast(d.message || 'No autorizado'); }
});
window.addEventListener('auth:logout', () => {
  CONTROL_AUTH = false; STAFF_ROLE = null; STAFF_EMAIL = null; ID_TOKEN = null; try { localStorage.removeItem('app_staff_mode'); } catch {} updateAdminMenu(); syncStaffBadge(); syncControlFormVisibility(); hideControlBoard(); toast('Sesión finalizada'); backToChoose();
});



function openReserveModal(){ var m=document.getElementById('reserveModal'); if(!m) return; m.classList.add('show'); m.setAttribute('aria-hidden','false'); var bar=document.getElementById('selectActionBar'); if(bar) bar.classList.add('hidden'); }
function closeReserveModal(){ var m=document.getElementById('reserveModal'); if(!m) return; m.classList.remove('show'); m.setAttribute('aria-hidden','true'); var bar=document.getElementById('selectActionBar'); if(bar) bar.classList.remove('hidden'); }
document.addEventListener('keydown', function(ev){ if(ev.key==='Escape') closeReserveModal(); }, { passive:true });
function renderSingleFormInModal(){
  var title = document.getElementById('reserveTitle'); var body  = document.getElementById('reserveBody'); var btn   = document.getElementById('reserveConfirmBtn');
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
  var title = document.getElementById('reserveTitle'); var body  = document.getElementById('reserveBody'); var btn   = document.getElementById('reserveConfirmBtn');
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
  var ci   = (document.getElementById('ciSingleModal')||{}).value || '';
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
      var seatNum = (typeof NUM_LABELS!=='undefined' && NUM_LABELS && NUM_LABELS.get(p.asiento)) ? NUM_LABELS.get(p.asiento) : p.asiento;
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


// Exponer funciones usadas por atributos HTML
afterBoot();
function afterBoot(){ try{ window.openStaffLogin = openStaffLogin; window.doControlLogout = doControlLogout; window.backToChoose = backToChoose; window.hideAdminMenu = hideAdminMenu; }catch(e){} }
// Inicializar router (escucha hashchange y llama a routeTo)
(function(){ const _routeHandler = (hash) => { if (!ROUTER_DRIVING) routeTo(hash); }; if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', () => initRouter(_routeHandler)); } else { initRouter(_routeHandler); } })();