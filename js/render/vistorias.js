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
  const decididas = a + rep; // exclui não comparecimento — base p/ taxa aprov./reprov.
  const pct = (x, base) => base ? Math.round(x / base * 100) + '%' : '0%';
  return { t, a, r: rep, n, pa: pct(a, decididas), pr: pct(rep, decididas), pn: pct(n, t) };
}

export function parseRawDate(val) {
  if (typeof val === 'number' && val > 20000) {
    const d = window.XLSX?.SSF?.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const s = String(val || '').trim();
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1]);
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  return null;
}

export function ddmm(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Gráficos SVG (compartilhados com pdf/pages.js) ────────────────────────────

export function buildDonutChart(a, r, n) {
  const total = a + r + n;
  if (!total) return '';
  const W = 300, H = 165, cx = 82, cy = 82, radius = 62, sw = 26;

  function pt(angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  }
  function arcSeg(start, sweep, color, count) {
    if (!count || sweep < 0.1) return '';
    if (count === total) return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
    const [x1, y1] = pt(start), [x2, y2] = pt(start + sweep);
    return `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="butt"/>`;
  }

  const aAng = (a / total) * 360, rAng = (r / total) * 360, nAng = (n / total) * 360;
  const legend = [
    { c: '#217A3C', lbl: 'Taxa Aprovação',     v: a, pct: Math.round(a / total * 100) },
    { c: '#B91C1C', lbl: 'Taxa Reprovação',     v: r, pct: Math.round(r / total * 100) },
    { c: '#C05621', lbl: 'Taxa Não Compareceu', v: n, pct: Math.round(n / total * 100) },
  ];
  let legSvg = '';
  legend.forEach(({ c, lbl, v, pct }, i) => {
    const y = 36 + i * 30;
    legSvg += `<rect x="178" y="${y}" width="10" height="10" fill="${c}" rx="2"/>`;
    legSvg += `<text x="193" y="${y + 9}" font-size="10" fill="#1A2B45" font-weight="600">${lbl}</text>`;
    legSvg += `<text x="193" y="${y + 21}" font-size="8.5" fill="#94a3b8">${v} vistorias · ${pct}%</text>`;
  });

  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block">
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#F1F5F9" stroke-width="${sw}"/>
    ${arcSeg(0, aAng, '#217A3C', a)}
    ${arcSeg(aAng, rAng, '#B91C1C', r)}
    ${arcSeg(aAng + rAng, nAng, '#C05621', n)}
    <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="9" fill="#94a3b8">TOTAL</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="22" fill="#1A2B45" font-weight="800" font-family="Sora,sans-serif">${total}</text>
    ${legSvg}
  </svg>`;
}

export function buildHBarChart(items) {
  if (!items.length) return '';
  const displayed = items.slice(0, 8);
  const W = 500, barH = 22, gap = 9, padL = 155, padR = 95, padT = 8;
  const maxVal = Math.max(1, ...displayed.map(x => x.v));
  const chartW = W - padL - padR;
  const H = padT + displayed.length * (barH + gap) - gap + padT;
  let bars = '';
  displayed.forEach(({ lbl, v, pct }, i) => {
    const y = padT + i * (barH + gap);
    const bw = (v / maxVal) * chartW;
    const truncLbl = lbl.length > 22 ? lbl.slice(0, 21) + '…' : lbl;
    bars += `<text x="${padL - 8}" y="${y + barH - 6}" text-anchor="end" font-size="9" fill="#475569">${truncLbl}</text>`;
    if (bw > 0) bars += `<rect x="${padL}" y="${y}" width="${bw.toFixed(1)}" height="${barH}" fill="#B91C1C" rx="3"/>`;
    bars += `<text x="${(padL + bw + 7).toFixed(1)}" y="${y + barH - 6}" font-size="9" fill="#B91C1C" font-weight="700">${v} · ${pct}%</text>`;
  });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block">${bars}</svg>`;
}

export function buildStackedBars(groups, W = 800, H = 185, PADbot = 30) {
  if (!groups.length) return '';
  const PAD = { top: 20, right: 16, bottom: PADbot, left: 32 };
  const chartW = W - PAD.left - PAD.right, chartH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(1, ...groups.map(g => g.a + g.r + g.n));
  const groupW = chartW / groups.length;
  const barW = Math.min(50, groupW * 0.65);
  let bars = '', xLabels = '', guides = '';
  for (let i = 1; i <= 4; i++) {
    const y = (PAD.top + chartH - (i / 4) * chartH).toFixed(1);
    guides += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#E2E8F0" stroke-width="0.8"/>`;
    guides += `<text x="${PAD.left - 4}" y="${(+y + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="#94a3b8">${Math.round((i / 4) * maxVal)}</text>`;
  }
  groups.forEach(({ label, label2, a, r, n }, i) => {
    const cx = PAD.left + i * groupW + groupW / 2, bx = cx - barW / 2;
    const ha = (a / maxVal) * chartH, hr = (r / maxVal) * chartH, hn = (n / maxVal) * chartH;
    let by = PAD.top + chartH;
    [[ha, a, '#217A3C'], [hr, r, '#B91C1C'], [hn, n, '#C05621']].forEach(([bh, val, col]) => {
      if (bh > 0) {
        by -= bh;
        bars += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW}" height="${bh.toFixed(1)}" fill="${col}"/>`;
        if (bh > 11) bars += `<text x="${cx.toFixed(1)}" y="${(by + bh / 2 + 4).toFixed(1)}" text-anchor="middle" font-size="8" fill="#fff" font-weight="700">${val}</text>`;
      }
    });
    const yL1 = (H - PADbot + 14).toFixed(1);
    xLabels += `<text x="${cx.toFixed(1)}" y="${yL1}" text-anchor="middle" font-size="8.5" fill="#64748B" font-weight="600">${label}</text>`;
    if (label2) xLabels += `<text x="${cx.toFixed(1)}" y="${(H - PADbot + 25).toFixed(1)}" text-anchor="middle" font-size="7" fill="#94a3b8">${label2}</text>`;
  });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block">${guides}${bars}${xLabels}</svg>`;
}

export function buildLineChart(groups, W = 900, H = 185) {
  if (groups.length < 2) return '';
  const PAD = { top: 22, right: 20, bottom: 50, left: 35 };
  const chartW = W - PAD.left - PAD.right, chartH = H - PAD.top - PAD.bottom;
  const n = groups.length;
  const xp = i => PAD.left + (i / (n - 1)) * chartW;
  const yp = pct => PAD.top + chartH - (pct / 100) * chartH;

  const drawLine = (key, color) => {
    const pts = groups.map((g, i) => `${xp(i).toFixed(1)},${yp(g[key]).toFixed(1)}`).join(' ');
    let out = `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/>`;
    groups.forEach((g, i) => {
      const x = xp(i), y = yp(g[key]);
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${color}" stroke="#fff" stroke-width="1.2"/>`;
      out += `<text x="${x.toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle" font-size="7" fill="${color}" font-weight="700">${g[key]}%</text>`;
    });
    return out;
  };

  let guides = '';
  [0, 25, 50, 75, 100].forEach(pct => {
    const y = yp(pct).toFixed(1);
    guides += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#E2E8F0" stroke-width="0.8"/>`;
    guides += `<text x="${PAD.left - 4}" y="${(+y + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="#94a3b8">${pct}%</text>`;
  });
  let xLabels = '';
  groups.forEach((g, i) => {
    const x = xp(i), y = H - PAD.bottom + 12;
    xLabels += `<text x="${x.toFixed(1)}" y="${y}" text-anchor="end" transform="rotate(-40,${x.toFixed(1)},${y})" font-size="7" fill="#94a3b8">${g.label}</text>`;
  });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block">${guides}${drawLine('pa','#217A3C')}${drawLine('pr','#B91C1C')}${drawLine('pn','#C05621')}${xLabels}</svg>`;
}

// ── Legendas reutilizáveis ────────────────────────────────────────────────────

const barLegend = `<div style="font-size:9px;color:#64748B;margin-bottom:10px;display:flex;gap:14px">
  <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#217A3C;border-radius:2px;display:inline-block"></span>Aprovadas</span>
  <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#B91C1C;border-radius:2px;display:inline-block"></span>Reprovadas</span>
  <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#C05621;border-radius:2px;display:inline-block"></span>Não Compareceu</span>
</div>`;

const lineLegend = `<div style="font-size:9px;color:#64748B;margin-bottom:10px;display:flex;gap:14px">
  <span style="display:flex;align-items:center;gap:4px"><span style="width:20px;height:2px;background:#217A3C;display:inline-block;vertical-align:middle"></span>Aprovação</span>
  <span style="display:flex;align-items:center;gap:4px"><span style="width:20px;height:2px;background:#B91C1C;display:inline-block;vertical-align:middle"></span>Reprovação</span>
  <span style="display:flex;align-items:center;gap:4px"><span style="width:20px;height:2px;background:#C05621;display:inline-block;vertical-align:middle"></span>NC</span>
</div>`;

// ── Construtores de conteúdo (compartilhados entre web preview e PDF) ─────────

export function buildVistTotalContent(vis) {
  const s = calcStats(vis);
  const reprovs = vis.filter(isReprov);
  const motivoMap = {};
  reprovs.forEach(r => {
    const mot = String(fk(r, 'MOTIVO REPROVAÇÃO', 'MOTIVO REPROVACAO', 'MOTIVO') || 'SEM MOTIVO').trim();
    motivoMap[mot] = (motivoMap[mot] || 0) + 1;
  });
  const motivoItems = Object.entries(motivoMap).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([lbl, v]) => ({ lbl, v, pct: reprovs.length ? Math.round(v / reprovs.length * 100) : 0 }));

  return `
    <div class="pk-row pk7" style="margin-bottom:16px">
      <div class="pk pk-azul"><div class="pk-lbl">Total</div><div class="pk-val">${s.t}</div></div>
      <div class="pk pk-verde"><div class="pk-lbl">Aprovadas</div><div class="pk-val">${s.a}</div></div>
      <div class="pk pk-verm"><div class="pk-lbl">Reprovadas</div><div class="pk-val">${s.r}</div></div>
      <div class="pk pk-lrnj"><div class="pk-lbl">Não Comp.</div><div class="pk-val">${s.n}</div></div>
      <div class="pk pk-verde"><div class="pk-lbl">Taxa Aprov.</div><div class="pk-val">${s.pa}</div></div>
      <div class="pk pk-verm"><div class="pk-lbl">Taxa Reprov.</div><div class="pk-val">${s.pr}</div></div>
      <div class="pk pk-lrnj"><div class="pk-lbl">Taxa NC</div><div class="pk-val">${s.pn}</div></div>
    </div>
    <div style="font-size:9px;color:#64748B;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:8px 12px;margin-bottom:16px;line-height:1.5">
      <strong style="color:#217A3C">Taxa Aprov.</strong> e <strong style="color:#B91C1C">Taxa Reprov.</strong> = % sobre vistorias com comparecimento (aprovadas + reprovadas), sem contar não comparecimento &nbsp;·&nbsp;
      <strong style="color:#C05621">Taxa NC</strong> = % de não comparecimento sobre o total de vistorias
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0">
        ${buildDonutChart(s.a, s.r, s.n)}
      </div>
      ${motivoItems.length ? `<div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0">
        <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:11px;color:#1A2B45;margin-bottom:12px">Reprovações por Motivo</div>
        ${buildHBarChart(motivoItems)}
      </div>` : ''}
    </div>`;
}

export function buildVistMesContent(vis) {
  const porMes = {};
  vis.forEach(r => { const m = getMes(r); if (m) { if (!porMes[m]) porMes[m] = []; porMes[m].push(r); } });

  const mesRows = MESES.filter(m => porMes[m]).map(m => {
    const sm = calcStats(porMes[m]);
    return `<tr>
      <td style="font-weight:600;text-transform:capitalize">${m}</td>
      <td style="text-align:center">${sm.t}</td>
      <td style="text-align:center;color:#217A3C;font-weight:700">${sm.a}</td>
      <td style="text-align:center;color:#B91C1C;font-weight:700">${sm.r}</td>
      <td style="text-align:center;color:#C05621;font-weight:700">${sm.n}</td>
      <td style="text-align:center">${sm.pa}</td>
      <td style="text-align:center">${sm.pr}</td>
      <td style="text-align:center">${sm.pn}</td>
    </tr>`;
  }).join('');

  const mesGroups = MESES.filter(m => porMes[m]).map(m => {
    const sm = calcStats(porMes[m]);
    return { label: m.charAt(0).toUpperCase() + m.slice(1, 3), a: sm.a, r: sm.r, n: sm.n };
  });

  return `
    <table class="pt" style="margin-bottom:16px">
      <thead><tr>
        <th>Mês</th>
        <th style="text-align:center">Total</th>
        <th style="text-align:center">Aprov.</th>
        <th style="text-align:center">Reprov.</th>
        <th style="text-align:center">NC</th>
        <th style="text-align:center">Taxa A.</th>
        <th style="text-align:center">Taxa R.</th>
        <th style="text-align:center">Taxa NC</th>
      </tr></thead>
      <tbody>${mesRows}</tbody>
    </table>
    <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0">
      <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:11px;color:#1A2B45;margin-bottom:4px">Vistorias por Mês</div>
      ${barLegend}
      ${buildStackedBars(mesGroups, 800, 170, 28)}
    </div>`;
}

export function buildVistSemContent(vis) {
  const porSem = {};
  vis.forEach(r => { const s = getSem(r); if (s) { if (!porSem[s]) porSem[s] = []; porSem[s].push(r); } });
  const semKeys = Object.keys(porSem).sort((a, b) => Number(a) - Number(b));
  const semKeysExib = semKeys.slice(-15);

  const getRange = sem => {
    const dates = porSem[sem]
      .map(r => parseRawDate(fk(r, 'DATA VISTORIA', 'DATA', 'DT VISTORIA', 'DT_VISTORIA')))
      .filter(Boolean);
    if (!dates.length) return `S${sem}`;
    const minD = new Date(Math.min(...dates)), maxD = new Date(Math.max(...dates));
    return `${ddmm(minD)}-${ddmm(maxD)}`;
  };

  const weekGroups = semKeysExib.map(sem => {
    const ss = calcStats(porSem[sem]);
    return { label: getRange(sem), a: ss.a, r: ss.r, n: ss.n };
  });

  const lineGroups = semKeysExib.map(sem => {
    const ss = calcStats(porSem[sem]);
    return {
      label: getRange(sem),
      pa: ss.t ? Math.round(ss.a / ss.t * 100) : 0,
      pr: ss.t ? Math.round(ss.r / ss.t * 100) : 0,
      pn: ss.t ? Math.round(ss.n / ss.t * 100) : 0,
    };
  });

  const semNote = semKeys.length > 15
    ? `<div style="font-size:9px;color:#64748B;margin-bottom:8px;padding:5px 10px;background:#F1F5F9;border-radius:5px">Exibindo as últimas 15 semanas de ${semKeys.length} registradas.</div>`
    : '';

  return `
    ${semNote}
    <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0;margin-bottom:14px">
      <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:11px;color:#1A2B45;margin-bottom:4px">Vistorias por Semana</div>
      ${barLegend}
      ${buildStackedBars(weekGroups, 950, 185, 45)}
    </div>
    <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0">
      <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:11px;color:#1A2B45;margin-bottom:4px">Taxa de Performance por Semana</div>
      ${lineLegend}
      ${buildLineChart(lineGroups, 950, 185)}
    </div>`;
}

// ── Escala previews (3 páginas) ───────────────────────────────────────────────

function scaleVisPreview() {
  [1, 2, 3].forEach(n => {
    const wrap  = document.getElementById(`visPageWrap${n}`);
    const inner = document.getElementById(`visPageInner${n}`);
    if (!wrap || !inner) return;
    const available = wrap.parentElement?.offsetWidth || wrap.offsetWidth;
    if (!available) return;
    const scale = Math.min(1, available / 1123);
    inner.style.transform = `scale(${scale})`;
    inner.style.transformOrigin = 'top left';
    wrap.style.height = Math.round(inner.offsetHeight * scale) + 'px';
  });
}

// ── Render principal ──────────────────────────────────────────────────────────

export function renderVis() {
  const data = DB.vistorias;
  if (!data.length) return;
  const el = document.getElementById('visContent');

  const porSem = {};
  data.forEach(r => { const s = getSem(r); if (s) { if (!porSem[s]) porSem[s] = []; porSem[s].push(r); } });
  const semKeys = Object.keys(porSem).sort((a, b) => Number(a) - Number(b));

  const pageWrap = (n, ico, titulo, content) =>
    `<div id="visPageWrap${n}" style="position:relative;overflow:hidden;border-radius:10px;box-shadow:0 2px 16px rgba(0,0,0,.08);margin-bottom:16px">
      <div id="visPageInner${n}" class="pdf-page-land" style="max-height:none;overflow:visible">
        <div class="ps">${ico} ${titulo}</div>
        ${content}
      </div>
    </div>`;

  el.innerHTML = `
    ${pageWrap(1, '📊', 'VISÃO TOTAL — VISTORIAS',            buildVistTotalContent(data))}
    ${pageWrap(2, '📅', 'VISÃO MENSAL — EVOLUÇÃO POR MÊS',    buildVistMesContent(data))}
    ${pageWrap(3, '📆', 'EVOLUÇÃO SEMANAL — VISTORIAS POR SEMANA', buildVistSemContent(data))}
    <div class="card" style="margin-top:16px">
      <div class="card-hd">
        <div class="card-ico" style="background:var(--azul)"><i data-lucide="sliders"></i></div>
        <div><div class="card-ttl">Análise por Semana</div><div class="card-sub">Selecione uma semana para ver os indicadores detalhados</div></div>
      </div>
      <div class="filter-bar">
        <label>Semana:</label>
        <select id="semSel">
          ${semKeys.map(s => `<option value="${s}">Semana ${s}</option>`).join('')}
        </select>
      </div>
      <div class="kpi-grid kg4" id="semKpiArea"></div>
    </div>`;

  requestAnimationFrame(scaleVisPreview);
  window.addEventListener('resize', scaleVisPreview);

  if (semKeys.length) {
    const sel = document.getElementById('semSel');
    sel.value = semKeys[semKeys.length - 1];
    renderSemKpi();
    sel.addEventListener('change', renderSemKpi);
  }
  window.lucide?.createIcons();
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
