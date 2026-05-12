import { DB } from '../state.js';
import { nrow } from '../utils.js';
import { showToast } from '../toast.js';
import { markDone } from '../nav.js';
import { renderMapa }   from '../render/mapa.js';
import { renderVis }    from '../render/vistorias.js';
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
        const startRow = hasTitle ? 2 : 1;
        const raw = window.XLSX.utils.sheet_to_json(ws, { defval: '', raw: true, range: startRow });
        DB[tipo] = raw.map(nrow);
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
    markDone(0);
    showToast('ok', `✅ ${found}/5 abas carregadas`);
  } catch (e) {
    showToast('err', '❌ Erro: ' + e.message);
    console.error(e);
  }
  input.value = '';
}
