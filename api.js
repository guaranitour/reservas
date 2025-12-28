
// api.js — Cliente Frontend para Apps Script (ContentService)
// Arquitectura: Frontend en GitHub Pages -> Backend Apps Script (Web App /exec)
// Autor: Richard + Copilot
// -----------------------------------------------
// Configuración
const BASE_URL = 'https://script.google.com/macros/s/AKfycbz6WeyWOfRGGW35sUUyQesTbUoITSNNLCXMhft-saHaHYwDwHWUa6kMT5Cof1GkuFL2/exec';

// (Opcional) clave de API si decides proteger el backend por un parámetro apiKey
// Pon un valor string (ej. 'SECRETO123') tanto aquí como en el backend (assertApiKey_).
const API_KEY = null; // o 'TU_SECRETO'

// -----------------------------------------------
// Utilidades
const QS = (params = {}) =>
  '?' +
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

async function parseResponse(res) {
  // Apps Script puede responder JSON con content-type variable; intentamos robustamente
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Si no es JSON, devolvemos texto (para diagnósticos)
    return text;
  }
}

function withCommonParams(extra = {}) {
  const base = { api: '1', ...extra };
  if (API_KEY) base.apiKey = API_KEY;
  return base;
}

function getUrl(action, extraParams = {}) {
  const params = withCommonParams({ action, ...extraParams });
  return BASE_URL + QS(params);
}

function postOptions(payloadObj) {
  return {
    method: 'POST',
    redirect: 'follow', // seguir 302/301 típico de Web Apps
    headers: {
      // "simple request" para evitar preflight CORS en la mayoría de navegadores
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payloadObj || {}),
  };
}

// -----------------------------------------------
// Endpoints (GET)
async function apiPing() {
  const url = getUrl('ping');
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`GET ping: ${res.status}`);
  return parseResponse(res); // { ok:true, time: ... }
}

async function apiGetSeats() {
  const url = getUrl('seats');
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`GET seats: ${res.status}`);
  return parseResponse(res); // { ok:true, rows:[...] }
}

async function apiGetSeatsByCi(ci) {
  const url = getUrl('seatsByCi', { ci });
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`GET seatsByCi: ${res.status}`);
  return parseResponse(res); // { ok:true, seats:[...] }
}

async function apiGetLogo() {
  const url = getUrl('logo');
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`GET logo: ${res.status}`);
  return parseResponse(res); // { ok:true, dataUrl/publicUrl }
}

async function apiExportPdf() {
  const url = getUrl('exportPdf');
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`GET exportPdf: ${res.status}`);
  return parseResponse(res); // { ok:true, url }
}

// -----------------------------------------------
// Endpoints (POST)
async function apiReserve(pairs) {
  // pairs = [{ asiento, pasajero, ci }, ...]
  const url = getUrl('reserve');
  const res = await fetch(url, postOptions({ pairs }));
  if (!res.ok) throw new Error(`POST reserve: ${res.status}`);
  return parseResponse(res); // { ok, message, reservados, ... }
}

async function apiMove(sourceCode, targetCode) {
  const url = getUrl('move');
  const res = await fetch(url, postOptions({ sourceCode, targetCode }));
  if (!res.ok) throw new Error(`POST move: ${res.status}`);
  return parseResponse(res); // { ok, message }
}

async function apiFree(code) {
  const url = getUrl('free');
  const res = await fetch(url, postOptions({ code }));
  if (!res.ok) throw new Error(`POST free: ${res.status}`);
  return parseResponse(res); // { ok, message }
}

async function apiLogin(user, pass) {
  const url = getUrl('login');
  const res = await fetch(url, postOptions({ user, pass }));
  if (!res.ok) throw new Error(`POST login: ${res.status}`);
  return parseResponse(res); // { ok:true/false }
}

// -----------------------------------------------
// Exportar de forma opcional en un namespace global (útil para debug desde consola)
window.API = {
  apiPing,
  apiGetSeats,
  apiGetSeatsByCi,
  apiGetLogo,
  apiExportPdf,
  apiReserve,
  apiMove,
  apiFree,
  apiLogin,
};
