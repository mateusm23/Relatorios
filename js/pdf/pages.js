import { DB, MESES } from '../state.js';
import { v, fk, normKey, escapeHtml, fmtDate, fmtK, fmtPct } from '../utils.js';
import { buildBlocos, getCatCls, getCatAbrev, catColor, buildBlocoCell, buildResumoGeral, calcCellSize, buildLegenda } from '../render/mapa.js';
import { calcStats, isReprov, getMes, getSem, parseRawDate, ddmm, buildDonutChart, buildHBarChart, buildStackedBars, buildLineChart, buildVistTotalContent, buildVistMesContent, buildVistSemContent } from '../render/vistorias.js';

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
      ${v('c_ger')  ? `<div class="capal-info-sub" style="margin-top:-6px">Gerenciadora: ${escapeHtml(v('c_ger'))}</div>` : ''}
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

// ── Mapa de Unidades ── (catColor, buildBlocoCell, buildResumoGeral importados de render/mapa.js)


function buildMapaPages(hdr, pgStart, total) {
  const pages = [];
  const blocos = buildBlocos(DB.unidades);
  const blocoKeys = Object.keys(blocos).sort();
  const legenda = buildLegenda();

  const size  = calcCellSize(blocos);
  const cells = blocoKeys.map(b => buildBlocoCell(b, blocos[b], size));
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

// ── Vistorias: 3 páginas ──────────────────────────────────────────────────────

function buildVistTotalPage(hdr, pg, total) {
  return `<div class="pdf-page-land">
    ${hdr('Acompanhamento de Vistorias', pg, total)}
    ${sec('📊', 'VISÃO TOTAL — VISTORIAS')}
    ${buildVistTotalContent(DB.vistorias)}
    ${footer()}
  </div>`;
}

function buildVistMesPage(hdr, pg, total) {
  return `<div class="pdf-page-land">
    ${hdr('Acompanhamento de Vistorias', pg, total)}
    ${sec('📅', 'VISÃO MENSAL — EVOLUÇÃO POR MÊS')}
    ${buildVistMesContent(DB.vistorias)}
    ${footer()}
  </div>`;
}

function buildVistSemPage(hdr, pg, total) {
  return `<div class="pdf-page-land">
    ${hdr('Acompanhamento de Vistorias', pg, total)}
    ${sec('📆', 'EVOLUÇÃO SEMANAL — VISTORIAS POR SEMANA')}
    ${buildVistSemContent(DB.vistorias)}
    ${footer()}
  </div>`;
}


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
  const cols         = Object.keys(DB.mfo[0]);
  const firstTextCol = cols.find(c => typeof DB.mfo[0][c] === 'string');
  const TRUNC        = 29;
  const trunc        = s => { const t = String(s || ''); return t.length > TRUNC ? t.slice(0, TRUNC) + '…' : t; };

  // Filtra linhas TOTAL importadas e calcula total próprio
  const dataRows = DB.mfo.filter(r =>
    !firstTextCol || !String(r[firstTextCol] || '').toUpperCase().includes('TOTAL')
  );

  const calcTotalRow = () => {
    const t = {};
    cols.forEach(c => {
      if (c === firstTextCol) { t[c] = 'TOTAL'; return; }
      const kk = normKey(c);
      if (kk.includes('%')) { t[c] = null; return; }
      // Soma só os valores numéricos — ignora células em branco ou string
      const nums = dataRows.map(r => r[c]).filter(v => typeof v === 'number');
      t[c] = nums.length > 0 ? nums.reduce((s, v) => s + v, 0) : '';
    });
    cols.filter(c => normKey(c).includes('%') && normKey(c).includes('DESVIO')).forEach(pctC => {
      const kk  = normKey(pctC);
      const rsC = cols.find(c2 => {
        const k2 = normKey(c2);
        return k2.includes('DESVIO') && k2.includes('R$') &&
          (k2.includes('NOMINAL') === kk.includes('NOMINAL')) &&
          (k2.includes('CORRIGIDO') === kk.includes('CORRIGIDO'));
      });
      const baseC = cols.find(c2 => {
        const k2 = normKey(c2);
        return kk.includes('NOMINAL')
          ? k2.includes('VALOR ORÇADO') || k2.includes('VALOR ORCADO')
          : k2.includes('VALOR ATUALIZADO');
      });
      if (rsC && baseC && t[baseC]) t[pctC] = t[rsC] / t[baseC];
    });
    return t;
  };

  const totalRow = calcTotalRow();
  const allRows  = [totalRow, ...dataRows];

  // KPIs extraídos do totalRow calculado
  const findKpi = (...terms) => {
    for (const t of terms) {
      const nt = normKey(t);
      const k  = cols.find(c => normKey(c).includes(nt));
      if (k !== undefined && totalRow[k] != null && totalRow[k] !== '') return totalRow[k];
    }
    return null;
  };

  const orcamento = findKpi('VALOR ORÇADO', 'VALOR ORCADO');
  const tendCusto = findKpi('CUSTO AO TÉRMINO', 'CUSTO AO TERMINO', 'CUSTO AO TER');
  const desvioRs  = findKpi('DESVIO NOMINAL R$', 'DESVIO NOMINAL R');
  const desvioPct = findKpi('DESVIO NOMINAL %');

  const asNum  = v => typeof v === 'number' ? v : parseFloat(String(v || '0').replace('%', ''));
  const kpiCls = v => { const n = asNum(v); return (isNaN(n) || n === 0) ? 'pk-azul' : n < 0 ? 'pk-verm' : 'pk-verde'; };

  const kpis = [
    { label: 'Orçamento',          val: fmtK(orcamento),   cls: 'pk-azul' },
    { label: 'Tendência de Custo', val: fmtK(tendCusto),   cls: 'pk-azul' },
    { label: 'Desvio em R$',       val: fmtK(desvioRs),    cls: kpiCls(desvioRs)  },
    { label: 'Desvio em %',        val: fmtPct(desvioPct), cls: kpiCls(desvioPct) },
  ];

  // Larguras fixas via colgroup
  const textPct = 14;
  const numPct  = ((100 - textPct) / (cols.length - 1)).toFixed(1);

  // Formata célula com bordas verticais e alinhamento central
  const fmtCell = (c, vv, isTotal, isLast) => {
    const kk       = normKey(c);
    const isNum    = typeof vv === 'number';
    const pctCol   = kk.includes('%');
    const isText   = c === firstTextCol;
    const negativo = isNum && vv < 0;
    const border   = isLast ? '' : `border-right:1px solid ${isTotal ? 'rgba(255,255,255,.12)' : '#CBD5E1'};`;
    const align    = isText ? 'text-align:left;' : 'text-align:center;';
    const pad      = 'padding:3px 4px;';
    const fs       = isText ? 'font-size:7.5px;' : 'font-size:7px;';

    if (isText) {
      return `<td style="${align}${border}${pad}${fs}font-weight:${isTotal ? '700' : '400'}">${trunc(vv)}</td>`;
    }
    if (pctCol) {
      if (!isNum) return `<td style="${align}${border}${pad}${fs}">—</td>`;
      const clr = isTotal ? (negativo ? '#FCA5A5' : '#F5C800') : (negativo ? '#B91C1C' : '#217A3C');
      return `<td style="${align}${border}${pad}${fs}font-weight:700"><span style="color:${clr}">${fmtPct(vv)}</span></td>`;
    }
    if (isNum) {
      const clr = !isTotal && negativo ? '#B91C1C' : null;
      return `<td style="${align}${border}${pad}${fs}white-space:nowrap">${clr ? `<span style="color:${clr}">` : ''}${fmtK(vv)}${clr ? '</span>' : ''}</td>`;
    }
    return `<td style="${align}${border}${pad}${fs}">—</td>`;
  };

  const mfoRows = allRows.map((r, i) => {
    const isTotal = i === 0;
    return `<tr class="${isTotal ? 'pt-total' : ''}">${cols.map((c, ci) =>
      fmtCell(c, r[c], isTotal, ci === cols.length - 1)
    ).join('')}</tr>`;
  }).join('');

  return `<div class="pdf-page-land">
    ${hdr('MFO — Monitoramento Financeiro de Obra', pg, total)}
    ${sec('💰', 'MFO — MONITORAMENTO FINANCEIRO DE OBRA')}
    <div class="pk-row pk4">
      ${kpis.map(k => `
        <div class="pk ${k.cls}" style="padding:5px 4px">
          <div class="pk-lbl">${k.label}</div>
          <div class="pk-val" style="font-size:16px">${k.val || '—'}</div>
        </div>`).join('')}
    </div>
    <table class="pt" style="table-layout:fixed;width:100%">
      <colgroup>${cols.map((_, i) =>
        `<col style="width:${i === 0 ? textPct : numPct}%">`).join('')}
      </colgroup>
      <thead><tr>${cols.map((c, i) =>
        `<th style="font-size:6.5px;padding:4px 3px;text-align:center;white-space:normal;word-break:break-word;line-height:1.3;${i < cols.length - 1 ? 'border-right:1px solid rgba(255,255,255,.18)' : ''}">${c}</th>`
      ).join('')}</tr></thead>
      <tbody>${mfoRows}</tbody>
    </table>
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
