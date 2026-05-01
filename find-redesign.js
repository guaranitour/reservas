// =============================================
//  REDISEÑO — Mirá tu asiento (view-find)
// =============================================

function _findSeatSvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18"/><path d="M8 6V4M16 6V4"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/></svg>';
}

function _findEmptySvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v4M11 16h.01"/></svg>';
}

/* ── Render convencional ── */
function renderFindFeedback(nums) {
  var area = document.getElementById('findResultArea');
  if (!area) return;
  area.innerHTML = '';

  var sheet      = CURRENT_TRIP.sheetName;
  var seatsMap   = SEATS_BY_SHEET.get(sheet) || {};
  var highlights = HIGHLIGHT_BY_SHEET.get(sheet) || new Set();
  var pasajero   = '';
  highlights.forEach(function(code) {
    if (!pasajero && seatsMap[code] && seatsMap[code].pasajero) {
      pasajero = seatsMap[code].pasajero;
    }
  });

  if (!nums || nums.length === 0) {
    area.innerHTML =
      '<div class="find-empty">' +
        '<div class="find-empty-icon">' + _findEmptySvg() + '</div>' +
        '<div class="find-empty-title">No encontramos tu asiento</div>' +
        '<div class="find-empty-sub">No hay asientos registrados para ese documento en este viaje. Verificá el número e intentá de nuevo.</div>' +
      '</div>';
    return;
  }

  // Tarjetas
  var resultsDiv = document.createElement('div');
  resultsDiv.className = 'find-results';
  nums.forEach(function(num) {
    var card = document.createElement('div');
    card.className = 'find-card';
    card.innerHTML =
      '<div class="find-card-badge">' + _findSeatSvg() + '</div>' +
      '<div class="find-card-info">' +
        '<div class="find-card-num">Asiento ' + num + '</div>' +
        (pasajero ? '<div class="find-card-name">' + pasajero + '</div>' : '') +
      '</div>';
    resultsDiv.appendChild(card);
  });
  area.appendChild(resultsDiv);

  // Croquis
  var croquisWrap = document.createElement('div');
  croquisWrap.className = 'find-croquis-wrap';
  croquisWrap.innerHTML = '<div class="find-croquis-title">Tu ubicación en el bus</div>';

  var grid = document.getElementById('grid-find');
  if (grid) { grid.style.display = ''; croquisWrap.appendChild(grid); }

  var note = document.getElementById('findCroquisNote');
  if (note) { note.style.display = ''; croquisWrap.appendChild(note); }

  area.appendChild(croquisWrap);

  showLoading('Cargando croquis…');
  refreshSeats('grid-find', function() {
    hideLoading();
    var mine = document.getElementById('grid-find').querySelector('.seat.mine');
    if (mine) mine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else croquisWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ── Render doble piso ── */
function renderFindFeedbackMulti() {
  var area = document.getElementById('findResultArea');
  if (!area) return;
  area.innerHTML = '';

  var totalNums = 0;
  MULTI_SHEETS.forEach(function(f) {
    totalNums += (NUMS_BY_SHEET.get(f.sheetName) || []).length;
  });

  if (totalNums === 0) {
    area.innerHTML =
      '<div class="find-empty">' +
        '<div class="find-empty-icon">' + _findEmptySvg() + '</div>' +
        '<div class="find-empty-title">No encontramos tu asiento</div>' +
        '<div class="find-empty-sub">No hay asientos registrados para ese documento en este viaje. Verificá el número e intentá de nuevo.</div>' +
      '</div>';
    return;
  }

  // Tarjetas por planta
  var resultsDiv = document.createElement('div');
  resultsDiv.className = 'find-results';

  MULTI_SHEETS.forEach(function(f) {
    var nums       = NUMS_BY_SHEET.get(f.sheetName) || [];
    var seatsMap   = SEATS_BY_SHEET.get(f.sheetName) || {};
    var highlights = HIGHLIGHT_BY_SHEET.get(f.sheetName) || new Set();
    if (nums.length === 0) return;

    var pasajero = '';
    highlights.forEach(function(code) {
      if (!pasajero && seatsMap[code] && seatsMap[code].pasajero) {
        pasajero = seatsMap[code].pasajero;
      }
    });

    var sectionTitle = document.createElement('div');
    sectionTitle.className   = 'find-result-section-title';
    sectionTitle.textContent = f.label;
    resultsDiv.appendChild(sectionTitle);

    nums.forEach(function(num) {
      var card = document.createElement('div');
      card.className = 'find-card';
      card.innerHTML =
        '<div class="find-card-badge">' + _findSeatSvg() + '</div>' +
        '<div class="find-card-info">' +
          '<div class="find-card-num">Asiento ' + num + '</div>' +
          (pasajero ? '<div class="find-card-name">' + pasajero + '</div>' : '') +
          '<div class="find-card-floor">' + f.label + '</div>' +
        '</div>';
      resultsDiv.appendChild(card);
    });
  });

  area.appendChild(resultsDiv);

  // Croquis multi
  var croquisWrap = document.createElement('div');
  croquisWrap.className = 'find-croquis-wrap';
  croquisWrap.innerHTML = '<div class="find-croquis-title">Tu ubicación en el bus</div>';

  var multiContainer = document.getElementById('multiCroquis');
  if (multiContainer) {
    multiContainer.style.display = '';
    croquisWrap.appendChild(multiContainer);
  }

  var note = document.createElement('p');
  note.className   = 'croquis-note';
  note.textContent = 'El croquis es referencial. La ubicación exacta puede variar según la unidad.';
  croquisWrap.appendChild(note);

  area.appendChild(croquisWrap);

  showCroquisForCIMulti();
}

/* ── Limpiar al entrar a la vista ── */
(function waitForShowViewFind() {
  if (typeof window.showView !== 'function') {
    setTimeout(waitForShowViewFind, 50);
    return;
  }
  var _orig = window.showView;
  window.showView = function(id) {
    _orig(id);
    if (id === 'view-find') {
      requestAnimationFrame(function() {
        var area  = document.getElementById('findResultArea');
        var grid  = document.getElementById('grid-find');
        var note  = document.getElementById('findCroquisNote');
        var input = document.getElementById('ciSearch');
        if (area)  area.innerHTML  = '';
        if (grid)  { grid.innerHTML = ''; grid.style.display = 'none'; }
        if (note)  note.style.display = 'none';
        if (input) { input.value = ''; setTimeout(function() { try { input.focus(); } catch(_) {} }, 150); }
      });
    }
  };
})();
