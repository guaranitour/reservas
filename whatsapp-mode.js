// =============================================
//  MODO WHATSAPP — Staff
// =============================================

(function () {

  var WA_ACTIVE          = false;
  var WA_SELECTED        = new Map();
  var WA_REPAINT_PENDING = false;
  var WA_AUTH_POLL       = null; // intervalo de detección de auth

  /* ── Helpers ── */
  function norm(code) {
    return (code || '').toString().replace(/\s+/g, '').trim().toUpperCase();
  }

  function getFloorLabel(sheetName) {
    var s = String(sheetName || '').toLowerCase();
    if (s.indexOf('alta') >= 0) return 'Planta alta';
    if (s.indexOf('baja') >= 0) return 'Planta baja';
    return null;
  }

  function isStaffAuthed() {
    return typeof CONTROL_AUTH !== "undefined" && !!CONTROL_AUTH;
  }

  /* ── FAB ── */
  function getOrCreateFab() {
    var existing = document.getElementById('btnWaMode');
    if (existing) return existing;

    var fab = document.createElement('button');
    fab.id   = 'btnWaMode';
    fab.type = 'button';
    fab.className = 'wa-fab wa-fab-hidden';
    fab.setAttribute('aria-label', 'Activar modo WhatsApp');
    fab.innerHTML =
      '<span class="wa-fab-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">' +
          '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15' +
          '-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475' +
          '-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52' +
          '.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207' +
          '-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372' +
          '-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074' +
          '.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625' +
          '.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413' +
          '.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>' +
          '<path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.532 5.845L.057 23.885' +
          'a.5.5 0 0 0 .606.606l6.109-1.459A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12' +
          'S18.627 0 12 0zm0 21.9a9.9 9.9 0 0 1-5.031-1.37l-.36-.214-3.733.892.924-3.648' +
          '-.235-.374A9.862 9.862 0 0 1 2.1 12C2.1 6.525 6.525 2.1 12 2.1S21.9 6.525 21.9 12' +
          ' 17.475 21.9 12 21.9z"/>' +
        '</svg>' +
      '</span>' +
      '<span class="wa-fab-label">Modo WhatsApp</span>';

    fab.addEventListener('click', toggleWaMode);
    document.body.appendChild(fab);
    return fab;
  }

  /* ── Barra inferior ── */
  function getOrCreateWaBar() {
    var existing = document.getElementById('waActionBar');
    if (existing) return existing;

    var bar = document.createElement('div');
    bar.id        = 'waActionBar';
    bar.className = 'wa-action-bar hidden';
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML =
      '<div class="wa-bar-inner">' +
        '<span class="wa-bar-count" id="waBarCount">Ningún asiento seleccionado</span>' +
        '<div class="wa-bar-actions">' +
          '<button type="button" class="btn wa-btn-clear" id="waBtnClear">Limpiar</button>' +
          '<button type="button" class="btn wa-btn-share" id="waBtnShare" disabled>' +
            '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">' +
              '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15' +
              '-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475' +
              '-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52' +
              '.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207' +
              '-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372' +
              '-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074' +
              '.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625' +
              '.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413' +
              '.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>' +
              '<path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.532 5.845L.057 23.885' +
              'a.5.5 0 0 0 .606.606l6.109-1.459A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12' +
              'S18.627 0 12 0zm0 21.9a9.9 9.9 0 0 1-5.031-1.37l-.36-.214-3.733.892.924-3.648' +
              '-.235-.374A9.862 9.862 0 0 1 2.1 12C2.1 6.525 6.525 2.1 12 2.1S21.9 6.525 21.9 12' +
              ' 17.475 21.9 12 21.9z"/>' +
            '</svg>' +
            'Compartir' +
          '</button>' +
        '</div>' +
      '</div>';

    bar.querySelector('#waBtnClear').addEventListener('click', waClearSelection);
    bar.querySelector('#waBtnShare').addEventListener('click', waShare);
    document.body.appendChild(bar);
    return bar;
  }

  /* ── Visibilidad del FAB ── */
  function syncWaFabVisibility() {
    var fab = document.getElementById('btnWaMode');
    if (!fab) return;

    var viewControl   = document.getElementById('view-control');
    var controlActive = viewControl && viewControl.classList.contains('active');

    if (isStaffAuthed() && controlActive) {
      fab.classList.remove('wa-fab-hidden');
    } else {
      fab.classList.add('wa-fab-hidden');
      if (WA_ACTIVE) deactivateWaMode();
    }
  }

  /* ── Polling de auth (corre cada 600ms hasta detectar staff autenticado,
     luego se detiene y deja el trabajo al viewObserver) ── */
  function startAuthPolling() {
    if (WA_AUTH_POLL) return; // ya corriendo
    WA_AUTH_POLL = setInterval(function () {
      syncWaFabVisibility();
      // Una vez autenticado ya no necesitamos el poll;
      // el viewObserver cubre los cambios de vista posteriores
      if (isStaffAuthed()) {
        clearInterval(WA_AUTH_POLL);
        WA_AUTH_POLL = null;
      }
    }, 600);
  }

  /* ── Toggle del modo ── */
  function toggleWaMode() {
    if (WA_ACTIVE) {
      deactivateWaMode();
    } else {
      activateWaMode();
    }
  }

  function activateWaMode() {
    WA_ACTIVE = true;
    WA_SELECTED.clear();

    var fab = getOrCreateFab();
    var bar = getOrCreateWaBar();

    fab.classList.add('active');
    fab.querySelector('.wa-fab-label').textContent = 'Salir de WhatsApp';
    bar.classList.remove('hidden');
    updateWaBar();
    paintWaSeats();

    if (typeof toast === 'function') {
      toast('Tocá los asientos ocupados para seleccionarlos');
    }
  }

  function deactivateWaMode() {
    WA_ACTIVE = false;
    WA_SELECTED.clear();

    var fab = document.getElementById('btnWaMode');
    var bar = document.getElementById('waActionBar');

    if (fab) {
      fab.classList.remove('active');
      fab.querySelector('.wa-fab-label').textContent = 'Modo WhatsApp';
    }
    if (bar) bar.classList.add('hidden');

    unpaintWaSeats();
  }

  /* ── Asientos ── */
  function getStaffSeats() {
    return Array.from(
      document.querySelectorAll('#controlCroquis .seat, #controlCroquisMulti .seat')
    );
  }

  function paintWaSeats() {
    getStaffSeats().forEach(function (btn) {
      if ((btn.getAttribute('data-status') || '').toLowerCase() !== 'ocupado') return;
      btn.classList.add('wa-selectable');
      btn.addEventListener('click', onWaSeatClick, true);
    });
  }

  function unpaintWaSeats() {
    getStaffSeats().forEach(function (btn) {
      btn.classList.remove('wa-selectable', 'wa-chosen');
      btn.removeEventListener('click', onWaSeatClick, true);
    });
  }

  function onWaSeatClick(ev) {
    if (!WA_ACTIVE) return;
    ev.stopImmediatePropagation();
    ev.preventDefault();

    var btn    = ev.currentTarget;
    var status = (btn.getAttribute('data-status') || '').toLowerCase();
    if (status !== 'ocupado') return;

    var code  = norm(btn.getAttribute('data-code') || '');
    var sheet = btn.getAttribute('data-sheet') || '';

    if (WA_SELECTED.has(code)) {
      WA_SELECTED.delete(code);
      btn.classList.remove('wa-chosen');
    } else {
      var numEl    = btn.querySelector('.num');
      var fullEl   = btn.querySelector('.occ-full');
      WA_SELECTED.set(code, {
        num       : numEl  ? numEl.textContent.trim()  : code,
        pasajero  : fullEl ? fullEl.textContent.trim() : '',
        sheet     : sheet,
        sheetLabel: getFloorLabel(sheet)
      });
      btn.classList.add('wa-chosen');
    }

    updateWaBar();
  }

  /* ── Barra ── */
  function updateWaBar() {
    var count    = WA_SELECTED.size;
    var countEl  = document.getElementById('waBarCount');
    var shareBtn = document.getElementById('waBtnShare');

    if (countEl) {
      countEl.textContent =
        count === 0 ? 'Ningún asiento seleccionado'
        : count === 1 ? '1 asiento seleccionado'
        : count + ' asientos seleccionados';
    }
    if (shareBtn) shareBtn.disabled = (count === 0);
  }

  function waClearSelection() {
    WA_SELECTED.forEach(function (_, code) {
      var btn = document.querySelector(
        '#controlCroquis .seat[data-code="' + code + '"],' +
        '#controlCroquisMulti .seat[data-code="' + code + '"]'
      );
      if (btn) btn.classList.remove('wa-chosen');
    });
    WA_SELECTED.clear();
    updateWaBar();
  }

  /* ── Mensaje y compartir ── */
  function waShare() {
    if (WA_SELECTED.size === 0) return;

    var tripName = (window.CURRENT_TRIP && window.CURRENT_TRIP.name) || '';
    var entries  = Array.from(WA_SELECTED.values());
    var esSolo   = entries.length === 1;

    var nombres = entries
      .map(function (e) { return e.pasajero ? e.pasajero.split(/\s+/)[0] : ''; })
      .filter(Boolean);

    var saludo;
    if      (nombres.length === 0) { saludo = 'Hola,'; }
    else if (nombres.length === 1) { saludo = 'Hola ' + nombres[0] + ','; }
    else if (nombres.length === 2) { saludo = 'Hola ' + nombres[0] + ' y ' + nombres[1] + ','; }
    else {
      saludo = 'Hola ' + nombres.slice(0, -1).join(', ') +
               ' y ' + nombres[nombres.length - 1] + ',';
    }

    var intro = esSolo
      ? 'te facilitamos el asiento que te corresponde'
      : 'les facilitamos los asientos que les corresponden a vos y a tu' +
        (entries.length === 2 ? ' dupla' : 's duplas') + ':';

    var detalle = entries.map(function (e) {
      var linea = '• Asiento ' + e.num + ' — ' + (e.pasajero || '(sin nombre)');
      if (e.sheetLabel) linea += ' (' + e.sheetLabel + ')';
      return linea;
    }).join('\n');

    var mensaje =
      saludo + ' ' + intro +
      (tripName ? ' para el viaje *' + tripName + '*' : '') + ':\n\n' +
      detalle + '\n\n¡Buen viaje! 🚌';

    if (navigator.share) {
      navigator.share({ text: mensaje }).catch(function () {});
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(mensaje), '_blank');
    }
  }

  /* ── Re-pintar cuando el croquis se recarga (sin loop) ── */
  function scheduleRepaint() {
    if (!WA_ACTIVE || WA_REPAINT_PENDING) return;
    WA_REPAINT_PENDING = true;
    requestAnimationFrame(function () {
      WA_REPAINT_PENDING = false;
      if (!WA_ACTIVE) return;
      WA_SELECTED.clear();
      updateWaBar();
      paintWaSeats();
    });
  }

  var croquisObserver = new MutationObserver(function (mutations) {
    if (mutations.some(function (m) { return m.addedNodes.length > 0; })) {
      scheduleRepaint();
    }
  });

  // Solo clases activas en cada vista → sin subtree
  var viewObserver = new MutationObserver(function () {
    syncWaFabVisibility();
  });

  /* ── Init ── */
  function init() {
    getOrCreateFab();
    getOrCreateWaBar();

    // Observar cambio de vista activa
    document.querySelectorAll('.view').forEach(function (v) {
      viewObserver.observe(v, { attributes: true, attributeFilter: ['class'] });
    });

    // Observar recarga del croquis staff (childList directo, sin subtree)
    ['controlCroquis', 'controlCroquisMulti'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) croquisObserver.observe(el, { childList: true });
    });

    // Primera sync + polling hasta confirmar auth
    syncWaFabVisibility();
    startAuthPolling();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.toggleWaMode   = toggleWaMode;
  window.isWaModeActive = function () { return WA_ACTIVE; };

})();
