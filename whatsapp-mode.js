// =============================================
//  MODO WHATSAPP — Staff
// =============================================

(function () {

  var WA_ACTIVE   = false;
  var WA_SELECTED = new Map();

  /* ── Helpers ── */
  function norm(code) {
    return (code || '').toString().replace(/\s+/g,'').trim().toUpperCase();
  }

  function getFloorLabel(sheet) {
    var s = String(sheet || '').toLowerCase();
    if (s.indexOf('alta') >= 0) return 'Planta alta';
    if (s.indexOf('baja') >= 0) return 'Planta baja';
    return null;
  }

  function isStaffAuthed() {
    return typeof CONTROL_AUTH !== 'undefined' && !!CONTROL_AUTH;
  }

  /* ── Referencias a elementos ── */
  function fab() { return document.getElementById('btnWaMode'); }
  function bar() { return document.getElementById('waActionBar'); }

  /* ── Crear FAB ── */
  function createFab() {
    if (document.getElementById('btnWaMode')) return;
    var btn = document.createElement('button');
    btn.id        = 'btnWaMode';
    btn.type      = 'button';
    btn.className = 'wa-fab wa-fab-hidden';
    btn.setAttribute('aria-label', 'Activar modo WhatsApp');
    btn.innerHTML =
      '<span class="wa-fab-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">' +
          '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>' +
          '<path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.532 5.845L.057 23.885a.5.5 0 0 0 .606.606l6.109-1.459A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.9 9.9 0 0 1-5.031-1.37l-.36-.214-3.733.892.924-3.648-.235-.374A9.862 9.862 0 0 1 2.1 12C2.1 6.525 6.525 2.1 12 2.1S21.9 6.525 21.9 12 17.475 21.9 12 21.9z"/>' +
        '</svg>' +
      '</span>' +
      '<span class="wa-fab-label">WhatsApp</span>';
    btn.addEventListener('click', toggleWaMode);
    document.body.appendChild(btn);
  }

  /* ── Crear barra ── */
  function createBar() {
    if (document.getElementById('waActionBar')) return;
    var el = document.createElement('div');
    el.id        = 'waActionBar';
    el.className = 'wa-action-bar hidden';
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="wa-bar-inner">' +
        '<span class="wa-bar-count" id="waBarCount">Ningún asiento seleccionado</span>' +
        '<div class="wa-bar-actions">' +
          '<button type="button" class="btn wa-btn-clear" id="waBtnClear">Limpiar</button>' +
          '<button type="button" class="btn wa-btn-share" id="waBtnShare" disabled>' +
            '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true" style="flex-shrink:0">' +
              '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>' +
              '<path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.532 5.845L.057 23.885a.5.5 0 0 0 .606.606l6.109-1.459A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.9 9.9 0 0 1-5.031-1.37l-.36-.214-3.733.892.924-3.648-.235-.374A9.862 9.862 0 0 1 2.1 12C2.1 6.525 6.525 2.1 12 2.1S21.9 6.525 21.9 12 17.475 21.9 12 21.9z"/>' +
            '</svg>' +
            ' Compartir' +
          '</button>' +
        '</div>' +
      '</div>';
    el.querySelector('#waBtnClear').addEventListener('click', waClearSelection);
    el.querySelector('#waBtnShare').addEventListener('click', waShare);
    document.body.appendChild(el);
  }

  /* ── Visibilidad del FAB ── */
  function showFab() {
    var f = fab();
    if (f) f.classList.remove('wa-fab-hidden');
  }

  function hideFab() {
    var f = fab();
    if (!f) return;
    f.classList.add('wa-fab-hidden');
    if (WA_ACTIVE) deactivate();
  }

  /* ── Toggle ── */
  function toggleWaMode() {
    WA_ACTIVE ? deactivate() : activate();
  }

  function activate() {
    WA_ACTIVE = true;
    WA_SELECTED.clear();
    var f = fab(), b = bar();
    if (f) { f.classList.add('active'); f.querySelector('.wa-fab-label').textContent = 'Salir'; }
    if (b) b.classList.remove('hidden');
    updateBar();
    paintSeats();
    if (typeof toast === 'function') toast('Tocá los asientos ocupados para seleccionarlos');
  }

  function deactivate() {
    WA_ACTIVE = false;
    WA_SELECTED.clear();
    var f = fab(), b = bar();
    if (f) { f.classList.remove('active'); f.querySelector('.wa-fab-label').textContent = 'WhatsApp'; }
    if (b) b.classList.add('hidden');
    unpaintSeats();
  }

  /* ── Asientos ── */
  function getSeats() {
    return Array.from(document.querySelectorAll(
      '#controlCroquis .seat, #controlCroquisMulti .seat'
    ));
  }

  function paintSeats() {
    getSeats().forEach(function(btn) {
      if ((btn.getAttribute('data-status') || '').toLowerCase() !== 'ocupado') return;
      btn.classList.add('wa-selectable');
      btn.addEventListener('click', onSeatClick, true);
    });
  }

  function unpaintSeats() {
    getSeats().forEach(function(btn) {
      btn.classList.remove('wa-selectable', 'wa-chosen');
      btn.removeEventListener('click', onSeatClick, true);
    });
  }

  function onSeatClick(ev) {
    if (!WA_ACTIVE) return;
    ev.stopImmediatePropagation();
    ev.preventDefault();
    var btn   = ev.currentTarget;
    if ((btn.getAttribute('data-status') || '').toLowerCase() !== 'ocupado') return;
    var code  = norm(btn.getAttribute('data-code') || '');
    var sheet = btn.getAttribute('data-sheet') || '';
    if (WA_SELECTED.has(code)) {
      WA_SELECTED.delete(code);
      btn.classList.remove('wa-chosen');
    } else {
      var numEl  = btn.querySelector('.num');
      var nameEl = btn.querySelector('.occ-full');
      WA_SELECTED.set(code, {
        num       : numEl  ? numEl.textContent.trim()  : code,
        pasajero  : nameEl ? nameEl.textContent.trim() : '',
        sheetLabel: getFloorLabel(sheet)
      });
      btn.classList.add('wa-chosen');
    }
    updateBar();
  }

  /* ── Barra ── */
  function updateBar() {
    var n  = WA_SELECTED.size;
    var ce = document.getElementById('waBarCount');
    var sb = document.getElementById('waBtnShare');
    if (ce) ce.textContent =
      n === 0 ? 'Ningún asiento seleccionado' :
      n === 1 ? '1 asiento seleccionado' :
      n + ' asientos seleccionados';
    if (sb) sb.disabled = (n === 0);
  }

  function waClearSelection() {
    WA_SELECTED.forEach(function(_, code) {
      var btn = document.querySelector(
        '#controlCroquis .seat[data-code="'+code+'"],' +
        '#controlCroquisMulti .seat[data-code="'+code+'"]'
      );
      if (btn) btn.classList.remove('wa-chosen');
    });
    WA_SELECTED.clear();
    updateBar();
  }

  /* ── Mensaje ── */
  function waShare() {
    if (WA_SELECTED.size === 0) return;
    var trip    = (window.CURRENT_TRIP && window.CURRENT_TRIP.name) || '';
    var entries = Array.from(WA_SELECTED.values());
    var solo    = entries.length === 1;

    var nombres = entries
      .map(function(e){ return e.pasajero ? e.pasajero.split(/\s+/)[0] : ''; })
      .filter(Boolean);

    var saludo;
    if      (!nombres.length)     saludo = 'Hola,';
    else if (nombres.length === 1) saludo = 'Hola ' + nombres[0] + ',';
    else if (nombres.length === 2) saludo = 'Hola ' + nombres[0] + ' y ' + nombres[1] + ',';
    else saludo = 'Hola ' + nombres.slice(0,-1).join(', ') + ' y ' + nombres[nombres.length-1] + ',';

    var intro = solo
      ? 'te facilitamos el asiento que te corresponde'
      : 'les facilitamos los asientos que les corresponden a vos y a tu' +
        (entries.length === 2 ? ' dupla' : 's duplas') + ':';

    var detalle = entries.map(function(e) {
      var l = '• Asiento ' + e.num + ' — ' + (e.pasajero || '(sin nombre)');
      if (e.sheetLabel) l += ' (' + e.sheetLabel + ')';
      return l;
    }).join('\n');

    var msg = saludo + ' ' + intro +
      (trip ? ' para el viaje *' + trip + '*' : '') +
      ':\n\n' + detalle + '\n\n¡Buen viaje! 🚌';

    if (navigator.share) {
      navigator.share({ text: msg }).catch(function(){});
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
    }
  }

  /* ── Interceptar showView de app.js ──
     Esperamos a que app.js lo defina, luego lo envolvemos.
     Así detectamos cada navegación sin tocar app.js. */
  function interceptShowView() {
    if (typeof window.showView !== 'function') {
      setTimeout(interceptShowView, 50);
      return;
    }
    var _orig = window.showView;
    window.showView = function(id) {
      _orig(id);
      if (id === 'view-control') {
        // Delay mínimo para que CONTROL_AUTH ya esté actualizado
        setTimeout(function() {
          isStaffAuthed() ? showFab() : hideFab();
        }, 80);
      } else {
        hideFab();
      }
    };
  }

  /* ── Init ── */
  function init() {
    createFab();
    createBar();
    interceptShowView();
    // Caso borde: recarga con sesión activa ya en view-control
    var vc = document.getElementById('view-control');
    if (vc && vc.classList.contains('active') && isStaffAuthed()) {
      showFab();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.toggleWaMode   = toggleWaMode;
  window.isWaModeActive = function() { return WA_ACTIVE; };

})();
