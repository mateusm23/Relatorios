import { DB } from '../state.js';
import { nrow, fk } from '../utils.js';
import { showToast } from '../toast.js';
import { markDone } from '../nav.js';
import { renderMapa }   from '../render/mapa.js';
import { renderVis, isAprov }    from '../render/vistorias.js';
import { renderDelib }  from '../render/delib.js';
import { renderMfo }    from '../render/mfo.js';
import { renderChk }    from '../render/checklist.js';

const ABA_MAP = {
  unidades:  ['UNIDADES', 'UNIDADE', 'MAPA'],
  vistorias: ['VISTORIAS', 'VISTORIA'],
  delib:     ['DELIBERAÇÕES', 'DELIBERACOES', 'DELIBERAÇOES', 'DELIBERAÇÃO', 'DELIBERACAO'],
  mfo:       ['MFO', 'FINANCEIRO'],
  checklist: ['CHECKLIST', 'CHECK LIST', 'ÁREA COMUM', 'AREA COMUM'],
};

function toIsoDate(val) {
  const s = String(val || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return s;
}

export async function processarBase(input) {
  const f = input.files[0];
  if (!f) return;
  showToast('load', `Lendo ${f.name}...`);

  try {
    const buf = await f.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: 'array', cellDates: false, raw: false });

    const statusEl = document.getElementById('uploadStatus');
    statusEl.style.display = 'flex';
    statusEl.innerHTML = '';
    let found = 0;

    // Aba CAPA — preenche campos do formulário
    const capaName = wb.SheetNames.find(n => n.trim().toUpperCase() === 'CAPA');
    if (capaName) {
      const ws = wb.Sheets[capaName];
      const raw = window.XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      const setF = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
      raw.forEach(r => {
        const campo = String(r['CAMPO'] || '').trim().toUpperCase();
        const valor = String(r['VALOR'] || '').trim();
        if (!valor) return;
        if (campo === 'NOME')        setF('c_nome', valor);
        if (campo === 'CODIGO')      setF('c_cod', valor);
        if (campo === 'INI')         setF('c_ini', toIsoDate(valor));
        if (campo === 'FIM')         setF('c_fim', toIsoDate(valor));
        if (campo === 'SEMANA')      setF('c_sem', valor);
        if (campo === 'ENGENHEIRO')  setF('c_eng', valor);
        if (campo === 'CONSTRUTORA') setF('c_obra', valor);
        if (campo === 'PARECER')     setF('parecer', valor);
        if (campo === 'POSITIVOS')   setF('positivos', valor);
        if (campo === 'ATENCAO')     setF('atencao', valor);
        if (campo === 'ENCAM')       setF('encam', valor);
      });
      statusEl.innerHTML += `<div class="aba-status"><div class="aba-dot ok"></div><div class="aba-name">CAPA</div><div class="aba-info">dados da capa carregados</div></div>`;
    }

    for (const [tipo, nomes] of Object.entries(ABA_MAP)) {
      const sheetName = wb.SheetNames.find(n =>
        nomes.some(nm => n.trim().toUpperCase().startsWith(nm))
      );
      let ok = false, count = 0;

      if (sheetName) {
        const ws = wb.Sheets[sheetName];
        const firstCell = ws['A1'] ? String(ws['A1'].v || '') : '';
        const hasTitle = firstCell.length > 30
          || ['BASE', 'MAPA', 'MFO', 'MODELO'].some(kw => firstCell.toUpperCase().includes(kw));
        const startRow = hasTitle ? 1 : 0;
        const raw = window.XLSX.utils.sheet_to_json(ws, { defval: '', raw: true, range: startRow });
        DB[tipo] = raw.map(nrow).filter(r => Object.values(r).some(v => v !== ''));
        ok = true;
        count = DB[tipo].length;
        found++;
      }

      statusEl.innerHTML += `<div class="aba-status">
        <div class="aba-dot ${ok ? 'ok' : 'warn'}"></div>
        <div class="aba-name">${tipo.toUpperCase()}</div>
        <div class="aba-info">${ok ? count + ' registros' : 'Aba não encontrada'}</div>
      </div>`;
    }

    renderMapa();
    renderVis();
    renderDelib();
    renderMfo();
    renderChk();

    // Avanço de entregas: aprovadas / (total - estoque)
    if (DB.unidades.length > 0 && DB.vistorias.length > 0) {
      const aprovSet = new Set(
        DB.vistorias.filter(isAprov)
          .map(r => String(fk(r, 'UNIDADE', 'UNID') || '').trim().toUpperCase())
          .filter(Boolean)
      );
      const dispBase = DB.unidades.filter(r => {
        const cat = String(fk(r, 'CATEGORIA', 'STATUS', 'SITUAÇÃO', 'SITUACAO') || '').toLowerCase();
        return !cat.includes('estoque');
      }).length;
      const pct = dispBase > 0 ? Math.round(aprovSet.size / dispBase * 100) : 0;
      const el = document.getElementById('c_avanco');
      if (el) el.value = pct;
    }

    markDone(0);
    showToast('ok', `✅ ${found}/5 abas carregadas`);
  } catch (e) {
    showToast('err', '❌ Erro: ' + e.message);
    console.error(e);
  }
  input.value = '';
}
