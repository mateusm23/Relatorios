import { DB } from '../state.js';
import { fk } from '../utils.js';
import { markDone } from '../nav.js';

export function getCatCls(cat, prefix = 'mc') {
  const s = String(cat || '').toLowerCase();
  if (s.includes('aprovou') || s.includes('aprovada') || s.includes('aprov')) return `${prefix}-aprov`;
  if (s.includes('liberado')) return `${prefix}-liberado`;
  if (s.includes('reprov')) return `${prefix}-reprov`;
  if (s.includes('restrição') || s.includes('restricao')) return `${prefix}-restricao`;
  if (s.includes('estoque') || s.includes('est.')) return `${prefix}-estoque`;
  return `${prefix}-vazio`;
}

export function getCatAbrev(cat) {
  const s = String(cat || '').toLowerCase();
  if (s.includes('aprovou') || s.includes('aprovada')) return 'APROV.';
  if (s.includes('liberado')) return 'LIB.';
  if (s.includes('reprov')) return 'REPROV.';
  if (s.includes('restrição') || s.includes('restricao')) return 'REST.';
  if (s.includes('estoque')) return 'EST.';
  return String(cat).slice(0, 5) || '—';
}

export function buildBlocos(data) {
  const blocos = {};
  data.forEach(r => {
    const bloco = String(fk(r, 'BLOCO') || '').trim();
    const pav   = String(fk(r, 'PAVIMENTO', 'PAV') || '').trim();
    const unid  = String(fk(r, 'UNIDADE', 'APTO') || '').trim();
    const cat   = String(fk(r, 'CATEGORIA', 'STATUS', 'SITUAÇÃO', 'SITUACAO') || '').trim();
    if (!bloco || !unid) return;
    if (!blocos[bloco]) blocos[bloco] = {};
    if (!blocos[bloco][pav]) blocos[bloco][pav] = [];
    blocos[bloco][pav].push({ unid, cat });
  });
  return blocos;
}

export function renderMapa() {
  const data = DB.unidades;
  const el = document.getElementById('mapaContent');
  if (!data.length) return;

  const blocos = buildBlocos(data);
  const legenda = [
    ['#217A3C', 'Aprovou Vistoria'],
    ['#1A6EE8', 'Liberado'],
    ['#E2E8F0', 'Estoque'],
    ['#B91C1C', 'Restrição'],
    ['#DC2626', 'Reprovado']
  ].map(([bg, lbl]) =>
    `<div style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--cinza)">
      <span style="width:12px;height:12px;border-radius:2px;background:${bg};display:inline-block"></span>${lbl}
    </div>`
  ).join('');

  let html = `<div class="card">
    <div class="card-hd">
      <div class="card-ico" style="background:var(--azul2)"><i data-lucide="map"></i></div>
      <div><div class="card-ttl">Mapa de Unidades</div>
      <div class="card-sub">${data.length} unidades · ${Object.keys(blocos).length} bloco(s)</div></div>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">${legenda}</div>`;

  Object.keys(blocos).sort().forEach(bloco => {
    const pavs = blocos[bloco];
    const pavNums = Object.keys(pavs).sort((a, b) => Number(b) - Number(a));
    const allUnids = [...new Set(Object.values(pavs).flatMap(a => a.map(u => u.unid)))].sort();
    html += `<div style="margin-bottom:16px">
      <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:11px;color:var(--azul);margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">${bloco}</div>
      <div class="mapa-scroll"><table class="mapa-tbl">
        <thead><tr><th>PAV</th>${allUnids.map(u => `<th>${u}</th>`).join('')}</tr></thead>
        <tbody>`;
    pavNums.forEach(pav => {
      const map = {};
      pavs[pav].forEach(({ unid, cat }) => map[unid] = cat);
      html += `<tr><th>${pav}</th>${allUnids.map(u =>
        `<td class="${getCatCls(map[u] || '')}">${getCatAbrev(map[u] || '')}</td>`
      ).join('')}</tr>`;
    });
    html += `</tbody></table></div></div>`;
  });

  el.innerHTML = html + '</div>';
  window.lucide?.createIcons();
  markDone(2);
}
