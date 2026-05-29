import { DB, MESES } from '../state.js';
import { v, fk, normKey, escapeHtml, fmtDate, fmtBRL, fmtPct } from '../utils.js';
import { buildBlocos, getCatCls, getCatAbrev } from '../render/mapa.js';
import { calcStats, isReprov, getMes, getSem } from '../render/vistorias.js';

function parseRawDate(val) {
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
function ddmm(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ── Helpers compartilhados entre páginas ──────────────────────────────────────

function makeHdr(nome, logoSrc) {
  return (titulo, pgNum, pgTotal) => `
    <div class="ph">
      <div class="ph-left">
        <div class="ph-ico">${logoSrc}</div>
        <div><div class="ph-ttl">${nome}</div><div class="ph-sub">${titulo}</div></div>
      </div>
      <div class="ph-right">
        <div class="ph-sem">Semana ${v('c_sem') || 'XX'}</div>
        <div class="ph-per">${pgNum > 0 ? v('c_ini') ? new Date(v('c_ini')).toLocaleDateString('pt-BR') : '' : ''} ${pgNum > 0 ? '— Pág.' : ''} ${pgNum > 0 ? pgNum + '/' + pgTotal : ''}</div>
      </div>
    </div>`;
}

const sec   = (ico, txt) => `<div class="ps">${ico} ${txt}</div>`;
const hoje  = () => new Date().toLocaleDateString('pt-BR');
const footer = () =>
  `<div class="pf pf-land"><span>Trinus · Gerenciamento de Obras</span><span>Emitido em ${hoje()}</span></div>`;

// ── Contagem antecipada de páginas ────────────────────────────────────────────

export function countPages() {
  let n = 1; // capa
  if (DB.unidades.length) n += 1;
  if (DB.vistorias.length) n += 3;
  if (v('parecer'))        n++;
  if (DB.delib.length) {
    const pend = DB.delib.filter(r => !String(fk(r, 'STATUS') || '').toLowerCase().includes('conclu'));
    const conc = DB.delib.filter(r =>  String(fk(r, 'STATUS') || '').toLowerCase().includes('conclu'));
    n += Math.max(1, Math.ceil(pend.length / 14)) + (conc.length ? Math.ceil(conc.length / 14) : 0);
  }
  if (DB.mfo.length)       n++;
  if (DB.checklist.length) n += Math.ceil(DB.checklist.length / 20);
  if (DB.anexos.some(Boolean)) n++;
  return n;
}

// ── Capa ──────────────────────────────────────────────────────────────────────

function buildCapaPage(semStr, iniStr, fimStr, nome) {
  const avanco = parseInt(v('c_avanco')) || 0;
  const mesAno = v('c_ini')
    ? new Date(v('c_ini') + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
    : `SEMANA ${semStr}`;

  return `<div class="pdf-capa-land">
    <div class="capal-photo">
      ${DB.foto ? `<img src="${DB.foto}">` : `<div class="capal-photo-ph"></div>`}
      <div class="capal-photo-overlay"></div>
    </div>
    <div class="capal-blue"></div>
    <div style="position:absolute;top:38px;left:34px;z-index:5;max-width:170px">
      ${DB.logo
        ? `<img src="${DB.logo}" style="max-height:55px;max-width:170px;object-fit:contain">`
        : `<div style="font-family:'Sora',sans-serif;font-weight:800;font-size:22px;color:#fff;letter-spacing:.06em">TRINUS</div>`}
    </div>
    ${avanco > 0 ? `
    <div style="position:absolute;top:130px;left:34px;max-width:268px;z-index:5">
      <div style="background:rgba(255,255,255,.1);border-radius:10px;padding:11px 14px;border:1px solid rgba(255,255,255,.12)">
        <div style="font-size:8px;font-weight:700;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Avanço de Entregas</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:26px;color:#F5C800">${avanco}%</div>
          <div style="flex:1">
            <div style="background:rgba(255,255,255,.18);border-radius:4px;height:7px;overflow:hidden">
              <div style="width:${avanco}%;height:100%;background:#F5C800;border-radius:4px"></div>
            </div>
            <div style="font-size:7px;color:rgba(255,255,255,.35);margin-top:2px">unid. aprovadas / disponíveis</div>
          </div>
        </div>
      </div>
    </div>` : ''}
    <div class="capal-info">
      <div class="capal-info-ttl">Relatório Semanal de Obra</div>
      ${v('c_obra') ? `<div class="capal-info-sub">Construtora: ${escapeHtml(v('c_obra'))}</div>` : ''}
      <div class="capal-info-div"></div>
      <div class="capal-info-row">${escapeHtml(nome)}</div>
      <div class="capal-info-row-hl">${mesAno}</div>
      <div class="capal-info-row-hl">Semana do dia ${iniStr} a ${fimStr}</div>
      ${v('c_eng') ? `<div style="font-size:9.5px;color:rgba(255,255,255,.45);margin-top:8px">Eng.: ${escapeHtml(v('c_eng'))}</div>` : ''}
    </div>
    <div class="capal-brand">
      <div class="capal-brand-txt">TRINUS · GERENCIAMENTO DE OBRAS</div>
    </div>
    <div class="capal-accent-top"></div>
    <div class="capal-accent-bot"></div>
  </div>`;
}

// ── Mapa de Unidades ──────────────────────────────────────────────────────────

function catColor(cat) {
  const s = String(cat || '').toLowerCase();
  if ((s.includes('não') || s.includes('nao')) && s.includes('aprov')) return { bg: '#B91C1C', fg: '#fff' };
  if (s.includes('aprov')) return { bg: '#217A3C', fg: '#fff' };
  if (s.includes('liberado') || s.includes('lib.')) return { bg: '#1A6EE8', fg: '#fff' };
  if (s.includes('restrição') || s.includes('restricao') || s.includes('rest.')) return { bg: '#B91C1C', fg: '#fff' };
  return { bg: '', fg: '' };
}

function buildResumoGeral() {
  const cats = {};
  DB.unidades.forEach(r => {
    const cat = String(fk(r, 'CATEGORIA', 'STATUS', 'SITUAÇÃO', 'SITUACAO') || '').trim() || 'SEM CATEGORIA';
    cats[cat] = (cats[cat] || 0) + 1;
  });
  const total = DB.unidades.length;
  const rows = Object.entries(cats)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, qty]) => {
      const pct = Math.round(qty / total * 100);
      const { bg, fg } = catColor(cat);
      const cellStyle = bg ? `background:${bg};color:${fg};` : '';
      return `<tr>
        <td style="font-weight:700;font-size:8.5px;padding:5px 8px;${cellStyle}">${cat.toUpperCase()}</td>
        <td style="text-align:center;font-weight:700;font-size:8.5px;padding:5px 8px;${cellStyle}">${qty}</td>
        <td style="text-align:center;font-weight:700;font-size:8.5px;padding:5px 8px;${cellStyle}">${pct}%</td>
      </tr>`;
    }).join('');
  return `<div>
    <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:11px;color:#1A2B45;margin-bottom:7px;text-align:center">Resumo Geral</div>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr style="background:#1A2B45">
        <th style="color:#fff;padding:6px 8px;text-align:left;font-size:8.5px;letter-spacing:.04em">SITUAÇÃO</th>
        <th style="color:#fff;padding:6px 8px;text-align:center;font-size:8.5px">QTD.</th>
        <th style="color:#fff;padding:6px 8px;text-align:center;font-size:8.5px">%</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function buildBlocoCell(bloco, pavs) {
  const pavNums = Object.keys(pavs).sort((a, b) => Number(b) - Number(a));
  const allUnids = [...new Set(Object.values(pavs).flatMap(a => a.map(u => u.unid)))].sort();
  let html = `<div style="margin-bottom:0">
    <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:10px;color:#1A2B45;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">${bloco}</div>
    <table class="pm-tbl">
      <thead><tr><th>PAV</th>${allUnids.map(u => `<th>${u}</th>`).join('')}</tr></thead>
      <tbody>`;
  pavNums.forEach(pav => {
    const map = {};
    pavs[pav].forEach(({ unid, cat }) => map[unid] = cat);
    html += `<tr><th>${pav}</th>${allUnids.map(u =>
      `<td class="${getCatCls(map[u] || '', 'pm')}">${getCatAbrev(map[u] || '')}</td>`
    ).join('')}</tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

function buildMapaPages(hdr, pgStart, total) {
  const pages = [];
  const blocos = buildBlocos(DB.unidades);
  const blocoKeys = Object.keys(blocos).sort();
  const legenda = `<div class="pleg" style="margin-bottom:10px">
    <div class="pleg-item"><div class="pleg-dot" style="background:#217A3C"></div>Aprovou Vistoria</div>
    <div class="pleg-item"><div class="pleg-dot" style="background:#1A6EE8"></div>Liberado</div>
    <div class="pleg-item"><div class="pleg-dot" style="background:#E2E8F0;border:1px solid #cbd5e1"></div>Estoque</div>
    <div class="pleg-item"><div class="pleg-dot" style="background:#B91C1C"></div>Restrição</div>
  </div>`;

  // Build all grid cells: bloco cells + resumo as last cell
  const cells = blocoKeys.map(b => buildBlocoCell(b, blocos[b]));
  cells.push(buildResumoGeral());

  const grid = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">${cells.map(c => `<div>${c}</div>`).join('')}</div>`;
  pages.push({
    landscape: true,
    html: `<div class="pdf-page-land">
      ${hdr('Mapa de Acompanhamento — Entregas', pgStart, total)}
      ${sec('🗺️', 'MAPA DE ACOMPANHAMENTO — ENTREGAS')}
      ${legenda}
      ${grid}
      ${footer()}
    </div>`
  });
  return pages;
}

// ── Gráficos SVG de Vistorias ─────────────────────────────────────────────────

function buildDonutChart(a, r, n) {
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

function buildHBarChart(items) {
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

function buildStackedBars(groups, W = 800, H = 185, PADbot = 30) {
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

function buildLineChart(groups, W = 900, H = 185) {
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

// ── Vistorias: 3 páginas ──────────────────────────────────────────────────────

function buildVistTotalPage(hdr, pg, total) {
  const vis = DB.vistorias;
  const s = calcStats(vis);
  const reprovs = vis.filter(isReprov);
  const motivoMap = {};
  reprovs.forEach(r => {
    const mot = String(fk(r, 'MOTIVO REPROVAÇÃO', 'MOTIVO REPROVACAO', 'MOTIVO') || 'SEM MOTIVO').trim();
    motivoMap[mot] = (motivoMap[mot] || 0) + 1;
  });
  const motivoItems = Object.entries(motivoMap).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([lbl, v]) => ({ lbl, v, pct: reprovs.length ? Math.round(v / reprovs.length * 100) : 0 }));

  return `<div class="pdf-page-land">
    ${hdr('Acompanhamento de Vistorias', pg, total)}
    ${sec('📊', 'VISÃO TOTAL — VISTORIAS')}
    <div class="pk-row pk7" style="margin-bottom:16px">
      <div class="pk pk-azul"><div class="pk-lbl">Total</div><div class="pk-val">${s.t}</div></div>
      <div class="pk pk-verde"><div class="pk-lbl">Aprovadas</div><div class="pk-val">${s.a}</div></div>
      <div class="pk pk-verm"><div class="pk-lbl">Reprovadas</div><div class="pk-val">${s.r}</div></div>
      <div class="pk pk-lrnj"><div class="pk-lbl">Não Comp.</div><div class="pk-val">${s.n}</div></div>
      <div class="pk pk-verde"><div class="pk-lbl">Taxa Aprov.</div><div class="pk-val">${s.pa}</div></div>
      <div class="pk pk-verm"><div class="pk-lbl">Taxa Reprov.</div><div class="pk-val">${s.pr}</div></div>
      <div class="pk pk-lrnj"><div class="pk-lbl">Taxa NC</div><div class="pk-val">${s.pn}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0">
        ${buildDonutChart(s.a, s.r, s.n)}
      </div>
      ${motivoItems.length ? `<div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0">
        <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:11px;color:#1A2B45;margin-bottom:12px">Reprovações por Motivo</div>
        ${buildHBarChart(motivoItems)}
      </div>` : ''}
    </div>
    ${footer()}
  </div>`;
}

function buildVistMesPage(hdr, pg, total) {
  const vis = DB.vistorias;
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

  const legend = `<div style="font-size:9px;color:#64748B;margin-bottom:10px;display:flex;gap:14px">
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#217A3C;border-radius:2px;display:inline-block"></span>Aprovadas</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#B91C1C;border-radius:2px;display:inline-block"></span>Reprovadas</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#C05621;border-radius:2px;display:inline-block"></span>Não Compareceu</span>
  </div>`;

  return `<div class="pdf-page-land">
    ${hdr('Acompanhamento de Vistorias', pg, total)}
    ${sec('📅', 'VISÃO MENSAL — EVOLUÇÃO POR MÊS')}
    <table class="pt" style="margin-bottom:16px">
      <thead><tr><th>Mês</th><th style="text-align:center">Total</th><th style="text-align:center">Aprov.</th><th style="text-align:center">Reprov.</th><th style="text-align:center">NC</th><th style="text-align:center">Taxa A.</th><th style="text-align:center">Taxa R.</th><th style="text-align:center">Taxa NC</th></tr></thead>
      <tbody>${mesRows}</tbody>
    </table>
    <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0">
      <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:11px;color:#1A2B45;margin-bottom:4px">Vistorias por Mês</div>
      ${legend}
      ${buildStackedBars(mesGroups, 800, 170, 28)}
    </div>
    ${footer()}
  </div>`;
}

function buildVistSemPage(hdr, pg, total) {
  const vis = DB.vistorias;
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
      label:  getRange(sem),
      pa: ss.t ? Math.round(ss.a / ss.t * 100) : 0,
      pr: ss.t ? Math.round(ss.r / ss.t * 100) : 0,
      pn: ss.t ? Math.round(ss.n / ss.t * 100) : 0,
    };
  });

  const semNote = semKeys.length > 15
    ? `<div style="font-size:9px;color:#64748B;margin-bottom:8px;padding:5px 10px;background:#F1F5F9;border-radius:5px">Exibindo as últimas 15 semanas de ${semKeys.length} registradas.</div>`
    : '';

  const legend = `<div style="font-size:9px;color:#64748B;margin-bottom:10px;display:flex;gap:14px">
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#217A3C;border-radius:2px;display:inline-block"></span>Aprovadas</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#B91C1C;border-radius:2px;display:inline-block"></span>Reprovadas</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#C05621;border-radius:2px;display:inline-block"></span>Não Compareceu</span>
  </div>`;

  const lineleg = `<div style="font-size:9px;color:#64748B;margin-bottom:10px;display:flex;gap:14px">
    <span style="display:flex;align-items:center;gap:4px"><span style="width:20px;height:2px;background:#217A3C;display:inline-block;vertical-align:middle"></span>Aprovação</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:20px;height:2px;background:#B91C1C;display:inline-block;vertical-align:middle"></span>Reprovação</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:20px;height:2px;background:#C05621;display:inline-block;vertical-align:middle"></span>NC</span>
  </div>`;

  return `<div class="pdf-page-land">
    ${hdr('Acompanhamento de Vistorias', pg, total)}
    ${sec('📆', 'EVOLUÇÃO SEMANAL — VISTORIAS POR SEMANA')}
    ${semNote}
    <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0;margin-bottom:14px">
      <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:11px;color:#1A2B45;margin-bottom:4px">Vistorias por Semana</div>
      ${legend}
      ${buildStackedBars(weekGroups, 950, 185, 45)}
    </div>
    <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0">
      <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:11px;color:#1A2B45;margin-bottom:4px">Taxa de Performance por Semana</div>
      ${lineleg}
      ${buildLineChart(lineGroups, 950, 185)}
    </div>
    ${footer()}
  </div>`;
}

// ── Parecer ───────────────────────────────────────────────────────────────────

function buildParecerPage(hdr, pg, total, semStr, iniStr, fimStr) {
  const parecerTxt = v('parecer');
  const posit = v('positivos');
  const atenc  = v('atencao');
  const encam  = v('encam');

  const parecerHtml = escapeHtml(parecerTxt).replace(/\n/g, '<br>');
  const hasPontos = posit || atenc || encam;
  return `<div class="pdf-page-land">
    ${hdr('Parecer Semanal', pg, total)}
    ${sec('📝', 'PARECER SEMANAL DE VISTORIAS')}
    <div style="font-size:9px;color:#94a3b8;margin-bottom:12px">Semana ${semStr} · ${iniStr} a ${fimStr}</div>
    <div style="display:grid;grid-template-columns:${hasPontos ? '3fr 2fr' : '1fr'};gap:18px">
      <div class="pparecer">${parecerHtml}</div>
      ${hasPontos ? `<div style="display:flex;flex-direction:column;gap:11px">
        ${posit ? `<div style="background:#D4EDDA;border-radius:8px;padding:11px 13px;border-left:3px solid #217A3C">
          <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:9.5px;color:#217A3C;margin-bottom:6px">PONTOS POSITIVOS</div>
          <div style="font-size:9.5px;color:#1A2B45;line-height:1.7;white-space:pre-wrap">${escapeHtml(posit)}</div>
        </div>` : ''}
        ${atenc ? `<div style="background:#FEE2E2;border-radius:8px;padding:11px 13px;border-left:3px solid #B91C1C">
          <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:9.5px;color:#B91C1C;margin-bottom:6px">PONTOS DE ATENÇÃO</div>
          <div style="font-size:9.5px;color:#1A2B45;line-height:1.7;white-space:pre-wrap">${escapeHtml(atenc)}</div>
        </div>` : ''}
        ${encam ? `<div style="background:#EFF6FF;border-radius:8px;padding:11px 13px;border-left:3px solid #1B6FBF">
          <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:9.5px;color:#1B6FBF;margin-bottom:6px">ENCAMINHAMENTOS</div>
          <div style="font-size:9.5px;color:#1A2B45;line-height:1.7;white-space:pre-wrap">${escapeHtml(encam)}</div>
        </div>` : ''}
      </div>` : ''}
    </div>
    ${footer()}
  </div>`;
}

// ── Deliberações ──────────────────────────────────────────────────────────────

function buildDelibPage(rows, cols, titulo, icoPg, bgHdr, hdr, pg, total) {
  const trs = rows.map(r => `<tr>${cols.map(c => {
    const vv = r[c];
    const kk = normKey(c);
    if (kk === 'STATUS') {
      const s = String(vv || '').toLowerCase();
      const cl = s.includes('conclu') ? 'ptag-conc' : s.includes('andamento') ? 'ptag-and' : 'ptag-pend';
      return `<td><span class="ptag ${cl}">${vv || '—'}</span></td>`;
    }
    if (kk.includes('PRAZO') || kk.includes('DATA')) return `<td style="font-size:9px">${fmtDate(vv)}</td>`;
    if (kk.includes('DELTA')) {
      const nn = Number(vv) || 0;
      return `<td style="font-weight:700;color:${nn < 0 ? '#B91C1C' : '#217A3C'};text-align:center">${vv}</td>`;
    }
    return `<td style="white-space:normal;font-size:9px;max-width:160px">${vv || '—'}</td>`;
  }).join('')}</tr>`).join('');

  return `<div class="pdf-page-land">
    ${hdr(titulo.includes('cont') ? 'Deliberações (cont.)' : 'Deliberações', pg, total)}
    ${sec(icoPg, titulo)}
    <table class="pt">
      <thead><tr style="background:${bgHdr}">${cols.map(c => `<th style="white-space:normal;font-size:8.5px">${c}</th>`).join('')}</tr></thead>
      <tbody>${trs}</tbody>
    </table>
    ${footer()}
  </div>`;
}

// ── MFO ───────────────────────────────────────────────────────────────────────

function buildMfoPage(hdr, pg, total) {
  const cols = Object.keys(DB.mfo[0]);
  const mfoRows = DB.mfo.map((r, i) => {
    const isTotal = i === 0;
    return `<tr class="${isTotal ? 'pt-total' : ''}">${cols.map(c => {
      const vv = r[c];
      const kk = normKey(c);
      const isNum = typeof vv === 'number';
      const pctCol = kk.includes('DESVIO') || kk.includes('%');
      const negativo = isNum && vv < 0;
      if (pctCol) {
        const pv = fmtPct(vv);
        const color = isTotal ? (negativo ? '#FCA5A5' : '#F5C800') : (negativo ? '#B91C1C' : '#217A3C');
        return `<td style="text-align:center;font-weight:700;color:${color};font-size:8px">${pv}</td>`;
      }
      if (isNum) {
        const color = isTotal ? 'inherit' : (negativo ? '#B91C1C' : 'inherit');
        return `<td style="text-align:right;font-size:8px;color:${color};white-space:nowrap">${fmtBRL(vv)}</td>`;
      }
      return `<td style="font-size:8.5px;white-space:normal;max-width:120px;font-weight:${isTotal ? '700' : '400'}">${vv || '—'}</td>`;
    }).join('')}</tr>`;
  }).join('');

  return `<div class="pdf-page-land">
    ${hdr('MFO — Monitoramento Financeiro de Obra', pg, total)}
    ${sec('💰', 'MFO — MONITORAMENTO FINANCEIRO DE OBRA')}
    <div style="overflow-x:hidden">
      <table class="pt" style="font-size:8px">
        <thead><tr>${cols.map(c =>
          `<th style="font-size:7.5px;padding:5px;white-space:normal;min-width:${c.length > 15 ? '75px' : '50px'}">${c}</th>`
        ).join('')}</tr></thead>
        <tbody>${mfoRows}</tbody>
      </table>
    </div>
    ${footer()}
  </div>`;
}

// ── Checklist ─────────────────────────────────────────────────────────────────

function buildChecklistPage(chunk, cols, pgLabel, secLabel, hdr, pg, total) {
  const trs = chunk.map(r => `<tr>${cols.map(c => {
    const vv = r[c] || '';
    const kk = normKey(c);
    if (kk === 'STATUS' || kk === 'SITUAÇÃO') {
      const s = String(vv).toLowerCase();
      const cl = s === 'ok' || s.includes('conforme') ? 'ptag-conf'
               : s.includes('pendente') ? 'ptag-pend'
               : s.includes('aten')     ? 'ptag-parc'
               : s.includes('não conf') || s.includes('nao conf') ? 'ptag-nconf'
               : s.includes('parcial')  ? 'ptag-parc'
               : 'ptag-conf';
      return `<td><span class="ptag ${cl}">${vv || 'OK'}</span></td>`;
    }
    if (kk === 'DATA' || kk.includes('PRAZO')) return `<td style="font-size:9px">${fmtDate(vv)}</td>`;
    if (kk === 'DELTA') {
      const n = Number(vv) || 0;
      const color = n > 0 ? '#C05621' : n < 0 ? '#217A3C' : '#64748B';
      return `<td style="text-align:center;font-weight:700;color:${color};font-size:9px">${vv !== '' ? vv : '—'}</td>`;
    }
    return `<td style="white-space:normal;font-size:10px">${vv || '—'}</td>`;
  }).join('')}</tr>`).join('');

  return `<div class="pdf-page-land">
    ${hdr(pgLabel, pg, total)}
    ${sec('☑️', secLabel)}
    <table class="pt">
      <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${trs}</tbody>
    </table>
    ${footer()}
  </div>`;
}

// ── Anexos ────────────────────────────────────────────────────────────────────

function buildAnexosPage(hdr, pg, total) {
  const validos = DB.anexos.map((a, i) => a ? { src: a.src, caption: a.caption, idx: i + 1 } : null).filter(Boolean);
  const grid = validos.map(({ src, caption, idx }) => `
    <div style="break-inside:avoid">
      <div style="font-size:9px;font-weight:700;color:#1A2B45;margin-bottom:4px;font-family:'Sora',sans-serif">Anexo ${idx}${caption ? ' — ' + escapeHtml(caption) : ''}</div>
      <img src="${src}" style="width:100%;border-radius:7px;border:1px solid #CBD5E1;max-height:240px;object-fit:contain;display:block">
    </div>`).join('');
  const obs = v('anexosObs');

  return `<div class="pdf-page-land">
    ${hdr('Quadro de Anexos', pg, total)}
    ${sec('📎', 'QUADRO DE ANEXOS')}
    ${obs ? `<div style="font-size:10px;color:#64748B;margin-bottom:14px;padding:10px 12px;background:#F1F5F9;border-radius:6px;line-height:1.6">${escapeHtml(obs)}</div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${grid}</div>
    ${footer()}
  </div>`;
}

// ── Orquestrador principal ────────────────────────────────────────────────────

export function buildPages(semStr, iniStr, fimStr, nome) {
  const pages = [];
  const total = countPages();

  const logoSrc = DB.logo
    ? `<img src="${DB.logo}" style="width:100%;height:100%;object-fit:contain">`
    : `<div style="width:100%;height:100%;background:var(--amarelo);display:flex;align-items:center;justify-content:center;font-size:14px">🏗️</div>`;
  const hdr = makeHdr(nome, logoSrc);
  let pg = 1;

  // Capa
  pages.push({ landscape: true, html: buildCapaPage(semStr, iniStr, fimStr, nome) });
  pg++;

  // Mapa
  if (DB.unidades.length) {
    buildMapaPages(hdr, pg, total).forEach(p => { pages.push(p); pg++; });
  }

  // Vistorias
  if (DB.vistorias.length) {
    pages.push({ landscape: true, html: buildVistTotalPage(hdr, pg++, total) });
    pages.push({ landscape: true, html: buildVistMesPage(hdr, pg++, total) });
    pages.push({ landscape: true, html: buildVistSemPage(hdr, pg++, total) });
  }

  // Parecer
  if (v('parecer')) {
    pages.push({ landscape: true, html: buildParecerPage(hdr, pg++, total, semStr, iniStr, fimStr) });
  }

  // Deliberações
  if (DB.delib.length) {
    const concluido = r => String(fk(r, 'STATUS') || '').toLowerCase().includes('conclu');
    const pend = DB.delib.filter(r => !concluido(r));
    const conc = DB.delib.filter(concluido);
    const cols = Object.keys(DB.delib[0]);
    const ROWS = 14;

    for (let i = 0; i < Math.max(1, Math.ceil(pend.length / ROWS)); i++) {
      const chunk = pend.slice(i * ROWS, (i + 1) * ROWS);
      if (!chunk.length && i > 0) break;
      const label = pend.length > ROWS ? `DEMANDAS EM ABERTO (${i * ROWS + 1}–${Math.min((i + 1) * ROWS, pend.length)} de ${pend.length})` : 'DEMANDAS EM ABERTO';
      pages.push({ landscape: true, html: buildDelibPage(chunk, cols, label, '⏳', '#B45309', hdr, pg++, total) });
    }
    for (let i = 0; i < Math.ceil(conc.length / ROWS); i++) {
      const chunk = conc.slice(i * ROWS, (i + 1) * ROWS);
      const label = conc.length > ROWS ? `CONCLUÍDAS (${i * ROWS + 1}–${Math.min((i + 1) * ROWS, conc.length)} de ${conc.length})` : 'CONCLUÍDAS';
      pages.push({ landscape: true, html: buildDelibPage(chunk, cols, label, '✅', '#217A3C', hdr, pg++, total) });
    }
  }

  // MFO
  if (DB.mfo.length) {
    pages.push({ landscape: true, html: buildMfoPage(hdr, pg++, total) });
  }

  // Checklist
  if (DB.checklist.length) {
    const cols = Object.keys(DB.checklist[0]).filter(c => normKey(c) !== 'OCULTAR');
    const ROWS = 20;
    const nPgs = Math.ceil(DB.checklist.length / ROWS);
    for (let p = 0; p < nPgs; p++) {
      const chunk = DB.checklist.slice(p * ROWS, (p + 1) * ROWS);
      const pgLabel = nPgs > 1 ? `Checklist de Área Comum (Parte ${p + 1}/${nPgs})` : 'Checklist de Área Comum';
      const secLabel = nPgs > 1 ? `CHECKLIST DE ÁREA COMUM — ${p * ROWS + 1} a ${Math.min((p + 1) * ROWS, DB.checklist.length)} de ${DB.checklist.length}` : 'CHECKLIST DE ÁREA COMUM';
      pages.push({ landscape: true, html: buildChecklistPage(chunk, cols, pgLabel, secLabel, hdr, pg++, total) });
    }
  }

  // Anexos
  if (DB.anexos.some(Boolean)) {
    pages.push({ landscape: true, html: buildAnexosPage(hdr, pg++, total) });
  }

  return pages;
}
