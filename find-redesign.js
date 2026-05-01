// =============================================
//  REDISEÑO — Mirá tu asiento (view-find)
//  Reemplaza renderFindFeedback() y
//  renderFindFeedbackMulti() de app.js
// =============================================

/* ── Íconos ── */
function _findSeatSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="6" width="18" height="13" rx="2"/>
    <path d="M3 11h18"/><path d="M8 6V4M16 6V4"/>
    <circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>
  </svg>`;
}

function _findEmptySvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
    <path d="M11 8v4M11 16h.01"/>
  </svg>`;
}

/* ── Reconstruir view-find con el nuevo diseño ── */
function _initFindView() {
  var section = document.getElementById('view-find');
  if (!section || section.dataset.findRedesigned) return;
  section.dataset.findRedesigned = '1';

  var center = section.querySelector('.home-center');
  if (!center) return;

  // Limpiar contenido anterior
  center.innerHTML = '';

  var wrap = document.createElement('div');
  wrap.className = 'find-wrap';

  // Card de búsqueda
  wrap.innerHTML = `
    <div class="find-search-card">
      <label class="find-search-label" for="ciSearch">
        Número de documento
      </label>
      <div class="find-search-row">
        <input
          id="ciSearch"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          placeholder="Ej.: 12345678"
          autocomplete="off"
          enterkeyhint="search"
        />
        <button class="btn primary" type="button" onclick="findByCI()">Buscar</button>
      </div>
    </div>
    <div id="findResultArea"></div>`;

  center.appendChild(wrap);

  // Volver al inicio — botón discreto debajo
  var backBtn = document.createElement('button');
  backBtn.type      = 'button';
  backBtn.className = 'btn ghost btn-icon';
  backBtn.style.cssText = 'margin-top:8px;width:100%;max-width:480px;';
  backBtn.innerHTML =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>' +
    'Volver al inicio';
  backBtn.addEventListener('click', function() { goTripMenu(); });

  var backWrap = document.createElement('div');
  backWrap.style.cssText = 'max-width:480px;margin:0 auto;';
  backWrap.appendChild(backBtn);
  center.appendChild(backWrap);

  // Enter en el input dispara búsqueda
  var input = center.querySelector('#ciSearch');
  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); findByCI(); }
    });
  }
}

/* ── Rediseño de renderFindFeedback (bus convencional) ── */
function renderFindFeedback(nums) {
  // Leer el nombre del pasajero desde SEATS_BY_SHEET (ya cargado por findByCIInSheets)
  var sheet    = CURRENT_TRIP.sheetName;
  var seatsMap = (typeof SEATS_BY_SHEET !== 'undefined' && SEATS_BY_SHEET.get(sheet)) || {};
  var highlights = (typeof HIGHLIGHT_BY_SHEET !== 'undefined' && HIGHLIGHT_BY_SHEET.get(sheet)) || new Set();

  // Buscar nombre del primer asiento encontrado
  var pasajero = '';
  highlights.forEach(function(code) {
    if (!pasajero && seatsMap[code] && seatsMap[code].pasajero) {
      pasajero = seatsMap[code].pasajero;
    }
  });

  _renderFindResults([{
    sheetName : sheet,
    label     : null,
    nums      : nums,
    pasajero  : pasajero,
    highlights: highlights,
    seatsMap  : seatsMap
  }]);
}

/* ── Rediseño de renderFindFeedbackMulti (doble piso) ── */
function renderFindFeedbackMulti() {
  var sections = MULTI_SHEETS.map(function(f) {
    var seatsMap   = SEATS_BY_SHEET.get(f.sheetName)  || {};
    var highlights = HIGHLIGHT_BY_SHEET.get(f.sheetName) || new Set();
    var nums       = NUMS_BY_SHEET.get(f.sheetName)   || [];

    var pasajero = '';
    highlights.forEach(function(code) {
      if (!pasajero && seatsMap[code] && seatsMap[code].pasajero) {
        pasajero = seatsMap[code].pasajero;
      }
    });

    return {
      sheetName : f.sheetName,
      label     : f.label,
      nums      : nums,
      pasajero  : pasajero,
      highlights: highlights,
      seatsMap  : seatsMap
    };
  });

  _renderFindResults(sections);
}

/* ── Render unificado ── */
function _renderFindResults(sections) {
  var area = document.getElementById('findResultArea');
  if (!area) return;
  area.innerHTML = '';

  var totalNums = sections.reduce(function(acc, s) { return acc + s.nums.length; }, 0);

  // Sin resultados
  if (totalNums === 0) {
    area.innerHTML = `
      <div class="find-empty">
        <div class="find-empty-icon">${_findEmptySvg()}</div>
        <div class="find-empty-title">No encontramos tu asiento</div>
        <div class="find-empty-sub">No hay asientos registrados para ese documento en este viaje. Verificá el número e intentá de nuevo.</div>
      </div>`;
    return;
  }

  var resultsDiv = document.createElement('div');
  resultsDiv.className = 'find-results';

  sections.forEach(function(s) {
    if (s.nums.length === 0) return;

    // Etiqueta de planta (solo doble piso)
    if (s.label) {
      var title = document.createElement('div');
      title.className   = 'find-result-section-title';
      title.textContent = s.label;
      resultsDiv.appendChild(title);
    }

    s.nums.forEach(function(num) {
      var card = document.createElement('div');
      card.className = 'find-card';
      card.innerHTML =
        '<div class="find-card-badge">' + _findSeatSvg() + '</div>' +
        '<div class="find-card-info">' +
          '<div class="find-card-num">Asiento ' + num + '</div>' +
          (s.pasajero
            ? '<div class="find-card-name">' + s.pasajero + '</div>'
            : '') +
          (s.label
            ? '<div class="find-card-floor">' + s.label + '</div>'
            : '') +
        '</div>';
      resultsDiv.appendChild(card);
    });
  });

  area.appendChild(resultsDiv);

  // Croquis automático debajo
  var croquisWrap = document.createElement('div');
  croquisWrap.className = 'find-croquis-wrap';

  var croquisTitle = document.createElement('div');
  croquisTitle.className   = 'find-croquis-title';
  croquisTitle.textContent = 'Tu ubicación en el bus';
  croquisWrap.appendChild(croquisTitle);

  // Croquis según tipo de bus
  if (sections.length === 1) {
    // Convencional — usar grid-find existente
    var grid = document.getElementById('grid-find');
    if (!grid) {
      grid = document.createElement('div');
      grid.id        = 'grid-find';
      grid.className = 'grid';
      grid.setAttribute('aria-live', 'polite');
    }
    croquisWrap.appendChild(grid);

    var note = document.createElement('p');
    note.className   = 'croquis-note';
    note.textContent = 'El croquis es referencial. La ubicación exacta puede variar según la unidad.';
    croquisWrap.appendChild(note);

    area.appendChild(croquisWrap);

    // Cargar croquis automáticamente
    showLoading('Cargando croquis…');
    refreshSeats('grid-find', function() {
      hideLoading();
      var mine = document.getElementById('grid-find').querySelector('.seat.mine');
      if (mine) mine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

  } else {
    // Doble piso — construir grids por planta
    var multiContainer = document.createElement('div');
    multiContainer.id = 'multiCroquis';

    sections.forEach(function(s) {
      if (s.nums.length === 0) return;

      var floorWrap = document.createElement('div');
      floorWrap.style.marginBottom = '16px';

      var floorLabel = document.createElement('div');
      floorLabel.className   = 'find-result-section-title';
      floorLabel.textContent = s.label;
      floorWrap.appendChild(floorLabel);

      var gridId = 'grid-find-' + (s.label || s.sheetName).toLowerCase().replace(/\s+/g, '-');
      var grid   = document.createElement('div');
      grid.id        = gridId;
      grid.className = 'grid';
      grid.setAttribute('aria-live', 'polite');
      floorWrap.appendChild(grid);

      multiContainer.appendChild(floorWrap);
    });

    croquisWrap.appendChild(multiContainer);

    var note2 = document.createElement('p');
    note2.className   = 'croquis-note';
    note2.textContent = 'El croquis es referencial. La ubicación exacta puede variar según la unidad.';
    croquisWrap.appendChild(note2);

    area.appendChild(croquisWrap);

    // Construir grids
    showLoading('Cargando croquis…');
    sections.forEach(function(s) {
      if (s.nums.length === 0) return;
      var gridId = 'grid-find-' + (s.label || s.sheetName).toLowerCase().replace(/\s+/g, '-');
      buildGridCustom(gridId, s.seatsMap, s.highlights);
    });
    hideLoading();

    var firstMine = multiContainer.querySelector('.seat.mine');
    if (firstMine) firstMine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else croquisWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ── Limpiar resultados al entrar a la vista ── */
function _clearFindResults() {
  var area  = document.getElementById('findResultArea');
  var input = document.getElementById('ciSearch');
  if (area)  area.innerHTML = '';
  if (input) input.value    = '';
  // Resetear estado global
  if (typeof HIGHLIGHT_CODES   !== 'undefined') HIGHLIGHT_CODES   = new Set();
  if (typeof LAST_FOUND_CODES  !== 'undefined') LAST_FOUND_CODES  = [];
  if (typeof MULTI_SHEETS      !== 'undefined') MULTI_SHEETS      = [];
  if (typeof SEATS_BY_SHEET    !== 'undefined') SEATS_BY_SHEET    = new Map();
  if (typeof HIGHLIGHT_BY_SHEET !== 'undefined') HIGHLIGHT_BY_SHEET = new Map();
  if (typeof NUMS_BY_SHEET     !== 'undefined') NUMS_BY_SHEET     = new Map();
}

/* ── Enganchar al router ── */
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
        _initFindView();
        _clearFindResults();
        // Foco en el input
        var input = document.getElementById('ciSearch');
        if (input) setTimeout(function() { try { input.focus(); } catch(_) {} }, 150);
      });
    }
  };
})();
