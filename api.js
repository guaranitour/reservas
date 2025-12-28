
// api.js — cliente para Apps Script (ContentService)
const BASE_URL = 'https://script.google.com/macros/s/AKfycbxDW5qcev7kMJWsgRcNdTubsmRpxOICwHRpM7CAWW_5b2GL0079HNPpVmAGFkCbT_70/exec'; // <-- pega aquí tu URL /exec

// --- GET helpers ---
async function apiGetSeats() {
  const url = `${BASE_URL}?api=1&action=seats`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`GET seats: ${res.status}`);
  return res.json(); // { ok, rows:[...] }
}

async function apiGetSeatsByCi(ci) {
  const url = `${BASE_URL}?api=1&action=seatsByCi&ci=${encodeURIComponent(ci)}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`GET seatsByCi: ${res.status}`);
  return res.json(); // { ok, seats:[...] }
}

async function apiExportPdf() {
  const url = `${BASE_URL}?api=1&action=exportPdf`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`GET exportPdf: ${res.status}`);
  return res.json(); // { ok, url }
}

async function apiGetLogo() {
  const url = `${BASE_URL}?api=1&action=logo`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`GET logo: ${res.status}`);
  return res.json(); // { ok, dataUrl/publicUrl }
}

// --- POST helpers (evitando preflight CORS) ---
const postOpts = (obj) => ({
  method: 'POST',
  redirect: 'follow',                 // seguir 302/301 del Web App
  headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // "simple request" sin preflight
  body: JSON.stringify(obj),
});

// Reservar: pairs = [{ asiento, pasajero, ci }, ...]
async function apiReserve(pairs) {
  const url = `${BASE_URL}?api=1&action=reserve`;
  const res = await fetch(url, postOpts({ pairs }));
  if (!res.ok) throw new Error(`POST reserve: ${res.status}`);
  return res.json(); // { ok, message, ... }
}

// Mover pasajero: { sourceCode, targetCode }
async function apiMove(sourceCode, targetCode) {
  const url = `${BASE_URL}?api=1&action=move`;
  const res = await fetch(url, postOpts({ sourceCode, targetCode }));
  if (!res.ok) throw new Error(`POST move: ${res.status}`);
  return res.json();
}

// Liberar: { code }
async function apiFree(code) {
  const url = `${BASE_URL}?api=1&action=free`;
  const res = await fetch(url, postOpts({ code }));
  if (!res.ok) throw new Error(`POST free: ${res.status}`);
  return res.json();
}

// Login control interno
async function apiLogin(user, pass) {
  const url = `${BASE_URL}?api=1&action=login`;
  const res = await fetch(url, postOpts({ user, pass }));
  if (!res.ok) throw new Error(`POST login: ${res.status}`);
  return res.json(); // { ok:true/false }
}
