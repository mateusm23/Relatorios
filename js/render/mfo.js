import { DB } from '../state.js';
import { fmtK, fmtPct, normKey } from '../utils.js';
import { markDone } from '../nav.js';

const TRUNC = 29;
const trunc = s => { const t = String(s || ''); return t.length > TRUNC ? t.slice(0, TRUNC) + '…' : t; };

// Calcula totais próprios: filtra linhas TOTAL importadas e soma colunas numéricas
function calcTotal(cols, firstTextCol, dataRows) {
  const total = {};
  cols.forEach(c => {
    if (c === firstTextCol) { total[c] = 'TOTAL'; return; }
    const kk = normKey(c);
    if (kk.includes('%')) { total[c] = null; return; }
    // Soma só os valores numéricos — ignora células em branco ou string
    const nums = dataRows.map(r => r[c]).filter(v => typeof v === 'number');
    total[c] = nums.length > 0 ? nums.reduce((s, v) => s + v, 0) : '';
  });
  // Recalcula % de desvio a partir das colunas R$ somadas
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
    if (rsC && baseC && total[baseC]) total[pctC] = total[rsC] / total[baseC];
  });
  return total;
}

export function renderMfo() {
  const data = DB.mfo;
  if (!data.length) return;
  const cols = Object.keys(data[0]);
  const firstTextCol = cols.find(c => typeof data[0][c] === 'string');

  // Filtra linhas TOTAL importadas e calcula total próprio
  const dataRows = data.filter(r =>
    !firstTextCol || !String(r[firstTextCol] || '').toUpperCase().includes('TOTAL')
  );
  const totalRow = calcTotal(cols, firstTextCol, dataRows);
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
  const kpiCls = v => { const n = asNum(v); return (isNaN(n) || n === 0) ? 'k-azul' : n < 0 ? 'k-vermelho' : 'k-verde'; };

  const kpis = [
    { label: 'Orçamento',          val: fmtK(orcamento),   cls: 'k-azul' },
    { label: 'Tendência de Custo', val: fmtK(tendCusto),   cls: 'k-azul' },
    { label: 'Desvio em R$',       val: fmtK(desvioRs),    cls: kpiCls(desvioRs)  },
    { label: 'Desvio em %',        val: fmtPct(desvioPct), cls: kpiCls(desvioPct) },
  ];

  // Formata célula com bordas verticais e centralização
  const fmtCell = (c, vv, isTotal, isLast) => {
    const kk       = normKey(c);
    const isNum    = typeof vv === 'number';
    const pctCol   = kk.includes('%');
    const isText   = c === firstTextCol;
    const negativo = isNum && vv < 0;
    const bg       = isTotal ? 'background:#1A2B45;' : '';
    const textDef  = isTotal ? 'color:#fff;' : '';
    const border   = isLast ? '' : `border-right:1px solid ${isTotal ? 'rgba(255,255,255,.12)' : '#E2E8F0'};`;
    const align    = isText ? 'text-align:left;' : 'text-align:center;';
    const pad      = 'padding:3px 6px;';

    if (isText) {
      return `<td style="${bg}${textDef}${align}${border}${pad}font-weight:${isTotal ? '700' : '400'}">${trunc(vv)}</td>`;
    }
    if (pctCol) {
      if (!isNum) return `<td style="${bg}${textDef}${align}${border}${pad}">—</td>`;
      const clr = isTotal ? (negativo ? '#FCA5A5' : '#86EFAC') : (negativo ? '#B91C1C' : '#217A3C');
      return `<td style="${bg}${align}${border}${pad}font-weight:700"><span style="color:${clr}">${fmtPct(vv)}</span></td>`;
    }
    if (isNum) {
      const clr = negativo ? (isTotal ? '#FCA5A5' : '#B91C1C') : null;
      return `<td style="${bg}${textDef}${align}${border}${pad}white-space:nowrap">${clr ? `<span style="color:${clr}">` : ''}${fmtK(vv)}${clr ? '</span>' : ''}</td>`;
    }
    return `<td style="${bg}${textDef}${align}${border}${pad}">—</td>`;
  };

  const rows = allRows.map((r, i) => {
    const isTotal = i === 0;
    return `<tr>${cols.map((c, ci) => fmtCell(c, r[c], isTotal, ci === cols.length - 1)).join('')}</tr>`;
  }).join('');

  document.getElementById('mfoContent').innerHTML = `<div class="card">
    <div class="card-hd">
      <div class="card-ico" style="background:#065F46"><i data-lucide="landmark"></i></div>
      <div><div class="card-ttl">MFO — Monitoramento Financeiro</div>
      <div class="card-sub">${dataRows.length} linhas · ${cols.length} colunas</div></div>
    </div>
    <div class="kpi-grid kg4" style="margin-bottom:10px">
      ${kpis.map(k => `
        <div class="kpi-box ${k.cls}" style="padding:5px 6px">
          <div class="kpi-lbl">${k.label}</div>
          <div class="kpi-val" style="font-size:14px">${k.val || '—'}</div>
        </div>`).join('')}
    </div>
    <div class="info" style="margin-bottom:10px"><i data-lucide="info" style="flex-shrink:0;width:14px;height:14px"></i><span>Prévia exata do PDF (modo paisagem A4). Linha TOTAL calculada automaticamente.</span></div>
    <div class="tbl-wrap"><table class="tbl-prev" style="font-size:10px">
      <thead><tr>
        ${cols.map((c, i) => `<th style="padding:5px 6px;font-size:9px;text-align:center;${i < cols.length - 1 ? 'border-right:1px solid rgba(255,255,255,.18)' : ''}">${c}</th>`).join('')}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
  window.lucide?.createIcons();
  markDone(6);
}
