// =============================================
//  REDISEÑO — Pantallas de inicio
//  Envuelve loadTrips() y el render de view-home
// =============================================

/* SVG del ícono de bus convencional */
function _busSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="6" width="18" height="13" rx="2"/>
    <path d="M3 11h18"/>
    <path d="M8 6V4M16 6V4"/>
    <circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>
    <path d="M3 15h2M19 15h2"/>
  </svg>`;
}

/* SVG del ícono de bus doble piso */
function _doublebusSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M3 12h18M3 8h18"/>
    <circle cx="7.5" cy="21" r="1.5"/><circle cx="16.5" cy="21" r="1.5"/>
  </svg>`;
}

/* SVG flecha derecha */
function _arrowSvg() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>`;
}

/* ── Interceptar loadTrips para rediseñar las tarjetas ── */
(function waitForLoadTrips() {
  if (typeof loadTrips !== 'function') {
    setTimeout(waitForLoadTrips, 50);
    return;
  }

  var _orig = loadTrips;
  window.loadTrips = async function() {
    await _orig();
    _redesignTripCards();
  };
})();

function _redesignTripCards() {
  var list = document.getElementById('tripList');
  if (!list) return;

  Array.from(list.querySelectorAll('.trip-card')).forEach(function(card) {
    // Evitar doble proceso
    if (card.dataset.redesigned) return;
    card.dataset.redesigned = '1';

    /* Leer datos actuales del DOM */
    var h3       = card.querySelector('h3');
    var pill     = card.querySelector('.trip-pill');
    var countdown = card.querySelector('.trip-countdown');
    var footer   = card.querySelector('.actions'); // botón eliminar admin

    var name     = h3     ? h3.textContent.trim()   : '—';
    var pillText = pill   ? pill.textContent.trim()  : '';
    var isDouble = pillText.toLowerCase().indexOf('doble') >= 0;

    /* Reconstruir interior */
    card.innerHTML = '';
    card.classList.add(isDouble ? 'double-floor' : 'single-floor');

    /* Cabecera */
    var head = document.createElement('div');
    head.className = 'trip-head';

    var headLeft = document.createElement('div');
    headLeft.className = 'trip-head-left';

    var iconEl = document.createElement('div');
    iconEl.className = 'trip-bus-icon' + (isDouble ? ' floors-icon' : '');
    iconEl.innerHTML = isDouble ? _doublebusSvg() : _busSvg();

    var nameWrap = document.createElement('div');
    nameWrap.style.cssText = 'min-width:0;flex:1';

    var nameEl = document.createElement('h3');
    nameEl.textContent = name;

    nameWrap.appendChild(nameEl);
    headLeft.appendChild(iconEl);
    headLeft.appendChild(nameWrap);

    var pillEl = document.createElement('span');
    pillEl.className = 'trip-pill' + (isDouble ? ' doble' : '');
    pillEl.textContent = pillText;

    var arrowEl = document.createElement('div');
    arrowEl.className = 'trip-arrow';
    arrowEl.innerHTML = _arrowSvg();

    head.appendChild(headLeft);
    head.appendChild(pillEl);
    head.appendChild(arrowEl);
    card.appendChild(head);

    /* Countdown — conservado intacto dentro de su wrapper */
    if (countdown) {
      var cdWrap = document.createElement('div');
      cdWrap.className = 'trip-countdown-wrap';
      cdWrap.appendChild(countdown);
      card.appendChild(cdWrap);
    }

    /* Botón eliminar (admin) — restaurar al final */
    if (footer) card.appendChild(footer);
  });
}

/* ── Rediseñar view-home (cards Seleccionar / Mirá tu asiento) ── */
function _redesignHomeCards() {
  var cardsEl = document.querySelector('#view-home .cards');
  if (!cardsEl || cardsEl.dataset.redesigned) return;
  cardsEl.dataset.redesigned = '1';
  cardsEl.className = 'action-cards';

  var cards = Array.from(cardsEl.querySelectorAll('.card'));

  /* Tarjeta 1: Seleccionar asiento */
  if (cards[0]) {
    var c1 = cards[0];
    var fn1 = c1.getAttribute('onclick') || 'goSelect()';
    c1.className = 'action-card';
    c1.innerHTML =
      '<div class="action-card-icon select-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="3" y="6" width="18" height="13" rx="2"/>' +
          '<path d="M3 11h18"/><path d="M8 6V4M16 6V4"/>' +
          '<circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>' +
          '<path d="M9 14h6"/>' +
        '</svg>' +
      '</div>' +
      '<div class="action-card-body">' +
        '<div class="action-card-title">Reservar asiento</div>' +
        '<div class="action-card-desc">Elegí tu lugar y confirmá con tu nombre y documento.</div>' +
      '</div>' +
      '<div class="action-card-arrow">' + _arrowSvg() + '</div>';
    c1.setAttribute('onclick', fn1);
  }

  /* Tarjeta 2: Mirá tu asiento */
  if (cards[1]) {
    var c2 = cards[1];
    var fn2 = c2.getAttribute('onclick') || 'goFind()';
    c2.className = 'action-card';
    c2.innerHTML =
      '<div class="action-card-icon find-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="11" cy="11" r="8"/>' +
          '<path d="m21 21-4.35-4.35"/>' +
          '<path d="M11 8v6M8 11h6"/>' +
        '</svg>' +
      '</div>' +
      '<div class="action-card-body">' +
        '<div class="action-card-title">Ver mi asiento</div>' +
        '<div class="action-card-desc">Ingresá tu documento para encontrar tu número y ubicación.</div>' +
      '</div>' +
      '<div class="action-card-arrow">' + _arrowSvg() + '</div>';
    c2.setAttribute('onclick', fn2);
  }
}

/* ── Enganchar al router de vistas ── */
(function waitForShowView2() {
  if (typeof window.showView !== 'function') {
    setTimeout(waitForShowView2, 50);
    return;
  }

  var _origSV = window.showView;
  window.showView = function(id) {
    _origSV(id);
    if (id === 'view-home') {
      requestAnimationFrame(_redesignHomeCards);
    }
    if (id === 'view-choose') {
      // Re-aplicar si las tarjetas se recargaron
      setTimeout(_redesignTripCards, 100);
    }
  };
})();
