import { DB } from '../state.js';
import { fk, normKey, fmtDate } from '../utils.js';
import { markDone } from '../nav.js';

const WIDE_COLS = ['DESC', 'OBS', 'RESP', 'AÇÃO', 'ACAO', 'DELIBER'];

function statusDelibTag(val) {
  const s = String(val || '').toLowerCase();
  if (s.includes('conclu')) return `<span class="tag t-conc">Concluído</span>`;
  if (s.includes('andamento')) return `<span class="tag t-and">Em Andamento</span>`;
  return `<span class="tag t-pend">Pendente</span>`;
}

function buildTable(rows, ttl, ico, bg) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const trs = rows.map(r => `<tr>${cols.map(c => {
    const vv = r[c];
    const kk = normKey(c);
    const isWide = WIDE_COLS.some(w => kk.includes(w));
    if (kk === 'STATUS') return `<td style="text-align:center">${statusDelibTag(vv)}</td>`;
    if (kk.includes('PRAZO') || kk.includes('DATA')) return `<td style="text-align:center">${fmtDate(vv)}</td>`;
    if (kk.includes('DELTA')) {
      const nn = Number(vv) || 0;
      return `<td style="text-align:center;font-weight:700;color:${nn < 0 ? 'var(--vermelho)' : 'var(--verde)'}">${vv}</td>`;
    }
    if (isWide) return `<td style="max-width:200px;white-space:normal">${vv || '—'}</td>`;
    return `<td style="text-align:center">${vv || '—'}</td>`;
  }).join('')}</tr>`).join('');

  return `<div class="card">
    <div class="card-hd">
      <div class="card-ico" style="background:${bg}"><i data-lucide="${ico}"></i></div>
      <div><div class="card-ttl">${ttl}</div><div class="card-sub">${rows.length} itens</div></div>
    </div>
    <div class="tbl-wrap"><table class="tbl-prev">
      <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${trs}</tbody>
    </table></div>
  </div>`;
}

export function renderDelib() {
  const data = DB.delib;
  if (!data.length) return;
  const concluido = r => String(fk(r, 'STATUS') || '').toLowerCase().includes('conclu');
  const pend = data.filter(r => !concluido(r));
  const conc = data.filter(concluido);
  document.getElementById('delibContent').innerHTML =
    buildTable(pend, 'Demandas em Aberto', 'clock', '#B45309') +
    buildTable(conc, 'Concluídas', 'check-circle', '#217A3C');
  window.lucide?.createIcons();
  markDone(5);
}
