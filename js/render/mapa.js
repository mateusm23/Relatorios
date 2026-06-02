import { DB } from '../state.js';
import { fk } from '../utils.js';
import { markDone } from '../nav.js';

// ── Helpers de cor ────────────────────────────────────────────────────────────

function isLightColor(hex) {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

// Resolve cor de uma categoria: DB.categorias (usuário) → fallback hardcoded
export function getCatColors(cat) {
  const s = String(cat || '').toLowerCase();

  const found = DB.categorias.find(c => String(c.name || '').toLowerCase() === s && c.cor);
  if (found) {
    const cor = found.cor.startsWith('#') ? found.cor : '#' + found.cor;
    return { bg: cor, fg: isLightColor(cor) ? '#1A2B45' : '#fff' };
  }

  if ((s.includes('não') || s.includes('nao')) && s.includes('aprov')) return { bg: '#B91C1C', fg: '#fff' };
  if (s.includes('aprov'))    return { bg: '#217A3C', fg: '#fff' };
  if (s.includes('liberado') || s.includes('lib.')) return { bg: '#1A6EE8', fg: '#fff' };
  if (s.includes('reprov'))   return { bg: '#DC2626', fg: '#fff' };
  if (s.includes('restrição') || s.includes('restricao') || s.includes('rest.')) return { bg: '#B91C1C', fg: '#fff' };
  if (s.includes('estoque') || s.includes('est.')) return { bg: '#E2E8F0', fg: '#475569' };
  return { bg: '#F8FAFC', fg: '#94a3b8' };
}

// Mantido para compatibilidade com código legado (CSS classes no fallback)
export function getCatCls(cat, prefix = 'mc') {
  const s = String(cat || '').toLowerCase();
  if (s.includes('aprovou') || s.includes('aprovada') || s.includes('aprov')) return `${prefix}-aprov`;
  if (s.includes('liberado')) return `${prefix}-liberado`;
  if (s.includes('reprov'))   return `${prefix}-reprov`;
  if (s.includes('restrição') || s.includes('restricao')) return `${prefix}-restricao`;
  if (s.includes('estoque') || s.includes('est.')) return `${prefix}-estoque`;
  return `${prefix}-vazio`;
}

export function getCatAbrev(cat) {
  const s = String(cat || '').toLowerCase();
  const found = DB.categorias.find(c => String(c.name || '').toLowerCase() === s && c.abrev);
  if (found) return found.abrev.toUpperCase();
  if (s.includes('aprovou') || s.includes('aprovada')) return 'APROV.';
  if (s.includes('liberado')) return 'LIB.';
  if (s.includes('reprov'))   return 'REPROV.';
  if (s.includes('restrição') || s.includes('restricao')) return 'REST.';
  if (s.includes('estoque')) return 'EST.';
  return String(cat).slice(0, 6).toUpperCase() || '—';
}

// Alias para pages.js (usa getCatColors internamente)
export function catColor(cat) { return getCatColors(cat); }

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

// ── Tamanho adaptativo (Solução B) ────────────────────────────────────────────

const CELL_SIZES = {
  lg: { cell: 'font-size:8px;padding:4px 6px;',   th: 'font-size:8px;padding:5px 7px;'  },
  md: { cell: 'font-size:7px;padding:3px 5px;',   th: 'font-size:7px;padding:4px 5px;'  },
  sm: { cell: 'font-size:6px;padding:2px 4px;',   th: 'font-size:6px;padding:3px 4px;'  },
  xs: { cell: 'font-size:5px;padding:1px 3px;',   th: 'font-size:5px;padding:2px 3px;'  },
};

export function calcCellSize(blocos) {
  let maxUnits = 0, maxFloors = 0;
  Object.values(blocos).forEach(pavs => {
    maxFloors = Math.max(maxFloors, Object.keys(pavs).length);
    Object.values(pavs).forEach(units => {
      maxUnits = Math.max(maxUnits, units.length);
    });
  });
  if (maxUnits > 25 || maxFloors > 35) return 'xs';
  if (maxUnits > 15 || maxFloors > 25) return 'sm';
  if (maxUnits > 10 || maxFloors > 15) return 'md';
  return 'lg';
}

// ── Construtores do mapa (usados aqui e em pdf/pages.js) ─────────────────────

export function buildBlocoCell(bloco, pavs, size = 'lg') {
  const sz = CELL_SIZES[size] || CELL_SIZES.lg;
  const pavNums  = Object.keys(pavs).sort((a, b) => Number(b) - Number(a));
  const allUnids = [...new Set(Object.values(pavs).flatMap(a => a.map(u => u.unid)))].sort();

  let html = `<div>
    <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:10px;color:#1A2B45;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">${bloco}</div>
    <table class="pm-tbl">
      <thead><tr>
        <th style="${sz.th}">PAV</th>
        ${allUnids.map(u => `<th style="${sz.th}">${u}</th>`).join('')}
      </tr></thead>
      <tbody>`;

  pavNums.forEach(pav => {
    const map = {};
    pavs[pav].forEach(({ unid, cat }) => map[unid] = cat);
    html += `<tr>
      <th style="${sz.th}">${pav}</th>
      ${allUnids.map(u => {
        const { bg, fg } = getCatColors(map[u] || '');
        return `<td style="background:${bg};color:${fg};${sz.cell}">${getCatAbrev(map[u] || '')}</td>`;
      }).join('')}
    </tr>`;
  });

  html += `</tbody></table></div>`;
  return html;
}

export function buildResumoGeral() {
  const cats = {};
  DB.unidades.forEach(r => {
    const cat = String(fk(r, 'CATEGORIA', 'STATUS', 'SITUAÇÃO', 'SITUACAO') || '').trim() || 'SEM CATEGORIA';
    cats[cat] = (cats[cat] || 0) + 1;
  });
  const total = DB.unidades.length;
  const rows = Object.entries(cats)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, qty], i) => {
      const pct = Math.round(qty / total * 100);
      const { bg } = getCatColors(cat);
      const border = bg === '#F8FAFC' ? '1px solid #cbd5e1' : 'none';
      const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${bg};border:${border};flex-shrink:0"></span>`;
      const rowBg = i % 2 === 1 ? 'background:#F8FAFC;' : '';
      const cell = `border:1px solid #E2E8F0;${rowBg}`;
      return `<tr>
        <td style="font-weight:600;font-size:8px;padding:4px 7px;${cell}">
          <div style="display:flex;align-items:center;gap:5px">${dot}${cat.toUpperCase()}</div>
        </td>
        <td style="text-align:center;font-weight:700;font-size:8px;padding:4px 10px;${cell};white-space:nowrap">${qty}</td>
        <td style="text-align:center;font-weight:700;font-size:8px;padding:4px 10px;${cell};white-space:nowrap">${pct}%</td>
      </tr>`;
    }).join('');

  return `<div>
    <table style="border-collapse:collapse;table-layout:auto">
      <thead><tr style="background:#1A2B45">
        <th style="color:#fff;padding:5px 7px;text-align:left;font-size:8px;letter-spacing:.04em;border:1px solid rgba(255,255,255,.15);white-space:nowrap">SITUAÇÃO</th>
        <th style="color:#fff;padding:5px 10px;text-align:center;font-size:8px;border:1px solid rgba(255,255,255,.15);white-space:nowrap">QTD</th>
        <th style="color:#fff;padding:5px 10px;text-align:center;font-size:8px;border:1px solid rgba(255,255,255,.15);white-space:nowrap">%</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ── Legenda dinâmica ──────────────────────────────────────────────────────────

export function buildLegenda() {
  const entries = DB.categorias.length > 0
    ? DB.categorias.map(c => {
        const cor = c.cor ? (c.cor.startsWith('#') ? c.cor : '#' + c.cor) : getCatColors(c.name).bg;
        return { label: c.name, color: cor };
      })
    : [
        { label: 'Aprovou Vistoria', color: '#217A3C' },
        { label: 'Liberado',         color: '#1A6EE8' },
        { label: 'Estoque',          color: '#E2E8F0' },
        { label: 'Restrição',        color: '#B91C1C' },
        { label: 'Reprovado',        color: '#DC2626' },
      ];

  return `<div class="pleg" style="margin-bottom:12px">
    ${entries.map(({ label, color }) => {
      const border = color === '#E2E8F0' ? 'border:1px solid #cbd5e1;' : '';
      return `<div class="pleg-item"><div class="pleg-dot" style="background:${color};${border}"></div>${label}</div>`;
    }).join('')}
  </div>`;
}

// ── Escala a prévia para caber na área disponível ─────────────────────────────

function scaleMapaPreview() {
  const wrap  = document.getElementById('mapaPageWrap');
  const inner = document.getElementById('mapaPageInner');
  if (!wrap || !inner) return;
  const available = wrap.parentElement?.offsetWidth || wrap.offsetWidth;
  if (!available) return;
  const scale = Math.min(1, available / 1123);
  inner.style.transform = `scale(${scale})`;
  inner.style.transformOrigin = 'top left';
  wrap.style.height = Math.round(inner.offsetHeight * scale) + 'px';
}

// ── Render principal ──────────────────────────────────────────────────────────

export function renderMapa() {
  const data = DB.unidades;
  const el   = document.getElementById('mapaContent');
  if (!data.length) return;

  const blocos    = buildBlocos(data);
  const blocoKeys = Object.keys(blocos).sort();
  const size      = calcCellSize(blocos);

  const cells = blocoKeys.map(b => buildBlocoCell(b, blocos[b], size));
  cells.push(buildResumoGeral());

  const grid = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">
    ${cells.map(c => `<div>${c}</div>`).join('')}
  </div>`;

  el.innerHTML = `
    <div id="mapaPageWrap" style="position:relative;overflow:hidden;border-radius:10px;box-shadow:0 2px 16px rgba(0,0,0,.08)">
      <div id="mapaPageInner" class="pdf-page-land" style="max-height:none;overflow:visible">
        <div class="ps">🗺️ MAPA DE ACOMPANHAMENTO — ENTREGAS</div>
        ${buildLegenda()}
        ${grid}
      </div>
    </div>`;

  requestAnimationFrame(scaleMapaPreview);
  window.addEventListener('resize', scaleMapaPreview);
  markDone(2);
}
