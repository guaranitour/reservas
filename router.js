// lib/router.js
export function buildHash(segments){ return '#/' + (segments ?? []).map(s => encodeURIComponent(String(s ?? ''))).join('/'); }
export function setHash(segments){ location.hash = buildHash(segments); }
export function getHashSegments(h){ const raw = String(h ?? location.hash ?? '').replace(/^#\/?/, ''); if (!raw) return []; return raw.split('/').map(p => { try { return decodeURIComponent(p); } catch { return p; } }); }
export function initRouter(onRoute){ window.addEventListener('hashchange', () => onRoute(location.hash), { passive: true }); onRoute(location.hash); }