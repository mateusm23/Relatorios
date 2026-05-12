import { DB, MESES } from '../state.js';
import { fk } from '../utils.js';
import { markDone } from '../nav.js';

export const getStatus = r => String(fk(r, 'STATUS', 'SITUAÇÃO', 'RESULTADO') || '').trim();
export const isAprov  = r => getStatus(r).toLowerCase().includes('aprov');
export const isReprov = r => getStatus(r).toLowerCase().includes('reprov');
export const isNC     = r => { const s = getStatus(r).toLowerCase(); return (s.includes('não') || s.includes('nao')) && s.includes('compar'); };
export const getMes   = r => String(fk(r, 'MÊS', 'MES', 'MES VISTORIA') || '').toLowerCase().trim();
export const getSem   = r => String(fk(r, 'SEMANA Nº', 'SEMANA N', 'SEMANA', 'SEM') || '').trim();

export function calcStats(data) {
  const t = data.length;
  const a = data.filter(isAprov).length;
  const rep = data.filter(isReprov).length;
  const n = data.filter(isNC).length;
  const pct = x => t ? Math.round(x / t * 100) + '%' : '0%';
  return { t, a, r: rep, n, pa: pct(a), pr: pct(rep), pn: pct(n) };
}

// Gráfico SVG de barras agrupadas por semana
function buildSemChart(porSem, semKeys) {
  const keys = semKeys.slice(-12);
  if (!keys.length) return '';

  const W = 560, H = 150;
  const PAD = { top: 16, right: 10, bottom: 28, left: 28 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(1, ...keys.map(k => porSem[k].length));
  const groupW = chartW / keys.length;
  const barW = Math.min(14, groupW * 0.26);

  let bars = '';
  let xLabels = '';

  keys.forEach((sem, i) => {
    const s = calcStats(porSem[sem]);
    const cx = PAD.left + i * groupW + groupW / 2;

    const bar = (val, offset, color) => {
      if (!val) return;
      const bh = (val / maxVal) * chartH;
      const bx = (cx + offset - barW / 2).toFixed(1);
      const by = (PAD.top + chartH - bh).toFixed(1);
      bars += `<rect x="${bx}" y="${by}" width="${barW}" height="${bh.toFixed(1)}" fill="${color}" rx="2"/>`;
      bars += `<text x="${(cx + offset).toFixed(1)}" y="${(PAD.top + chartH - bh - 3).toFixed(1)}" text-anchor="middle" font-size="7" fill="${color}" font-weight="700">${val}</text>`;
    };

    bar(s.a, -(barW + 1), '#217A3C');
    bar(s.r,  0,           '#B91C1C');
    bar(s.n,  barW + 1,    '#C05621');

    xLabels += `<text x="${cx.toFixed(1)}" y="${(H - 6).toFixed(1)}" text-anchor="middle" font-size="8" fill="#64748B">S${sem}</text>`;
  });

  // linhas guia horizontais
  let guides = '';
  for (let i = 1; i <= 4; i++) {
    const y = (PAD.top + chartH - (i / 4) * chartH).toFixed(1);
    const val = Math.round((i / 4) * maxVal);
    guides += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#E2E8F0" stroke-width="1"/>`;
    guides += `<text x="${PAD.left - 4}" y="${(Number(y) + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="#94a3b8">${val}</text>`;
  }

  return `<div style="margin:8px 0 16px">
    <div style="font-size:10px;font-weight:700;color:var(--cinza);margin-bottom:8px;display:flex;gap:14px">
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#217A3C;border-radius:2px;display:inline-block"></span>Aprovadas</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#B91C1C;border-radius:2px;display:inline-block"></span>Reprovadas</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#C05621;border-radius:2px;display:inline-block"></span>NC</span>
    </div>
    <svg width="100%" viewBox="0 0 ${W} ${H}" style="max-width:${W}px;display:block">
      ${guides}${bars}${xLabels}
    </svg>
  </div>`;
}

export function renderVis() {
  const data = DB.vistorias;
  if (!data.length) return;

  const el = document.getElementById('visContent');
  const total = calcStats(data);

  const porMes = {};
  data.forEach(r => { const m = getMes(r); if (m) { if (!porMes[m]) porMes[m] = []; porMes[m].push(r); } });

  const porSem = {};
  data.forEach(r => { const s = getSem(r); if (s) { if (!porSem[s]) porSem[s] = []; porSem[s].push(r); } });
  const semKeys = Object.keys(porSem).sort((a, b) => Number(a) - Number(b));

  const mesRows = MESES.filter(m => porMes[m]).map(m => {
    const s = calcStats(porMes[m]);
    return `<tr>
      <td style="font-weight:600;text-transform:capitalize">${m}</td>
      <td>${s.t}</td>
      <td style="color:var(--verde);font-weight:700">${s.a}</td>
      <td style="color:var(--vermelho);font-weight:700">${s.r}</td>
      <td style="color:var(--laranja);font-weight:700">${s.n}</td>
      <td>${s.pa}</td><td>${s.pr}</td><td>${s.pn}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
  <div class="card">
    <div class="card-hd"><div class="card-ico" style="background:#217A3C">📊</div>
      <div><div class="card-ttl">Visão Total Acumulado</div><div class="card-sub">${total.t} vistorias</div></div>
    </div>
    <div class="kpi-grid kg7">
      <div class="kpi-box k-azul"><div class="kpi-lbl">Total</div><div class="kpi-val">${total.t}</div></div>
      <div class="kpi-box k-verde"><div class="kpi-lbl">Aprovadas</div><div class="kpi-val">${total.a}</div></div>
      <div class="kpi-box k-vermelho"><div class="kpi-lbl">Reprovadas</div><div class="kpi-val">${total.r}</div></div>
      <div class="kpi-box k-laranja"><div class="kpi-lbl">Não Comp.</div><div class="kpi-val">${total.n}</div></div>
      <div class="kpi-box k-verde"><div class="kpi-lbl">Taxa Aprov.</div><div class="kpi-val">${total.pa}</div></div>
      <div class="kpi-box k-vermelho"><div class="kpi-lbl">Taxa Reprov.</div><div class="kpi-val">${total.pr}</div></div>
      <div class="kpi-box k-laranja"><div class="kpi-lbl">Taxa NC</div><div class="kpi-val">${total.pn}</div></div>
    </div>
  </div>
  <div class="card">
    <div class="card-hd"><div class="card-ico" style="background:var(--azul)">📆</div>
      <div><div class="card-ttl">Evolução Semanal</div><div class="card-sub">Últimas ${Math.min(12, semKeys.length)} semanas</div></div>
    </div>
    ${buildSemChart(porSem, semKeys)}
    <div class="filter-bar">
      <label>Semana:</label>
      <select id="semSel">
        ${semKeys.map(s => `<option value="${s}">Semana ${s}</option>`).join('')}
      </select>
    </div>
    <div class="kpi-grid kg4" id="semKpiArea"></div>
  </div>
  <div class="card">
    <div class="card-hd"><div class="card-ico" style="background:var(--azul2)">📅</div>
      <div><div class="card-ttl">Visão Mensal</div></div>
    </div>
    <div class="tbl-wrap"><table class="tbl-prev">
      <thead><tr><th>Mês</th><th>Total</th><th>Aprov.</th><th>Reprov.</th><th>NC</th><th>Taxa A.</th><th>Taxa R.</th><th>Taxa NC</th></tr></thead>
      <tbody>${mesRows}</tbody>
    </table></div>
  </div>`;

  if (semKeys.length) {
    document.getElementById('semSel').value = semKeys[semKeys.length - 1];
    renderSemKpi();
    document.getElementById('semSel').addEventListener('change', renderSemKpi);
  }
  markDone(3);
}

export function renderSemKpi() {
  const sem = document.getElementById('semSel')?.value || '';
  const porSem = {};
  DB.vistorias.forEach(r => { const s = getSem(r); if (s) { if (!porSem[s]) porSem[s] = []; porSem[s].push(r); } });
  const s = calcStats(porSem[sem] || []);
  document.getElementById('semKpiArea').innerHTML = `
    <div class="kpi-box k-azul"><div class="kpi-lbl">Total Sem. ${sem}</div><div class="kpi-val">${s.t}</div></div>
    <div class="kpi-box k-verde"><div class="kpi-lbl">Aprovadas</div><div class="kpi-val">${s.a}</div></div>
    <div class="kpi-box k-vermelho"><div class="kpi-lbl">Reprovadas</div><div class="kpi-val">${s.r}</div></div>
    <div class="kpi-box k-laranja"><div class="kpi-lbl">Não Comp.</div><div class="kpi-val">${s.n}</div></div>`;
}
