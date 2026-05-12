import { DB } from '../state.js';
import { fmtK } from '../utils.js';
import { markDone } from '../nav.js';

export function renderMfo() {
  const data = DB.mfo;
  if (!data.length) return;
  const cols = Object.keys(data[0]);
  const rows = data.map((r, i) => `<tr style="${i === 0 ? 'background:var(--azul)' : ''}">
    ${cols.slice(0, 8).map(c => {
      const isNum = typeof r[c] === 'number';
      const isNeg = isNum && r[c] < 0;
      const style = [
        i === 0 ? 'color:#fff;font-weight:700' : '',
        isNum ? 'text-align:right' : '',
        isNeg && i !== 0 ? 'color:var(--vermelho);font-weight:700' : '',
      ].filter(Boolean).join(';');
      return `<td style="${style}">${isNum ? fmtK(r[c]) : r[c] || '—'}</td>`;
    }).join('')}
    ${cols.length > 8 ? `<td style="${i === 0 ? 'color:#fff' : ''}">...</td>` : ''}
  </tr>`).join('');

  document.getElementById('mfoContent').innerHTML = `<div class="card">
    <div class="card-hd">
      <div class="card-ico" style="background:#065F46"><i data-lucide="landmark"></i></div>
      <div><div class="card-ttl">MFO — Monitoramento Financeiro</div>
      <div class="card-sub">${data.length} categorias · PDF em modo paisagem</div></div>
    </div>
    <div class="info"><i data-lucide="info" style="flex-shrink:0;width:14px;height:14px"></i><span>No PDF esta página é gerada em <strong>paisagem (A4 horizontal)</strong> para exibir todas as ${cols.length} colunas.</span></div>
    <div class="tbl-wrap"><table class="tbl-prev">
      <thead><tr>
        ${cols.slice(0, 8).map(c => `<th>${c}</th>`).join('')}
        ${cols.length > 8 ? '<th>...</th>' : ''}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
  window.lucide?.createIcons();
  markDone(6);
}
