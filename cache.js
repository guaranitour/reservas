// lib/cache.js
import { CACHE_PREFIX } from './constants.js';
export function setCache(key, value, ttlMs) { try { const payload = { value, expires: Date.now() + ttlMs }; localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload)); } catch {} }
export function getCache(key) { try { const raw = localStorage.getItem(CACHE_PREFIX + key); if (!raw) return null; const payload = JSON.parse(raw); if (!payload || typeof payload.expires !== 'number') return null; if (Date.now() > payload.expires) { localStorage.removeItem(CACHE_PREFIX + key); return null; } return payload.value; } catch { return null; } }
export function clearCache(key) { try { localStorage.removeItem(CACHE_PREFIX + key); } catch {} }