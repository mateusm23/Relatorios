import { DB, MESES } from '../state.js';
import { v, fk, normKey, escapeHtml, fmtDate, fmtBRL, fmtPct } from '../utils.js';
import { buildBlocos, getCatCls, getCatAbrev } from '../render/mapa.js';
import { calcStats, isReprov, getMes, getSem } from '../render/vistorias.js';

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
const footer = (land = false) =>
  `<div class="pf${land ? ' pf-land' : ''}"><span>Trinus Capital · Gerenciamento de Obras</span><span>Emitido em ${hoje()}</span></div>`;

// ── Contagem antecipada de páginas ────────────────────────────────────────────

export function countPages() {
  let n = 1; // capa
  if (DB.unidades.length)  n++;
  if (DB.vistorias.length) n += 2;
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
  return `<div class="pdf-capa">
    <div class="capa-foto-wrap">
      ${DB.foto
        ? `<img class="capa-foto" src="${DB.foto}">`
        : `<div class="capa-foto-ph"><div style="font-size:64px;opacity:.3">🏗️</div></div>`}
    </div>
    ${DB.logo
      ? `<img class="capa-logo-overlay" src="${DB.logo}">`
      : `<div class="capa-logo-overlay" style="background:rgba(255,255,255,.08);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;color:rgba(255,255,255,.4)">🏗️</div>`}
    <div class="capa-body">
      <div class="capa-tag">Relatório Semanal de Acompanhamento de Obra</div>
      <div class="capa-nome">${escapeHtml(nome)}</div>
      <div class="capa-periodo">Semana ${semStr} · ${iniStr} a ${fimStr}</div>
      <div class="capa-line"></div>
      ${avanco > 0 ? `
      <div class="capa-avanco">
        <div>
          <div class="capa-avanco-label">Avanço de Entregas</div>
          <div class="capa-avanco-val">${avanco}%</div>
        </div>
        <div class="capa-avanco-bar-wrap">
          <div style="font-size:10px;color:rgba(255,255,255,.5);margin-bottom:4px">Unidades entregues aprovadas</div>
          <div class="capa-avanco-bar-bg"><div class="capa-avanco-bar-fill" style="width:${avanco}%"></div></div>
          <div style="font-size:9px;color:rgba(255,255,255,.35);margin-top:4px;text-align:right">${avanco}% entregue</div>
        </div>
      </div>` : ''}
      <div class="capa-fields">
        ${v('c_eng')  ? `<div class="capa-field"><div class="capa-field-lbl">Engenheiro Responsável</div><div class="capa-field-val">${escapeHtml(v('c_eng'))}</div></div>` : ''}
        ${v('c_obra') ? `<div class="capa-field"><div class="capa-field-lbl">Construtora</div><div class="capa-field-val">${escapeHtml(v('c_obra'))}</div></div>` : ''}
        ${v('c_cod')  ? `<div class="capa-field"><div class="capa-field-lbl">Código da Obra</div><div class="capa-field-val">${escapeHtml(v('c_cod'))}</div></div>` : ''}
        <div class="capa-field"><div class="capa-field-lbl">Emissão</div><div class="capa-field-val">${hoje()}</div></div>
      </div>
    </div>
    <div class="capa-footer">
      <div class="capa-footer-brand">TRINUS CAPITAL · GERENCIAMENTO DE OBRAS</div>
      <div class="capa-footer-date">Relatório gerado automaticamente</div>
    </div>
  </div>`;
}

// ── Mapa de Unidades ──────────────────────────────────────────────────────────

function buildMapaPage(hdr, pg, total) {
  const blocos = buildBlocos(DB.unidades);
  let mapaH = '';
  Object.keys(blocos).sort().forEach(bloco => {
    const pavs = blocos[bloco];
    const pavNums = Object.keys(pavs).sort((a, b) => Number(b) - Number(a));
    const allUnids = [...new Set(Object.values(pavs).flatMap(a => a.map(u => u.unid)))].sort();
    mapaH += `<div style="margin-bottom:14px">
      <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:10px;color:#1A2B45;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em">${bloco}</div>
      <table class="pm-tbl">
        <thead><tr><th>PAV</th>${allUnids.map(u => `<th>${u}</th>`).join('')}</tr></thead>
        <tbody>`;
    pavNums.forEach(pav => {
      const map = {};
      pavs[pav].forEach(({ unid, cat }) => map[unid] = cat);
      mapaH += `<tr><th>${pav}</th>${allUnids.map(u =>
        `<td class="${getCatCls(map[u] || '', 'pm')}">${getCatAbrev(map[u] || '')}</td>`
      ).join('')}</tr>`;
    });
    mapaH += `</tbody></table></div>`;
  });
  return `<div class="pdf-page">
    ${hdr('Mapa de Acompanhamento — Entregas', pg, total)}
    ${sec('🗺️', 'MAPA DE ACOMPANHAMENTO — ENTREGAS')}
    <div class="pleg">
      <div class="pleg-item"><div class="pleg-dot" style="background:#217A3C"></div>Cliente – Aprovou Vistoria</div>
      <div class="pleg-item"><div class="pleg-dot" style="background:#1A6EE8"></div>Liberado – Vistoria Cliente</div>
      <div class="pleg-item"><div class="pleg-dot" style="background:#E2E8F0;border:1px solid #cbd5e1"></div>Estoque</div>
      <div class="pleg-item"><div class="pleg-dot" style="background:#B91C1C"></div>Restrição Comercial</div>
    </div>
    ${mapaH}
    ${footer()}
  </div>`;
}

// ── Vistorias: Total + Mensal ─────────────────────────────────────────────────

function buildVistTotalPage(hdr, pg, total) {
  const vis = DB.vistorias;
  const s = calcStats(vis);
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

  return `<div class="pdf-page">
    ${hdr('Análise de Vistorias — Total e Mensal', pg, total)}
    ${sec('📊', 'VISÃO TOTAL — VISTORIAS')}
    <div class="pk-row pk7" style="margin-bottom:20px">
      <div class="pk pk-azul"><div class="pk-lbl">Total Vistorias</div><div class="pk-val">${s.t}</div></div>
      <div class="pk pk-verde"><div class="pk-lbl">Aprovadas</div><div class="pk-val">${s.a}</div></div>
      <div class="pk pk-verm"><div class="pk-lbl">Reprovadas</div><div class="pk-val">${s.r}</div></div>
      <div class="pk pk-lrnj"><div class="pk-lbl">Não Comp.</div><div class="pk-val">${s.n}</div></div>
      <div class="pk pk-verde"><div class="pk-lbl">Taxa Aprov.</div><div class="pk-val">${s.pa}</div></div>
      <div class="pk pk-verm"><div class="pk-lbl">Taxa Reprov.</div><div class="pk-val">${s.pr}</div></div>
      <div class="pk pk-lrnj"><div class="pk-lbl">Taxa NC</div><div class="pk-val">${s.pn}</div></div>
    </div>
    ${sec('📅', 'VISÃO MENSAL — EVOLUÇÃO POR MÊS')}
    <table class="pt">
      <thead><tr><th>Mês</th><th style="text-align:center">Total</th><th style="text-align:center">Aprov.</th><th style="text-align:center">Reprov.</th><th style="text-align:center">NC</th><th style="text-align:center">Taxa A.</th><th style="text-align:center">Taxa R.</th><th style="text-align:center">Taxa NC</th></tr></thead>
      <tbody>${mesRows}</tbody>
    </table>
    ${footer()}
  </div>`;
}

function buildVistSemPage(hdr, pg, total) {
  const vis = DB.vistorias;
  const porSem = {};
  vis.forEach(r => { const s = getSem(r); if (s) { if (!porSem[s]) porSem[s] = []; porSem[s].push(r); } });
  const semKeys = Object.keys(porSem).sort((a, b) => Number(a) - Number(b));
  const semKeysExib = semKeys.slice(-15);

  const semRows = semKeysExib.map(sem => {
    const ss = calcStats(porSem[sem]);
    const primData = porSem[sem].map(r => fk(r, 'DATA VISTORIA', 'DATA')).filter(Boolean).sort()[0];
    return `<tr>
      <td style="font-weight:700;text-align:center">${sem}</td>
      <td style="font-size:9px">${primData ? fmtDate(primData) : ''}</td>
      <td style="text-align:center">${ss.t}</td>
      <td style="text-align:center;color:#217A3C;font-weight:700">${ss.a}</td>
      <td style="text-align:center;color:#B91C1C;font-weight:700">${ss.r}</td>
      <td style="text-align:center;color:#C05621;font-weight:700">${ss.n}</td>
      <td style="text-align:center">${ss.pa}</td>
      <td style="text-align:center">${ss.pr}</td>
      <td style="text-align:center">${ss.pn}</td>
    </tr>`;
  }).join('');

  const semNote = semKeys.length > 15
    ? `<div style="font-size:9px;color:#64748B;margin-bottom:10px;padding:6px 10px;background:#F1F5F9;border-radius:5px">Exibindo as últimas 15 semanas de ${semKeys.length} registradas.</div>`
    : '';

  const reprovs = vis.filter(isReprov);
  const motivoMap = {};
  reprovs.forEach(r => {
    const mot = String(fk(r, 'MOTIVO REPROVAÇÃO', 'MOTIVO REPROVACAO', 'MOTIVO') || 'SEM MOTIVO').trim();
    motivoMap[mot] = (motivoMap[mot] || 0) + 1;
  });
  const motivoRows = Object.entries(motivoMap).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([mot, qtd]) =>
      `<tr><td>${mot}</td><td style="text-align:center;font-weight:700;color:#B91C1C">${qtd}</td><td style="text-align:center">${reprovs.length ? Math.round(qtd / reprovs.length * 100) + '%' : '—'}</td></tr>`
    ).join('');

  return `<div class="pdf-page">
    ${hdr('Análise de Vistorias — Semanal e Reprovações', pg, total)}
    ${sec('📆', 'VISÃO SEMANAL — EVOLUÇÃO POR SEMANA')}
    ${semNote}
    <table class="pt">
      <thead><tr><th style="text-align:center">Sem.</th><th>1ª Data</th><th style="text-align:center">Total</th><th style="text-align:center">Aprov.</th><th style="text-align:center">Reprov.</th><th style="text-align:center">NC</th><th style="text-align:center">Taxa A.</th><th style="text-align:center">Taxa R.</th><th style="text-align:center">Taxa NC</th></tr></thead>
      <tbody>${semRows}</tbody>
    </table>
    ${reprovs.length ? `
      ${sec('❌', 'DISTRIBUIÇÃO DE REPROVAÇÕES POR MOTIVO')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <table class="pt">
          <thead><tr><th>Motivo</th><th style="text-align:center">Qtd.</th><th style="text-align:center">%</th></tr></thead>
          <tbody>${motivoRows}</tbody>
        </table>
        <div style="background:#F8FAFC;border-radius:8px;padding:12px;border:1px solid #E2E8F0">
          <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:11px;color:#1A2B45;margin-bottom:10px">Resumo de Reprovações</div>
          <div style="font-size:11px;color:#64748B;line-height:1.8">
            <div>Total reprovações: <strong style="color:#B91C1C">${reprovs.length}</strong></div>
            <div>Motivos distintos: <strong>${Object.keys(motivoMap).length}</strong></div>
            <div>Principal motivo: <strong>${Object.entries(motivoMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'}</strong></div>
          </div>
        </div>
      </div>` : ''}
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
  return `<div class="pdf-page">
    ${hdr('Parecer Semanal', pg, total)}
    ${sec('📝', 'PARECER SEMANAL DE VISTORIAS')}
    <div style="font-size:9px;color:#94a3b8;margin-bottom:12px">Semana ${semStr} · ${iniStr} a ${fimStr}</div>
    <div class="pparecer">${parecerHtml}</div>
    ${(posit || atenc || encam) ? `
    <div style="display:grid;grid-template-columns:${posit && atenc ? '1fr 1fr' : '1fr'};gap:12px;margin-top:14px">
      ${posit ? `<div style="background:#D4EDDA;border-radius:8px;padding:12px 14px;border-left:3px solid #217A3C">
        <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:10px;color:#217A3C;margin-bottom:7px">✅ PONTOS POSITIVOS</div>
        <div style="font-size:10px;color:#1A2B45;line-height:1.7;white-space:pre-wrap">${escapeHtml(posit)}</div>
      </div>` : ''}
      ${atenc ? `<div style="background:#FEE2E2;border-radius:8px;padding:12px 14px;border-left:3px solid #B91C1C">
        <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:10px;color:#B91C1C;margin-bottom:7px">⚠️ PONTOS DE ATENÇÃO</div>
        <div style="font-size:10px;color:#1A2B45;line-height:1.7;white-space:pre-wrap">${escapeHtml(atenc)}</div>
      </div>` : ''}
    </div>
    ${encam ? `<div style="background:#EFF6FF;border-radius:8px;padding:12px 14px;border-left:3px solid #1B6FBF;margin-top:12px">
      <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:10px;color:#1B6FBF;margin-bottom:7px">📌 ENCAMINHAMENTOS</div>
      <div style="font-size:10px;color:#1A2B45;line-height:1.7;white-space:pre-wrap">${escapeHtml(encam)}</div>
    </div>` : ''}` : ''}
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

  return `<div class="pdf-page">
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
    ${footer(true)}
  </div>`;
}

// ── Checklist ─────────────────────────────────────────────────────────────────

function buildChecklistPage(chunk, cols, pgLabel, secLabel, hdr, pg, total) {
  const trs = chunk.map(r => `<tr>${cols.map(c => {
    const vv = r[c] || '';
    const kk = normKey(c);
    if (kk === 'STATUS' || kk === 'SITUAÇÃO') {
      const s = String(vv).toLowerCase();
      let cl = 'ptag-conf';
      if (s.includes('não conf') || s.includes('nao conf')) cl = 'ptag-nconf';
      else if (s.includes('parcial')) cl = 'ptag-parc';
      else if (s.includes('n/a')) cl = '';
      return `<td><span class="ptag ${cl}">${vv || 'OK'}</span></td>`;
    }
    if (kk === 'DATA') return `<td style="font-size:9px">${fmtDate(vv)}</td>`;
    return `<td style="white-space:normal;font-size:10px">${vv || '—'}</td>`;
  }).join('')}</tr>`).join('');

  return `<div class="pdf-page">
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

  return `<div class="pdf-page">
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
  pages.push({ landscape: false, html: buildCapaPage(semStr, iniStr, fimStr, nome) });
  pg++;

  // Mapa
  if (DB.unidades.length) {
    pages.push({ landscape: false, html: buildMapaPage(hdr, pg++, total) });
  }

  // Vistorias
  if (DB.vistorias.length) {
    pages.push({ landscape: false, html: buildVistTotalPage(hdr, pg++, total) });
    pages.push({ landscape: false, html: buildVistSemPage(hdr, pg++, total) });
  }

  // Parecer
  if (v('parecer')) {
    pages.push({ landscape: false, html: buildParecerPage(hdr, pg++, total, semStr, iniStr, fimStr) });
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
      pages.push({ landscape: false, html: buildDelibPage(chunk, cols, label, '⏳', '#B45309', hdr, pg++, total) });
    }
    for (let i = 0; i < Math.ceil(conc.length / ROWS); i++) {
      const chunk = conc.slice(i * ROWS, (i + 1) * ROWS);
      const label = conc.length > ROWS ? `CONCLUÍDAS (${i * ROWS + 1}–${Math.min((i + 1) * ROWS, conc.length)} de ${conc.length})` : 'CONCLUÍDAS';
      pages.push({ landscape: false, html: buildDelibPage(chunk, cols, label, '✅', '#217A3C', hdr, pg++, total) });
    }
  }

  // MFO
  if (DB.mfo.length) {
    pages.push({ landscape: true, html: buildMfoPage(hdr, pg++, total) });
  }

  // Checklist
  if (DB.checklist.length) {
    const cols = Object.keys(DB.checklist[0]);
    const ROWS = 20;
    const nPgs = Math.ceil(DB.checklist.length / ROWS);
    for (let p = 0; p < nPgs; p++) {
      const chunk = DB.checklist.slice(p * ROWS, (p + 1) * ROWS);
      const pgLabel = nPgs > 1 ? `Checklist de Área Comum (Parte ${p + 1}/${nPgs})` : 'Checklist de Área Comum';
      const secLabel = nPgs > 1 ? `CHECKLIST DE ÁREA COMUM — ${p * ROWS + 1} a ${Math.min((p + 1) * ROWS, DB.checklist.length)} de ${DB.checklist.length}` : 'CHECKLIST DE ÁREA COMUM';
      pages.push({ landscape: false, html: buildChecklistPage(chunk, cols, pgLabel, secLabel, hdr, pg++, total) });
    }
  }

  // Anexos
  if (DB.anexos.some(Boolean)) {
    pages.push({ landscape: false, html: buildAnexosPage(hdr, pg++, total) });
  }

  return pages;
}
