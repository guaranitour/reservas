// edit-seats.js — Edición visual de estructura (admin) + modal avanzado — HOTFIX doble piso
(function(){
  // ===== Utilities =====
  function parseCodes(raw){
    const tokens = String(raw||'').toUpperCase().split(/[^0-9A-Z]+/g).filter(Boolean);
    const onlySeat = tokens.filter(t => /^\d+[A-Z]$/.test(t));
    const seen = new Set(); const out = [];
    for(const c of onlySeat){ if(!seen.has(c)){ seen.add(c); out.push(c); } }
    return out;
  }
  function isAdminSafe(){ try{ return typeof isAdmin==='function' && isAdmin(); }catch(e){ return false; } }
  function getFloorSheetsSafe(){ try{ return typeof getFloorSheets==='function' ? getFloorSheets() : []; }catch(e){ return []; } }
  function getTargetSheet(){
    try{
      if (window.STAFF_CONTROL_MULTI){
        if (window.STAFF_ACTIVE_SHEET) return window.STAFF_ACTIVE_SHEET;
        var floors = getFloorSheetsSafe();
        if (floors && floors.length) return floors[0].sheetName;
      }
    }catch(_){ }
    return window.CURRENT_TRIP ? window.CURRENT_TRIP.sheetName : null;
  }
  function nowContainerEls(){
    return {
      single: document.getElementById('controlCroquis'),
      multi: document.getElementById('controlCroquisMulti')
    };
  }
  function getMaxRowFromButtons(root){
    if (!root) return 0;
    let max=0;
    const seats = root.querySelectorAll('.seat[data-code]');
    seats.forEach(btn=>{
      const code = String(btn.getAttribute('data-code')||'');
      const m = code.match(/^(\d+)[A-Z]$/);
      if (m){ const r = parseInt(m[1],10); if (r>max) max=r; }
    });
    return max;
  }
  function collectRowCodes(_root, row){
    const letters = ['A','B','C','D'];
    return letters.map(l => String(row)+l);
  }

  // === API: ahora acepta sheetOverride para forzar planta correcta ===
  async function callEditSeats(ops, sheetOverride){
    window.API = window.API || {};
    if (!window.API.apiEditSeats){
      window.API.apiEditSeats = async function(fileId, sheetName, ops){
        const payload = Object.assign({ idToken: window.ID_TOKEN, fileId, sheetName }, ops||{});
        const res = await fetch(getUrl('editSeats'), postOptions(payload));
        if(!res.ok) throw new Error('POST editSeats: ' + res.status);
        const t = await res.text();
        try{ return JSON.parse(t); }catch{ return { ok:false, message:t||'Error' }; }
      };
    }
    const fileId = window.CURRENT_TRIP && window.CURRENT_TRIP.fileId;
    const sheetName = sheetOverride || getTargetSheet(); // <-- clave
    if (!fileId || !sheetName){ toast('Seleccioná un viaje/hoja válida'); return { ok:false }; }
    try{
      if (typeof showLoading==='function') showLoading('Aplicando cambios…');
      const resp = await window.API.apiEditSeats(fileId, sheetName, ops);
      if (!resp || !resp.ok){ toast(resp && resp.message ? resp.message : 'No se pudo aplicar cambios'); return resp||{ok:false}; }
      toast(resp.message || 'Cambios aplicados');
      if (typeof refreshControlBoardSmart==='function') await refreshControlBoardSmart();
      return resp;
    }finally{ if (typeof hideLoading==='function') hideLoading(); }
  }

  // ===== Structure Mode =====
  let STRUCTURE_MODE = false;
  let observer = null;
  let LAST_EDIT_SHEET = null; // recordamos la última planta tocada

  function setSeatCursor(root, enable){
    if (!root) return;
    root.querySelectorAll('.seat').forEach(btn=>{
      btn.style.cursor = enable ? 'pointer' : '';
    });
  }
  function injectGlobalBar(){
    // create or show a small bar under the toolbar with actions: Add row, Exit, Advanced (modal)
    const board = document.getElementById('controlBoard');
    if (!board) return;
    let bar = document.getElementById('structureBar');
    if (!bar){
      bar = document.createElement('div');
      bar.id = 'structureBar';
      bar.className = 'form';
      bar.style.marginTop = '8px';
      bar.innerHTML = (
        '<div class="actions" style="justify-content:space-between;flex-wrap:wrap;gap:8px">'
        + '<div class="hint" style="color:#6b7280;line-height:1.3">Modo estructura activo: tocá un asiento para <strong>habilitar/inhabilitar</strong>. Si está ocupado te voy a preguntar si querés forzar. </div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
        + '  <button type="button" class="btn primary" id="btnAddRowStructure">Agregar fila +</button>'
        + '  <button type="button" class="btn ghost" id="btnAdvancedStructure">Opciones avanzadas</button>'
        + '  <button type="button" class="btn danger" id="btnExitStructure">Salir</button>'
        + '</div>'
        + '</div>'
      );
      board.insertBefore(bar, board.firstChild.nextSibling);
      document.getElementById('btnAddRowStructure').addEventListener('click', onAddRowClick);
      document.getElementById('btnExitStructure').addEventListener('click', exitStructureMode);
      const adv = document.getElementById('btnAdvancedStructure');
      if (adv) adv.addEventListener('click', function(){ if (typeof openEditSeatsModal==='function') openEditSeatsModal(); });
    } else {
      bar.style.display = '';
    }
  }
  function hideGlobalBar(){
    const bar = document.getElementById('structureBar');
    if (bar) bar.style.display = 'none';
  }
  function injectRowDeleteButtons(){
    const { single, multi } = nowContainerEls();
    function decorate(root){
      if (!root) return;
      root.querySelectorAll('.row').forEach(rowEl=>{
        // avoid duplicates
        if (rowEl.querySelector('.row-del-btn')) return;
        rowEl.style.position = 'relative';
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'row-del-btn';
        del.textContent = '–';
        del.title = 'Eliminar fila';
        // style
        del.style.position = 'absolute';
        del.style.right = '-6px';
        del.style.top = '50%';
        del.style.transform = 'translateY(-50%)';
        del.style.border = '1px solid #e5e7eb';
        del.style.background = '#fff';
        del.style.color = '#111827';
        del.style.borderRadius = '999px';
        del.style.width = '28px';
        del.style.height = '28px';
        del.style.boxShadow = '0 2px 8px rgba(17,24,39,.12)';
        del.style.cursor = 'pointer';
        del.addEventListener('click', function(ev){ onDeleteRowClick(ev, rowEl, root); });
        rowEl.appendChild(del);
      });
    }
    decorate(single);
    decorate(multi);
  }

  async function onAddRowClick(){
    // preferimos última hoja tocada; luego la activa; si no, inferimos por la primera baldosa visible
    let sheet = LAST_EDIT_SHEET || (window.STAFF_ACTIVE_SHEET || null);
    if (!sheet){
      const { single, multi } = nowContainerEls();
      const root = (window.STAFF_CONTROL_MULTI ? multi : single) || single || multi;
      const anySeat = root && root.querySelector('.seat[data-sheet]');
      if (anySeat) sheet = anySeat.getAttribute('data-sheet');
    }
    const { single, multi } = nowContainerEls();
    const root = (window.STAFF_CONTROL_MULTI ? multi : single) || single || multi;
    const next = getMaxRowFromButtons(root) + 1;
    const codes = collectRowCodes(root, next);
    await callEditSeats({ add: codes }, sheet);
  }

  async function onDeleteRowClick(ev, rowEl, root){
    // find the row number by any seat in this row
    const seat = rowEl.querySelector('.seat[data-code]');
    if (!seat){ toast('No se detectó fila'); return; }
    const code = String(seat.getAttribute('data-code')||'');
    const sheet = seat.getAttribute('data-sheet') || getTargetSheet(); // forzamos hoja correcta
    const m = code.match(/^(\d+)[A-Z]$/);
    if (!m){ toast('Fila inválida'); return; }
    const rowNum = parseInt(m[1],10);
    const codes = collectRowCodes(root, rowNum);
    let force = false;
    // check if any occupied
    const occ = rowEl.querySelector('.seat.ocupado');
    if (occ){
      force = confirm('Hay asientos ocupados en esta fila. ¿Eliminar de todos modos? (forzar)');
      if (!force) return;
    }
    await callEditSeats({ remove: codes, force }, sheet);
  }

  async function seatToggleHandler(ev){
    if (!STRUCTURE_MODE) return;
    const seatBtn = ev.target.closest('.seat');
    if (!seatBtn) return;
    const insideSingle = !!ev.target.closest('#controlCroquis');
    const insideMulti = !!ev.target.closest('#controlCroquisMulti');
    if (!insideSingle && !insideMulti) return;
    ev.preventDefault();
    const status = String(seatBtn.getAttribute('data-status')||'').toLowerCase();
    const code = seatBtn.getAttribute('data-code');
    const sheet = seatBtn.getAttribute('data-sheet') || getTargetSheet();
    if (!code || !sheet) return;

    // Recordamos la última hoja tocada y actualizamos activa
    LAST_EDIT_SHEET = sheet;
    window.STAFF_ACTIVE_SHEET = sheet;

    if (status === 'libre'){
      await callEditSeats({ disable: [code] }, sheet);
    } else if (status === 'ocupado'){
      const ok = confirm('El asiento está ocupado. ¿Inhabilitar de todos modos? Se liberará al pasajero.');
      if (!ok) return;
      await callEditSeats({ disable: [code], force: true }, sheet);
    } else {
      // incluye inhabilitado/inexistente -> habilitar
      await callEditSeats({ enable: [code] }, sheet);
    }
  }

  function startObservingForReinject(){
    if (observer) observer.disconnect();
    const { single, multi } = nowContainerEls();
    const target = (window.STAFF_CONTROL_MULTI ? multi : single) || single || multi;
    if (!target) return;
    observer = new MutationObserver(function(){ if (STRUCTURE_MODE){ setSeatCursor(target, true); injectRowDeleteButtons(); } });
    observer.observe(target, { childList:true, subtree:true });
  }
  function stopObserving(){ if (observer){ observer.disconnect(); observer = null; } }

  function tweakToolbarButton(entering){
    const btn = document.getElementById('btnEditSeats');
    if (!btn) return;
    if (entering){
      btn.textContent = 'Salir estructura';
      btn.classList.add('danger');
      btn.classList.remove('warning');
    }else{
      btn.textContent = 'Editar estructura';
      btn.classList.remove('danger');
      btn.classList.add('warning');
    }
  }

  async function enterStructureMode(){
    if (!window.CONTROL_AUTH || !isAdminSafe()){ toast('Solo administradores'); return; }
    STRUCTURE_MODE = true;
    document.addEventListener('click', seatToggleHandler, true);
    const { single, multi } = nowContainerEls();
    setSeatCursor(single, true); setSeatCursor(multi, true);
    injectGlobalBar(); injectRowDeleteButtons();
    startObservingForReinject();
    tweakToolbarButton(true);
    toast('Modo estructura activo');
  }
  function exitStructureMode(){
    STRUCTURE_MODE = false;
    document.removeEventListener('click', seatToggleHandler, true);
    const { single, multi } = nowContainerEls();
    setSeatCursor(single, false); setSeatCursor(multi, false);
    hideGlobalBar();
    stopObserving();
    tweakToolbarButton(false);
    toast('Modo estructura desactivado');
  }
  function toggleStructureMode(){ STRUCTURE_MODE ? exitStructureMode() : enterStructureMode(); }

  // ===== Modal avanzado (ya existente) =====
  // Conservamos compatibilidad: si llamás openEditSeatsModal sigue funcionando
  async function ensureAdvancedModal(){
    if (document.getElementById('editSeatsModal')) return true;
    // no hacemos injection de HTML aquí: asumimos que el modal viene en tu index.html modificado.
    return false;
  }
  window.openEditSeatsModal = async function(){
    const ok = await ensureAdvancedModal();
    if (!ok){ toast('Modal no disponible en este build'); return; }
    try{
      document.getElementById('editAddCodes').value = '';
      document.getElementById('editRemoveCodes').value = '';
      document.getElementById('editDisableCodes').value = '';
      document.getElementById('editEnableCodes').value = '';
      document.getElementById('editForce').checked = false;
    }catch(_){ }
    var m = document.getElementById('editSeatsModal'); if(!m) return;
    var btn = document.getElementById('editSeatsConfirmBtn'); if (btn) btn.onclick = async function(){
      var add = parseCodes(document.getElementById('editAddCodes')?.value||'');
      var remove = parseCodes(document.getElementById('editRemoveCodes')?.value||'');
      var disable = parseCodes(document.getElementById('editDisableCodes')?.value||'');
      var enable = parseCodes(document.getElementById('editEnableCodes')?.value||'');
      var force = !!document.getElementById('editForce')?.checked;
      if (!add.length && !remove.length && !disable.length && !enable.length){ toast('Ingresá al menos una acción'); return; }
      await callEditSeats({ add, remove, disable, enable, force }, LAST_EDIT_SHEET || getTargetSheet());
      closeEditSeatsModal();
    };
    m.classList.add('show'); m.setAttribute('aria-hidden','false');
  };
  window.closeEditSeatsModal = function(){ var m=document.getElementById('editSeatsModal'); if(!m) return; m.classList.remove('show'); m.setAttribute('aria-hidden','true'); };
  document.addEventListener('keydown', function(ev){ if(ev.key==='Escape') closeEditSeatsModal(); }, { passive:true });

  // ===== Wire button behavior and visibility =====
  function wireButton(){
    var btn=document.getElementById('btnEditSeats');
    if (!btn) return;
    btn.onclick = toggleStructureMode; // usar modo visual por defecto
    // visibilidad por rol
    var admin=isAdminSafe(); btn.style.display = admin? '' : 'none'; btn.disabled = !admin;
    tweakToolbarButton(false);
  }
  function onRender(){ if (STRUCTURE_MODE){ injectRowDeleteButtons(); const {single,multi}=nowContainerEls(); setSeatCursor(single,true); setSeatCursor(multi,true);} }

  document.addEventListener('DOMContentLoaded', function(){ wireButton(); onRender(); }, { once:true });
  // fallback: refrescar visibilidad cada tanto por si el rol cambia tras login
  setInterval(wireButton, 1000);
})();
