import { DB } from '../state.js';
import { normKey, fmtDate } from '../utils.js';
import { markDone } from '../nav.js';

const WIDE_COLS = ['DESC', 'OBS', 'ITEM', 'AREA', 'LOCAL'];

function statusChkTag(val) {
  const s = String(val || '').toLowerCase();
  if (s === 'ok' || s.includes('conforme')) return `<span class="tag t-conc">${val || 'OK'}</span>`;
  if (s.includes('pendente'))              return `<span class="tag t-pend">Pendente</span>`;
  if (s.includes('aten'))                  return `<span class="tag t-and">Atenção</span>`;
  if (s.includes('não conf') || s.includes('nao conf')) return `<span class="tag t-reprov">Não Conforme</span>`;
  if (s.includes('parcial'))               return `<span class="tag t-and">Parcial</span>`;
  if (s.includes('n/a'))                   return `<span class="tag" style="background:#E2E8F0;color:#475569">N/A</span>`;
  return `<span class="tag" style="background:#E2E8F0;color:#475569">${val || '—'}</span>`;
}

export function renderChk() {
  const data = DB.checklist;
  if (!data.length) return;
  const cols = Object.keys(data[0]).filter(c => normKey(c) !== 'OCULTAR');
  const trs = data.map(r => `<tr>${cols.map(c => {
    const vv = r[c] || '';
    const kk = normKey(c);
    const isWide = WIDE_COLS.some(w => kk.includes(w));
    if (kk === 'STATUS' || kk === 'SITUAÇÃO') return `<td style="text-align:center">${statusChkTag(vv)}</td>`;
    if (kk === 'DATA' || kk.includes('PRAZO')) return `<td style="text-align:center">${fmtDate(vv)}</td>`;
    if (kk === 'DELTA') {
      const n = Number(vv) || 0;
      const color = n > 0 ? 'var(--laranja)' : n < 0 ? 'var(--verde)' : 'var(--cinza)';
      return `<td style="text-align:center;font-weight:700;color:${color}">${vv !== '' ? vv : '—'}</td>`;
    }
    if (isWide) return `<td>${vv || '—'}</td>`;
    return `<td style="text-align:center">${vv || '—'}</td>`;
  }).join('')}</tr>`).join('');

  document.getElementById('chkContent').innerHTML = `<div class="card">
    <div class="card-hd">
      <div class="card-ico" style="background:#1D4ED8"><i data-lucide="clipboard-check"></i></div>
      <div><div class="card-ttl">Checklist de Área Comum</div><div class="card-sub">${data.length} itens</div></div>
    </div>
    <div class="tbl-wrap"><table class="tbl-prev">
      <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${trs}</tbody>
    </table></div>
  </div>`;
  window.lucide?.createIcons();
  markDone(7);
}
