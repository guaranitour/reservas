// =============================================
//  MENÚ HERRAMIENTAS — Panel staff
// =============================================

function toggleToolsMenu() {
  var dropdown = document.getElementById('toolsDropdown');
  var btn      = document.getElementById('btnToolsMenu');
  if (!dropdown) return;

  var isOpen = !dropdown.classList.contains('hidden');
  if (isOpen) {
    closeToolsMenu();
  } else {
    dropdown.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
    // Cerrar al tocar fuera
    setTimeout(function() {
      document.addEventListener('click', _toolsOutsideClick, true);
    }, 0);
  }
}

function closeToolsMenu() {
  var dropdown = document.getElementById('toolsDropdown');
  var btn      = document.getElementById('btnToolsMenu');
  if (dropdown) dropdown.classList.add('hidden');
  if (btn)      btn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', _toolsOutsideClick, true);
}

function _toolsOutsideClick(ev) {
  var wrap = document.getElementById('toolsMenuWrap');
  if (wrap && !wrap.contains(ev.target)) {
    closeToolsMenu();
  }
}

// Cerrar con Escape
document.addEventListener('keydown', function(ev) {
  if (ev.key === 'Escape') closeToolsMenu();
});
