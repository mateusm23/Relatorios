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

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

function lerCapa(ws) {
  const setF = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  const raw2d = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

  // ── Detecta formato antigo (coluna "CAMPO") ──────────────────────────────
  const isOldFmt = raw2d.some(r => norm(r[0]) === 'CAMPO');
  if (isOldFmt) {
    const raw = window.XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
    raw.forEach(r => {
      const campo = norm(r['CAMPO'] || '');
      const valor = String(r['VALOR'] || '').trim();
      if (!valor) return;
      if (['NOME','OBRA'].includes(campo))        setF('c_nome', valor);
      if (campo === 'CODIGO')                     setF('c_cod',  valor);
      if (['INI','DATA INICIO','DATA INÃCIO'].includes(campo)) setF('c_ini', toIsoDate(valor));
      if (['FIM','DATA FIM'].includes(campo))     setF('c_fim',  toIsoDate(valor));
      if (campo.startsWith('SEMANA'))             setF('c_sem',  valor);
      if (campo === 'ENGENHEIRO')                 setF('c_eng',  valor);
      if (campo === 'CONSTRUTORA')                setF('c_obra', valor);
      if (campo === 'GERENCIADORA')               setF('c_ger',  valor);
      if (['PARECER'].includes(campo))            setF('parecer', valor);
      if (['POSITIVOS','PONTOS POSITIVOS'].includes(campo)) setF('positivos', valor);
      if (['ATENCAO','PONTOS DE ATENCAO'].includes(campo))  setF('atencao', valor);
      if (['ENCAM','ENCAMINHAMENTOS'].includes(campo))      setF('encam', valor);
    });
    return;
  }

  // ── Formato novo: label em col A, valor em col B (ou col A da linha seguinte) ──
  const capaMap = {};
  const TEXT_BLOCKS = ['PONTOS POSITIVOS', 'PONTOS DE ATENCAO', 'ENCAMINHAMENTOS'];

  raw2d.forEach((row, idx) => {
    const labelRaw = String(row[0] || '').trim();
    const valB     = String(row[1] || '').trim();
    if (!labelRaw || labelRaw.startsWith('=')) return;

    const key = norm(labelRaw);
    if (valB && !valB.startsWith('=')) {
      capaMap[key] = valB;
    } else {
      // Campos de texto cujo conteúdo fica na linha seguinte (col A)
      const isTextBlock = TEXT_BLOCKS.some(tb => key.includes(norm(tb).split(' ')[0]) && key.length < 35);
      if (isTextBlock && raw2d[idx + 1]) {
        const nextA = String(raw2d[idx + 1][0] || '').trim();
        if (nextA && !nextA.startsWith('=')) capaMap[key] = nextA;
      }
    }
  });

  const get = (...keys) => keys.map(k => capaMap[norm(k)]).find(v => v) || '';

  setF('c_nome',   get('OBRA', 'NOME'));
  setF('c_obra',   get('CONSTRUTORA'));
  setF('c_ger',    get('GERENCIADORA'));
  setF('c_eng',    get('ENGENHEIRO'));
  setF('c_ini',    toIsoDate(get('DATA INICIO', 'DATA INÍCIO', 'DATA INI')));
  setF('c_fim',    toIsoDate(get('DATA FIM')));
  setF('c_sem',    get('SEMANA', 'SEMANA No', 'SEMANA N'));
  setF('c_avanco', get('AVANCO DE ENTREGAS', 'AVANÇO DE ENTREGAS'));
  setF('positivos', get('PONTOS POSITIVOS'));
  setF('atencao',   get('PONTOS DE ATENCAO', 'PONTOS DE ATENÇÃO'));
  setF('encam',     get('ENCAMINHAMENTOS'));
}

function lerParecer(wb) {
  const name = wb.SheetNames.find(n => n.trim().toUpperCase() === 'PARECER');
  if (!name) return;
  const ws = wb.Sheets[name];
  const raw2d = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  // Texto está na célula A3 (R1=título, R2=instrução, R3+=conteúdo)
  for (let i = 2; i < raw2d.length; i++) {
    const txt = String(raw2d[i][0] || '').trim();
    if (txt) {
      DB.parecer = txt;
      const el = document.getElementById('parecer');
      if (el) el.value = txt;
      return;
    }
  }
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

    // ── CAPA ────────────────────────────────────────────────────────────────
    const capaName = wb.SheetNames.find(n => n.trim().toUpperCase() === 'CAPA');
    if (capaName) {
      lerCapa(wb.Sheets[capaName]);
      statusEl.innerHTML += `<div class="aba-status"><div class="aba-dot ok"></div><div class="aba-name">CAPA</div><div class="aba-info">dados da capa carregados</div></div>`;
    }

    // ── PARECER ─────────────────────────────────────────────────────────────
    lerParecer(wb);

    // ── Abas de dados ────────────────────────────────────────────────────────
    for (const [tipo, nomes] of Object.entries(ABA_MAP)) {
      const sheetName = wb.SheetNames.find(n =>
        nomes.some(nm => n.trim().toUpperCase().startsWith(nm))
      );
      let ok = false, count = 0;

      if (sheetName) {
        const ws = wb.Sheets[sheetName];
        const firstCell = ws['A1'] ? String(ws['A1'].v || '') : '';
        const hasTitle = firstCell.length > 20
          || ['BASE', 'MAPA', 'MFO', 'MODELO', 'REGISTRO', 'MONITORAMENTO'].some(kw =>
              firstCell.toUpperCase().includes(kw));
        // Se tem título em A1, os dados reais começam mais abaixo
        // Tentamos encontrar a linha de cabeçalho real
        let startRow = hasTitle ? 1 : 0;
        if (hasTitle) {
          const raw2d = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
          // Procura a primeira linha onde mais de 2 células têm texto (= cabeçalho real)
          for (let i = 1; i < Math.min(raw2d.length, 5); i++) {
            const filled = raw2d[i].filter(v => String(v).trim()).length;
            if (filled >= 2) { startRow = i; break; }
          }
        }
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

    // ── Avanço de entregas (calculado pelo JS como fallback) ─────────────────
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
      if (el && !el.value) el.value = pct;
    }

    markDone(0);
    showToast('ok', `✅ ${found}/5 abas carregadas`);
  } catch (e) {
    showToast('err', '❌ Erro: ' + e.message);
    console.error(e);
  }
  input.value = '';
}


