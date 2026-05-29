import { DB } from '../state.js';
import { v } from '../utils.js';
import { showToast } from '../toast.js';
import { calcStats } from '../render/vistorias.js';

// ── Helpers de data para geração de template ──────────────────────────────────

const PT_MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function isoWeekFromBR(dateStr) {
  const [d, m, y] = dateStr.split('/').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dow);
  const jan1 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil(((dt - jan1) / 86400000 + 1) / 7);
}

function mesNomeFromBR(dateStr) {
  const [, m] = dateStr.split('/').map(Number);
  return PT_MESES_NOMES[m - 1] || '';
}

function deltaDias(prazo1, prazo2) {
  const parse = s => { const [d, m, y] = s.split('/').map(Number); return new Date(y, m - 1, d); };
  try { return Math.round((parse(prazo2) - parse(prazo1)) / 86400000); } catch { return 0; }
}

// ── Gerar / Exportar Excel dos dados atuais ───────────────────────────────────

export async function gerarXLSX() {
  if (!v('c_nome')) { showToast('err', '❌ Preencha o nome da obra'); return; }
  showToast('load', 'Gerando Excel...');
  await new Promise(r => setTimeout(r, 100));
  try {
    const wb = window.XLSX.utils.book_new();
    const addSh = (name, aoa, cw) => {
      const ws = window.XLSX.utils.aoa_to_sheet(aoa);
      if (cw) ws['!cols'] = cw.map(w => ({ wch: w }));
      ws['!pageSetup'] = { paperSize: 9, fitToPage: true, fitToWidth: 1 };
      window.XLSX.utils.book_append_sheet(wb, ws, name);
    };
    const semStr = v('c_sem') || 'XX';

    addSh('CAPA', [
      ['CAPA — RELATÓRIO SEMANAL DE OBRA'],
      [''],
      ['OBRA',               v('c_nome')],
      ['CONSTRUTORA',        v('c_obra')],
      ['GERENCIADORA',       v('c_ger')],
      ['ENGENHEIRO',         v('c_eng')],
      [''],
      ['DATA INICIO',        v('c_ini')],
      ['DATA FIM',           v('c_fim')],
      ['SEMANA No',          semStr],
      ['AVANCO DE ENTREGAS', v('c_avanco')],
      [''],
      ['PONTOS POSITIVOS',   v('positivos')],
      ['PONTOS DE ATENCAO',  v('atencao')],
      ['ENCAMINHAMENTOS',    v('encam')],
    ], [25, 70]);

    if (v('parecer')) {
      addSh('PARECER', [
        ['PARECER SEMANAL'],
        [''],
        [v('parecer')],
      ], [110]);
    }

    if (DB.unidades.length) {
      const c = Object.keys(DB.unidades[0]);
      addSh('UNIDADES', [c, ...DB.unidades.map(r => c.map(k => r[k] || ''))], [10, 14, 14, 32]);
    }
    if (DB.vistorias.length) {
      const c = Object.keys(DB.vistorias[0]);
      addSh('VISTORIAS', [c, ...DB.vistorias.map(r => c.map(k => r[k] || ''))], [14, 16, 22, 36, 12, 14]);
      const s = calcStats(DB.vistorias);
      addSh('VISÃO TOTAL', [
        ['TOTAL', 'APROVADAS', 'REPROVADAS', 'NÃO COMP.', 'TAXA A.', 'TAXA R.', 'TAXA NC'],
        [s.t, s.a, s.r, s.n, s.pa, s.pr, s.pn]
      ], [18, 16, 16, 18, 14, 14, 12]);
    }
    if (DB.delib.length) {
      const c = Object.keys(DB.delib[0]);
      addSh('DELIBERAÇÕES', [c, ...DB.delib.map(r => c.map(k => r[k] || ''))], [14, 16, 52, 14, 14, 12, 22, 16]);
    }
    if (DB.mfo.length) {
      const c = Object.keys(DB.mfo[0]);
      addSh('MFO', [c, ...DB.mfo.map(r => c.map(k => r[k] || ''))], [32, ...Array(c.length - 1).fill(16)]);
    }
    if (DB.checklist.length) {
      const c = Object.keys(DB.checklist[0]);
      addSh('CHECKLIST', [c, ...DB.checklist.map(r => c.map(k => r[k] || ''))], [20, 38, 14, 14, 10, 14, 20, 38, 10]);
    }

    window.XLSX.writeFile(wb, 'RLT_SEM' + semStr + '_' + v('c_nome').replace(/\s+/g, '_').toUpperCase() + '.xlsx');
    showToast('ok', '✅ Excel gerado!');
  } catch (e) { showToast('err', '❌ Erro: ' + e.message); }
}

// ── Downloads diretos dos templates (arquivos no repositório) ─────────────────

async function downloadFile(path, filename) {
  showToast('load', 'Preparando download...');
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error('Arquivo não encontrado');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('ok', '✅ Download iniciado!');
  } catch (e) { showToast('err', '❌ Erro: ' + e.message); }
}

export function baixarTemplateEmBranco() {
  downloadFile('templates/BASE_SEMANAL_VAZIO.xlsx', 'BASE_SEMANAL_VAZIO.xlsx');
}

// ── Template com dados de exemplo ────────────────────────────────────────────

export function baixarTemplateComDados() {
  downloadFile('templates/BASE_SEMANAL_DADOS.xlsx', 'BASE_SEMANAL_DADOS.xlsx');
}

