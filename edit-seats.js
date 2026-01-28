// edit-seats.js — UI y llamadas para edición de estructura (admin)
(function(){
  function parseCodes(raw){
    const tokens = String(raw||'').toUpperCase().split(/[^0-9A-Z]+/g).filter(Boolean);
    const onlySeat = tokens.filter(t => /^\d+[A-Z]$/.test(t));
    const seen = new Set(); const out = [];
    for(const c of onlySeat){ if(!seen.has(c)){ seen.add(c); out.push(c); } }
    return out;
  }
  function isAdminSafe(){ try{ return typeof isAdmin==='function' && isAdmin(); }catch(e){ return false; } }
  function getFloorSheetsSafe(){ try{ return typeof getFloorSheets==='function' ? getFloorSheets() : []; }catch(e){ return []; } }
  function getTargetSheetForEdit(){
    var wrap = document.getElementById('editSeatsSheetWrap');
    if (wrap && wrap.style.display !== 'none'){
      var sel = document.getElementById('editSeatsSheet');
      if (sel && sel.value) return sel.value;
    }
    try{
      if (window.STAFF_CONTROL_MULTI){
        if (window.STAFF_ACTIVE_SHEET) return window.STAFF_ACTIVE_SHEET;
        var floors = getFloorSheetsSafe();
        if (floors && floors.length) return floors[0].sheetName;
      }
    }catch(_){ }
    return window.CURRENT_TRIP ? window.CURRENT_TRIP.sheetName : null;
  }
  async function buildSheetSelectorIfNeeded(){
    var wrap = document.getElementById('editSeatsSheetWrap');
    var sel = document.getElementById('editSeatsSheet');
    if (!wrap || !sel) return;
    if (window.CURRENT_TRIP && window.CURRENT_TRIP.hasFloors){
      wrap.style.display = '';
      sel.innerHTML = '';
      var floors = getFloorSheetsSafe();
      floors.forEach(function(f){
        var opt = document.createElement('option');
        opt.value = f.sheetName; opt.textContent = f.label + ' (' + f.sheetName + ')';
        sel.appendChild(opt);
      });
      var prefer = window.STAFF_ACTIVE_SHEET || (window.CURRENT_TRIP && window.CURRENT_TRIP.sheetName) || (floors[0]?floors[0].sheetName:'');
      if (prefer){ for (var i=0;i<sel.options.length;i++){ if (sel.options[i].value.toLowerCase() === String(prefer).toLowerCase()){ sel.selectedIndex = i; break; } } }
    } else {
      wrap.style.display = 'none';
    }
  }
  async function doApplyEditSeats(){
    if (!window.CONTROL_AUTH || !isAdminSafe()){ toast('Solo administradores'); return; }
    var add = parseCodes(document.getElementById('editAddCodes')?.value||'');
    var remove = parseCodes(document.getElementById('editRemoveCodes')?.value||'');
    var disable = parseCodes(document.getElementById('editDisableCodes')?.value||'');
    var enable = parseCodes(document.getElementById('editEnableCodes')?.value||'');
    var force = !!document.getElementById('editForce')?.checked;
    if (!add.length && !remove.length && !disable.length && !enable.length){ toast('Ingresá al menos una acción'); return; }
    if (!window.CURRENT_TRIP || !window.CURRENT_TRIP.fileId){ toast('Seleccioná un viaje válido'); return; }
    var targetSheet = getTargetSheetForEdit();
    if (!targetSheet){ toast('Seleccioná una hoja válida'); return; }
    var btn = document.getElementById('editSeatsConfirmBtn');
    try{
      if (btn) btn.disabled = true;
      if (typeof showLoading==='function') showLoading('Aplicando cambios…');
      // Preparar API
      window.API = window.API || {};
      if (!window.API.apiEditSeats){
        window.API.apiEditSeats = async function(fileId, sheetName, ops){
          const payload = Object.assign({ idToken: window.ID_TOKEN, fileId, sheetName }, ops||{});
          const res = await fetch(getUrl('editSeats'), postOptions(payload));
          if(!res.ok) throw new Error('POST editSeats: ' + res.status); 
          const txt = await res.text();
          try{ return JSON.parse(txt); }catch{ return { ok:false, message: txt||'Error' }; }
        }
      }
      var resp = await window.API.apiEditSeats(window.CURRENT_TRIP.fileId, targetSheet, { add, remove, disable, enable, force });
      if (resp && resp.ok){ toast(resp.message ? resp.message : 'Cambios aplicados'); closeEditSeatsModal(); if (typeof refreshControlBoardSmart==='function') await refreshControlBoardSmart(); }
      else { toast(resp && resp.message ? resp.message : 'No se pudo aplicar cambios'); }
    }catch(e){ toast('Error al aplicar cambios'); }
    finally{ if (typeof hideLoading==='function') hideLoading(); if (btn) btn.disabled = false; }
  }
  window.openEditSeatsModal = async function(){
    if (!window.CONTROL_AUTH || !isAdminSafe()){ toast('Solo administradores'); return; }
    try{
      document.getElementById('editAddCodes').value = '';
      document.getElementById('editRemoveCodes').value = '';
      document.getElementById('editDisableCodes').value = '';
      document.getElementById('editEnableCodes').value = '';
      document.getElementById('editForce').checked = false;
    }catch(_){ }
    await buildSheetSelectorIfNeeded();
    var m = document.getElementById('editSeatsModal'); if(!m) return;
    var btn = document.getElementById('editSeatsConfirmBtn'); if (btn) btn.onclick = doApplyEditSeats;
    m.classList.add('show'); m.setAttribute('aria-hidden','false');
  };
  window.closeEditSeatsModal = function(){ var m=document.getElementById('editSeatsModal'); if(!m) return; m.classList.remove('show'); m.setAttribute('aria-hidden','true'); };
  document.addEventListener('keydown', function(ev){ if(ev.key==='Escape') closeEditSeatsModal(); }, { passive:true });
  // Visibilidad del botón: cada 1000 ms para reflejar cambios de rol/login
  function updateBtn(){ var btn=document.getElementById('btnEditSeats'); if(!btn) return; var admin=isAdminSafe(); btn.style.display = admin? '' : 'none'; btn.disabled = !admin; }
  setInterval(updateBtn, 1000);
  document.addEventListener('DOMContentLoaded', updateBtn, { once:true });
})();
