// =============================================
//  MODO WHATSAPP — Staff
//  Permite seleccionar asientos y compartir
//  los datos del pasajero por WhatsApp.
// =============================================

(function () {

  /* ── Estado del modo ── */
  var WA_ACTIVE = false;
  var WA_SELECTED = new Map(); // code → { num, pasajero, sheet, sheetLabel }

  /* ── Helpers ── */
  function norm(code) {
    return (code || '').toString().replace(/\s+/g, '').trim().toUpperCase();
  }

  function getFloorLabel(sheetName) {
    var s = String(sheetName || '').toLowerCase();
    if (s.indexOf('alta') >= 0) return 'Planta alta';
    if (s.indexOf('baja') >= 0) return 'Planta baja';
    return null; // bus convencional → no mostrar planta
  }

  /* ── Crear / obtener el botón flotante ── */
  function getOrCreateFab() {
    var existing = document.getElementById('btnWaMode');
    if (existing) return existing;

    var fab = document.createElement('button');
    fab.id = 'btnWaMode';
    fab.type = 'button';
    fab.className = 'wa-fab';
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

  /* ── Barra flotante de selección ── */
  function getOrCreateWaBar() {
    var existing = document.getElementById('waActionBar');
    if (existing) return existing;

    var bar = document.createElement('div');
    bar.id = 'waActionBar';
    bar.className = 'wa-action-bar hidden';
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML =
      '<div class="wa-bar-inner">' +
        '<span class="wa-bar-count" id="waBarCount">0 seleccionados</span>' +
        '<div class="wa-bar-actions">' +
          '<button type="button" class="btn wa-btn-clear" id="waBtnClear" onclick="window.waClearSelection()">Limpiar</button>' +
          '<button type="button" class="btn wa-btn-share" id="waBtnShare" onclick="window.waShare()">' +
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

    document.body.appendChild(bar);
    return bar;
  }

  /* ── Toggle del modo ── */
  function toggleWaMode() {
    WA_ACTIVE = !WA_ACTIVE;
    WA_SELECTED.clear();

    var fab = getOrCreateFab();
    var bar = getOrCreateWaBar();

    if (WA_ACTIVE) {
      fab.classList.add('active');
      fab.querySelector('.wa-fab-label').textContent = 'Salir de WhatsApp';
      bar.classList.remove('hidden');
      updateWaBar();
      paintWaSeats();
      // pequeño toast de instrucción
      if (typeof toast === 'function') toast('Tocá los asientos ocupados para seleccionarlos');
    } else {
      fab.classList.remove('active');
      fab.querySelector('.wa-fab-label').textContent = 'Modo WhatsApp';
      bar.classList.add('hidden');
      unpaintWaSeats();
    }
  }

  /* ── Pintar / despintar asientos en modo WA ── */
  function paintWaSeats() {
    var seats = getStaffSeats();
    seats.forEach(function (btn) {
      var status = (btn.getAttribute('data-status') || '').toLowerCase();
      if (status !== 'ocupado') return;
      btn.classList.add('wa-selectable');
      btn.addEventListener('click', onWaSeatClick, true);
    });
  }

  function unpaintWaSeats() {
    var seats = getStaffSeats();
    seats.forEach(function (btn) {
      btn.classList.remove('wa-selectable', 'wa-chosen');
      btn.removeEventListener('click', onWaSeatClick, true);
    });
  }

  function getStaffSeats() {
    return Array.from(
      document.querySelectorAll('#controlCroquis .seat, #controlCroquisMulti .seat')
    );
  }

  /* ── Click en asiento dentro del modo WA ── */
  function onWaSeatClick(ev) {
    if (!WA_ACTIVE) return;
    ev.stopImmediatePropagation(); // evitar tooltip del modo edición

    var btn = ev.currentTarget;
    var status = (btn.getAttribute('data-status') || '').toLowerCase();
    if (status !== 'ocupado') return;

    var code = norm(btn.getAttribute('data-code') || '');
    var sheet = btn.getAttribute('data-sheet') || '';

    if (WA_SELECTED.has(code)) {
      WA_SELECTED.delete(code);
      btn.classList.remove('wa-chosen');
    } else {
      // Extraer datos del asiento
      var numEl = btn.querySelector('.num');
      var fullEl = btn.querySelector('.occ-full');
      var num = numEl ? numEl.textContent.trim() : code;
      var pasajero = fullEl ? fullEl.textContent.trim() : '';

      WA_SELECTED.set(code, {
        num: num,
        pasajero: pasajero,
        sheet: sheet,
        sheetLabel: getFloorLabel(sheet)
      });
      btn.classList.add('wa-chosen');
    }

    updateWaBar();
  }

  /* ── Actualizar barra ── */
  function updateWaBar() {
    var count = WA_SELECTED.size;
    var countEl = document.getElementById('waBarCount');
    var shareBtn = document.getElementById('waBtnShare');

    if (countEl) {
      countEl.textContent =
        count === 0 ? 'Ningún asiento seleccionado'
        : count === 1 ? '1 asiento seleccionado'
        : count + ' asientos seleccionados';
    }
    if (shareBtn) {
      shareBtn.disabled = count === 0;
    }
  }

  /* ── Limpiar selección ── */
  window.waClearSelection = function () {
    WA_SELECTED.forEach(function (_, code) {
      var btn = document.querySelector(
        '#controlCroquis .seat[data-code="' + code + '"], ' +
        '#controlCroquisMulti .seat[data-code="' + code + '"]'
      );
      if (btn) btn.classList.remove('wa-chosen');
    });
    WA_SELECTED.clear();
    updateWaBar();
  };

  /* ── Construir y compartir el mensaje ── */
  window.waShare = function () {
    if (WA_SELECTED.size === 0) return;

    var tripName = (window.CURRENT_TRIP && window.CURRENT_TRIP.name) || '';
    var entries = Array.from(WA_SELECTED.values());
    var esSolo = entries.length === 1;

    // Nombres de los pasajeros para el saludo
    var nombres = entries
      .map(function (e) { return e.pasajero ? e.pasajero.split(/\s+/)[0] : ''; })
      .filter(Boolean);

    var saludo = '';
    if (nombres.length === 1) {
      saludo = 'Hola ' + nombres[0] + ',';
    } else if (nombres.length === 2) {
      saludo = 'Hola ' + nombres[0] + ' y ' + nombres[1] + ',';
    } else if (nombres.length > 2) {
      var ultimos = nombres.slice(0, -1).join(', ');
      saludo = 'Hola ' + ultimos + ' y ' + nombres[nombres.length - 1] + ',';
    } else {
      saludo = 'Hola,';
    }

    // Cuerpo del mensaje
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
      detalle + '\n\n' +
      '¡Buen viaje! 🚌';

    if (navigator.share) {
      navigator.share({ text: mensaje }).catch(function () {});
    } else {
      // Fallback: abrir WhatsApp Web directamente
      var encoded = encodeURIComponent(mensaje);
      window.open('https://wa.me/?text=' + encoded, '_blank');
    }
  };

  /* ── Exponer toggle para usar desde botones externos ── */
  window.toggleWaMode = toggleWaMode;
  window.isWaModeActive = function () { return WA_ACTIVE; };

  /* ── Mostrar/ocultar FAB según la vista activa ── */
  function syncWaFabVisibility() {
    var fab = document.getElementById('btnWaMode');
    if (!fab) return;
    var controlVisible =
      document.getElementById('view-control') &&
      document.getElementById('view-control').classList.contains('active');

    // Solo mostrar si hay staff autenticado y estamos en la vista de control
    var staffOk = typeof CONTROL_AUTH !== 'undefined' && CONTROL_AUTH;

    if (staffOk && controlVisible) {
      fab.classList.remove('wa-fab-hidden');
    } else {
      fab.classList.add('wa-fab-hidden');
      // Si se ocultó con modo activo, desactivar limpiamente
      if (WA_ACTIVE) toggleWaMode();
    }
  }

  /* ── Observar cambios de vista (MutationObserver) ── */
  var observer = new MutationObserver(function () {
    syncWaFabVisibility();
    // Si el croquis se re-renderizó con el modo activo, re-pintar
    if (WA_ACTIVE) {
      unpaintWaSeats();
      WA_SELECTED.clear();
      updateWaBar();
      paintWaSeats();
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    getOrCreateFab();
    getOrCreateWaBar();
    syncWaFabVisibility();

    var app = document.getElementById('app');
    if (app) {
      observer.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    // También observar los contenedores del croquis staff directamente
    ['controlCroquis', 'controlCroquisMulti'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el, { childList: true, subtree: false });
    });
  });

})();
