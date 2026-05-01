// =============================================
//  REDISEÑO — Mirá tu asiento (view-find)
// =============================================

function _findSeatSvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18"/><path d="M8 6V4M16 6V4"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/></svg>';
}

function _findEmptySvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v4M11 16h.01"/></svg>';
}

/* ── Reconstruir view-find con el nuevo diseño ── */
function _initFindView() {
  var section = document.getElementById('view-find');
  if (!section || section.dataset.findRedesigned) return;
  section.dataset.findRedesigned = '1';

  var center = section.querySelector('.home-center');
  if (!center) return;
  center.innerHTML = '';

  /* Estructura que app.js espera — IDs originales preservados,
     pero dentro de un diseño nuevo */
  center.innerHTML = `
    <div class="find-wrap">

      <!-- Card de búsqueda -->
      <div class="find-search-card">
        <label class="find-search-label" for="ciSearch">Número de documento</label>
        <div class="find-search-row">
          <input id="ciSearch" type="text" inputmode="numeric" pattern="[0-9]*"
            placeholder="Ej.: 12345678" autocomplete="off" enterkeyhint="search"/>
          <button class="btn primary" type="button" id="btnFindSearch">Buscar</button>
        </div>
      </div>

      <!-- Área de resultados (manejada por renderFindFeedback / renderFindFeedbackMulti) -->
      <div id="findResultArea"></div>

      <!-- IDs que app.js requiere — ocultos, el rediseño los usa como fuente de datos -->
      <div id="findFeedback"      style="display:none" aria-hidden="true">
        <div id="findNums"></div>
        <button id="btnShowCroquis" disabled></button>
      </div>
      <div id="multiFeedback"     style="display:none" aria-hidden="true">
        <div id="multiNums"></div>
        <button id="btnShowCroquisMulti" disabled></button>
      </div>
      <div id="multiCroquis" style="display:none" aria-hidden="true"></div>

      <!-- Croquis convencional — app.js escribe aquí -->
      <div id="grid-find" class="grid" aria-live="polite" style="display:none"></div>
      <p class="croquis-note" id="findCroquisNote" style="display:none">
        El croquis es referencial. La ubicación exacta puede variar según la unidad.
      </p>

      <!-- Volver -->
      <div style="max-width:480px;margin:8px auto 0;">
        <button type="button" class="btn ghost btn-icon" id="btnFindBack" style="width:100%">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
          Volver al inicio
        </button>
      </div>

    </div>`;

  /* Eventos */
  center.querySelector('#btnFindSearch').addEventListener('click', function() {
    findByCI();
  });
  center.querySelector('#btnFindBack').addEventListener('click', function() {
    goTripMenu();
  });
  center.querySelector('#ciSearch').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); findByCI(); }
  });
}

/* ── Render visual de resultados (convencional) ── */
function renderFindFeedback(nums) {
  var area = document.getElementById('findResultArea');
  if (!area) return;
  area.innerHTML = '';

  /* Nombre del pasajero */
  var sheet    = CURRENT_TRIP.sheetName;
  var seatsMap = SEATS_BY_SHEET.get(sheet) || {};
  var highlights = HIGHLIGHT_BY_SHEET.get(sheet) || new Set();
  var pasajero = '';
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

  /* Tarjetas de resultado */
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

  /* Croquis — reusar grid-find que ya está en el DOM */
  var croquisWrap = document.createElement('div');
  croquisWrap.className = 'find-croquis-wrap';
  croquisWrap.innerHTML = '<div class="find-croquis-title">Tu ubicación en el bus</div>';

  var grid = document.getElementById('grid-find');
  if (grid) {
    grid.style.display = '';
    croquisWrap.appendChild(grid);
  }

  var note = document.getElementById('findCroquisNote');
  if (note) {
    note.style.display = '';
    croquisWrap.appendChild(note);
  }

  area.appendChild(croquisWrap);

  /* Cargar croquis */
  showLoading('Cargando croquis…');
  refreshSeats('grid-find', function() {
    hideLoading();
    var mine = document.getElementById('grid-find').querySelector('.seat.mine');
    if (mine) mine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else croquisWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ── Render visual de resultados (doble piso) ── */
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

  /* Tarjetas por planta */
  var resultsDiv = document.createElement('div');
  resultsDiv.className = 'find-results';

  MULTI_SHEETS.forEach(function(f) {
    var nums     = NUMS_BY_SHEET.get(f.sheetName) || [];
    var seatsMap = SEATS_BY_SHEET.get(f.sheetName) || {};
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

  /* Croquis — delegar a showCroquisForCIMulti que ya sabe armar los grids */
  var croquisWrap = document.createElement('div');
  croquisWrap.className = 'find-croquis-wrap';
  croquisWrap.innerHTML = '<div class="find-croquis-title">Tu ubicación en el bus</div>';

  /* Contenedor multiCroquis dentro del wrap */
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

  /* Construir croquis multi */
  showCroquisForCIMulti();
}

/* ── Limpiar resultados al entrar ── */
function _clearFindResults() {
  var area  = document.getElementById('findResultArea');
  var input = document.getElementById('ciSearch');
  var grid  = document.getElementById('grid-find');
  var note  = document.getElementById('findCroquisNote');
  if (area)  area.innerHTML  = '';
  if (input) input.value     = '';
  if (grid)  { grid.innerHTML = ''; grid.style.display = 'none'; }
  if (note)  note.style.display = 'none';
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
        var input = document.getElementById('ciSearch');
        if (input) setTimeout(function() { try { input.focus(); } catch(_) {} }, 150);
      });
    }
  };
})();
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
