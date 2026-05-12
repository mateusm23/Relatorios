export const v = id => (document.getElementById(id) || {}).value || '';

export const normKey = k => String(k || '').trim().toUpperCase().replace(/[\s\n\r]+/g, ' ');

export const nrow = row => {
  const o = {};
  Object.keys(row).forEach(k => o[normKey(k)] = row[k]);
  return o;
};

export function fk(row, ...keys) {
  for (const k of keys) {
    const nk = normKey(k);
    if (row[nk] !== undefined && row[nk] !== '') return row[nk];
  }
  return '';
}

export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function fmtDate(val) {
  if (!val && val !== 0) return '—';
  if (typeof val === 'number' && val > 20000) {
    const d = window.XLSX.SSF.parse_date_code(val);
    if (d) return `${String(d.d).padStart(2,'0')}/${String(d.m).padStart(2,'0')}/${d.y}`;
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '—';
    return val.toLocaleDateString('pt-BR');
  }
  const s = String(val).trim();
  if (!s || s === '—') return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s + 'T12:00:00');
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('pt-BR');
  }
  return s;
}

export function fmtBRL(val) {
  if (typeof val !== 'number') {
    const n = parseFloat(String(val || '').replace(/[R$\s]/g, '').replace(',', '.'));
    return isNaN(n) ? String(val || '—') : 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }
  return 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// FIX: trata tanto 0.73 (decimal Excel) quanto 73 (já em %)
export function fmtPct(val) {
  if (typeof val === 'number') {
    const pct = val > 1 ? val : val * 100;
    return pct.toFixed(1) + '%';
  }
  const s = String(val || '');
  if (s.includes('%')) return s;
  const n = parseFloat(s);
  return isNaN(n) ? s : n.toFixed(1) + '%';
}

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function fmtK(val) {
  const n = typeof val === 'number' ? val : parseFloat(String(val || '').replace(/[R$\s]/g, '').replace(',', '.'));
  if (isNaN(n)) return String(val || '—');
  const abs = Math.abs(n);
  const fmt = abs >= 1_000_000
    ? 'R$ ' + (abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'M'
    : abs >= 1_000
    ? 'R$ ' + (abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'K'
    : 'R$ ' + abs.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
  return n < 0 ? `(${fmt})` : fmt;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
