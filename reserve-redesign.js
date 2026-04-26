// =============================================
//  REDISEÑO — Formulario de reserva y confirmación
//  Reemplaza renderReservePage() y renderConfirmedPage()
//  en app.js, y agrega el confeti.
// =============================================

/* ── Ícono de asiento (SVG inline) ── */
function _seatSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 10V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/>
    <path d="M5 10a2 2 0 0 0-2 2v2h18v-2a2 2 0 0 0-2-2H5z"/>
    <path d="M7 18v2M17 18v2"/>
    <path d="M5 14v4h14v-4"/>
  </svg>`;
}

function _checkSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 6L9 17l-5-5"/>
  </svg>`;
}

/* ── renderReservePage ── */
function renderReservePage() {
  const body  = document.getElementById('reservePageBody');
  const title = document.getElementById('reservePageTitle');
  if (!body) return;

  // Ocultar el título nativo — lo ponemos nosotros dentro del wrap
  if (title) title.style.display = 'none';

  body.innerHTML = '';
  const seats  = Array.from(selected);
  const single = seats.length === 1;
  const tripName = (window.CURRENT_TRIP && window.CURRENT_TRIP.name) || '';

  const wrap = document.createElement('div');
  wrap.className = 'reserve-wrap';

  // Cabecera
  wrap.innerHTML = `
    <div class="reserve-header">
      <div class="reserve-eyebrow">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        ${tripName ? tripName + ' &mdash; ' : ''}${single ? '1 asiento' : seats.length + ' asientos'}
      </div>
      <h2 class="reserve-title">${single ? 'Datos del pasajero' : 'Datos de los pasajeros'}</h2>
      <p class="reserve-subtitle">${single
        ? 'Completá tu nombre y número de documento para confirmar el asiento.'
        : 'Completá los datos de cada pasajero para confirmar los asientos.'
      }</p>
    </div>`;

  // Tarjetas por asiento
  seats.forEach(s => {
    const norm = normalize(s);
    const num  = NUM_LABELS.get(norm) || norm;

    const card = document.createElement('div');
    card.className   = 'reserve-card';
    card.dataset.code = norm;
    card.innerHTML = `
      <div class="reserve-card-header">
        <div class="reserve-seat-badge">${_seatSvg()}</div>
        <div>
          <div class="reserve-seat-label">Asiento ${num}</div>
          <div class="reserve-seat-sub">Completá los datos del pasajero</div>
        </div>
      </div>
      <div class="reserve-fields">
        <label class="reserve-field">
          <span class="reserve-field-label">Nombre y Apellido</span>
          <input class="${single ? '' : 'assign-name'}" id="${single ? 'singleName' : ''}"
            type="text" placeholder="Ej.: María González"
            autocapitalize="words" autocomplete="name" autocorrect="off"/>
        </label>
        <label class="reserve-field">
          <span class="reserve-field-label">Documento</span>
          <input class="${single ? '' : 'assign-ci'}" id="${single ? 'singleCI' : ''}"
            type="text" placeholder="Ej.: 12345678"
            inputmode="numeric" pattern="[0-9]*"/>
        </label>
      </div>`;

    // Solo dígitos en CI
    const ciInput = card.querySelector(single ? '#singleCI' : '.assign-ci');
    if (ciInput) ciInput.addEventListener('input', function() { onlyDigits(this); });

    wrap.appendChild(card);
  });

  body.appendChild(wrap);

  // Mover los botones de acciones al wrap para que queden dentro del flujo
  const actionsEl = document.querySelector('#view-reserve .reserve-actions');
  if (!actionsEl) {
    // Reubicar los botones existentes del HTML dentro del wrap
    const oldActions = document.querySelector('#view-reserve .actions');
    if (oldActions) {
      oldActions.classList.add('reserve-actions');
      oldActions.classList.remove('actions');
      wrap.appendChild(oldActions);
    }
  }

  // Foco en primer campo
  requestAnimationFrame(function() {
    const first = body.querySelector('input');
    if (first) try { first.focus(); } catch(_) {}
  });
}

/* ── renderConfirmedPage ── */
function renderConfirmedPage(pairs) {
  const body = document.getElementById('confirmedPageBody');
  if (!body) return;
  body.innerHTML = '';

  const tripName = (window.CURRENT_TRIP && window.CURRENT_TRIP.name) || '';

  // Estructura principal
  const wrap = document.createElement('div');
  wrap.className = 'confirmed-wrap';

  // Ícono animado + título (sin subtítulo)
  const header = document.createElement('div');
  header.innerHTML = `
    <div class="confirmed-icon-wrap">
      <div class="confirmed-ring"></div>
      <div class="confirmed-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
    </div>
    <h2 class="confirmed-title">¡Reserva confirmada!</h2>`;
  wrap.appendChild(header);

  // Lista de asientos — siempre con createElement, nunca innerHTML +=
  const list = document.createElement('div');
  list.className = 'confirmed-list';

  pairs.forEach(function(p) {
    const num  = NUM_LABELS.get(p.asiento) || p.asiento;
    const card = document.createElement('div');
    card.className = 'confirmed-card';
    card.innerHTML = `
      <div class="confirmed-card-icon">${_checkSvg()}</div>
      <div class="confirmed-card-info">
        <div class="confirmed-card-num">Asiento ${num}</div>
        <div class="confirmed-card-name">${p.pasajero || '—'}</div>
      </div>`;
    list.appendChild(card);
  });

  wrap.appendChild(list);

  // Hint captura — también con createElement
  const hint = document.createElement('div');
  hint.className   = 'confirmed-hint';
  hint.textContent = '📸 Guardá una captura como comprobante';
  wrap.appendChild(hint);

  // Botones
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'confirmed-actions';

  // Botón compartir (solo si el browser lo soporta)
  if (navigator.share) {
    const shareBtn = document.createElement('button');
    shareBtn.type      = 'button';
    shareBtn.className = 'btn success';
    shareBtn.innerHTML = '↑ Compartir reserva';
    shareBtn.addEventListener('click', function() {
      const lines = pairs.map(function(p) {
        const num = NUM_LABELS.get(p.asiento) || p.asiento;
        return 'Asiento ' + num + ' — ' + p.pasajero;
      }).join('\n');
      navigator.share({
        title: tripName ? 'Reserva ' + tripName : 'Reserva confirmada',
        text : (tripName ? tripName + '\n' : '') + lines
      }).catch(function(){});
    });
    actionsDiv.appendChild(shareBtn);
  }

  const backBtn = document.createElement('button');
  backBtn.type      = 'button';
  backBtn.className = 'btn primary';
  backBtn.textContent = 'Volver al inicio';
  backBtn.addEventListener('click', function() { goTripMenu(); });
  actionsDiv.appendChild(backBtn);

  wrap.appendChild(actionsDiv);
  body.appendChild(wrap);

  // Lanzar confeti
  _launchConfetti();
}

/* ── Confeti ── */
function _launchConfetti() {
  // Respetar preferencias de movimiento reducido
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    document.body.appendChild(canvas);
  }

  var ctx    = canvas.getContext('2d');
  var W      = canvas.width  = window.innerWidth;
  var H      = canvas.height = window.innerHeight;
  var pieces = [];
  var colors = ['#2c7be5','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4'];
  var total  = 110;
  var alive  = true;

  for (var i = 0; i < total; i++) {
    pieces.push({
      x    : Math.random() * W,
      y    : -10 - Math.random() * 60,
      r    : 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx   : (Math.random() - .5) * 3,
      vy   : 2.5 + Math.random() * 3.5,
      spin : (Math.random() - .5) * .18,
      angle: Math.random() * Math.PI * 2,
      shape: Math.random() > .5 ? 'rect' : 'circle',
      alpha: 1
    });
  }

  var frame;
  function draw() {
    if (!alive) return;
    ctx.clearRect(0, 0, W, H);
    var allDone = true;
    pieces.forEach(function(p) {
      if (p.y < H + 20) allDone = false;
      p.x     += p.vx;
      p.y     += p.vy;
      p.angle += p.spin;
      p.vy    *= 1.012; // aceleración leve
      if (p.y > H * .7) p.alpha = Math.max(0, p.alpha - .018);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.r, -p.r * .5, p.r * 2, p.r);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r * .7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    if (allDone) {
      alive = false;
      canvas.style.display = 'none';
      return;
    }
    frame = requestAnimationFrame(draw);
  }

  canvas.style.display = '';
  draw();

  // Límite de seguridad — 4 segundos máximo
  setTimeout(function() {
    alive = false;
    cancelAnimationFrame(frame);
    canvas.style.display = 'none';
  }, 4000);
}
