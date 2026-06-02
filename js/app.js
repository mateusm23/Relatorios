import { goPage }          from './nav.js';
import { showToast }        from './toast.js';
import { loadImg, loadAnexo, removeAnexo, syncAnexoCaption } from './images.js';
import { processarBase }    from './excel/reader.js';
import { gerarXLSX, baixarTemplateComDados, baixarTemplateEmBranco } from './excel/exporter.js';
import { gerarPDF }         from './pdf/builder.js';
import { isoWeek, v, escapeHtml } from './utils.js';
import { DB }               from './state.js';

// ── LocalStorage ──────────────────────────────────────────────────────────────

const LS_KEY = 'rso_form_state';
const FORM_FIELDS = ['c_nome','c_ini','c_fim','c_sem','c_eng','c_obra','c_ger','c_avanco','parecer','positivos','atencao','encam','anexosObs'];

function saveState() {
  const state = {};
  FORM_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) state[id] = el.value;
  });
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function restoreState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    Object.entries(state).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    });
  } catch (_) {}
}

// ── Auto-semana ISO a partir da data de início ─────────────────────────────────

function autoWeek(force = false) {
  const ini = document.getElementById('c_ini');
  const semEl = document.getElementById('c_sem');
  const fimEl = document.getElementById('c_fim');
  if (!ini || !semEl) return;
  if (!force && semEl.value) return;
  if (!ini.value) return;
  const d = new Date(ini.value + 'T12:00:00');
  semEl.value = isoWeek(d);
  if (fimEl && (force || !fimEl.value)) {
    const sun = new Date(d);
    sun.setDate(sun.getDate() + (7 - (sun.getDay() || 7)));
    const y = sun.getFullYear();
    const m = String(sun.getMonth() + 1).padStart(2, '0');
    const day = String(sun.getDate()).padStart(2, '0');
    fimEl.value = `${y}-${m}-${day}`;
  }
}

// ── Prévia ao vivo da capa PDF ────────────────────────────────────────────────
// Replica o HTML exato de buildCapaPage (pages.js) escalado via CSS transform

function scaleCapaPreview() {
  const frame = document.getElementById('capaPreviewFrame');
  const inner = document.getElementById('capaPreviewInner');
  if (!frame || !inner) return;
  const scale = frame.offsetWidth / 1123;
  inner.style.transform = `scale(${scale})`;
  frame.style.height = Math.round(794 * scale) + 'px';
}

export function updateCapaPreview() {
  const inner = document.getElementById('capaPreviewInner');
  if (!inner) return;

  const nome   = v('c_nome');
  const avanco = parseInt(v('c_avanco')) || 0;
  const semStr = v('c_sem') || 'XX';
  const iniStr = v('c_ini') ? new Date(v('c_ini') + 'T12:00:00').toLocaleDateString('pt-BR') : '';
  const fimStr = v('c_fim') ? new Date(v('c_fim') + 'T12:00:00').toLocaleDateString('pt-BR') : '';
  const mesAno = v('c_ini')
    ? new Date(v('c_ini') + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
    : `SEMANA ${semStr}`;

  // HTML idêntico ao buildCapaPage de pages.js
  inner.innerHTML = `<div class="pdf-capa-land">
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
      <div class="capal-info-row">${nome ? escapeHtml(nome) : '<span style="opacity:.3">NOME DA OBRA</span>'}</div>
      <div class="capal-info-row-hl">${mesAno}</div>
      ${iniStr ? `<div class="capal-info-row-hl">Semana do dia ${iniStr} a ${fimStr}</div>` : ''}
      ${v('c_eng') ? `<div style="font-size:9.5px;color:rgba(255,255,255,.45);margin-top:8px">Eng.: ${escapeHtml(v('c_eng'))}</div>` : ''}
    </div>
    <div class="capal-brand"><div class="capal-brand-txt">TRINUS · GERENCIAMENTO DE OBRAS</div></div>
    <div class="capal-accent-top"></div>
    <div class="capal-accent-bot"></div>
  </div>`;

  scaleCapaPreview();
}

// ── Modal de escolha de template ─────────────────────────────────────────────

function openModalTemplate() {
  document.getElementById('modalTemplate').classList.add('show');
}
function closeModalTemplate() {
  document.getElementById('modalTemplate').classList.remove('show');
}

// ── Registro de todos os event listeners ─────────────────────────────────────

function wireEvents() {
  // Navegação sidebar
  for (let i = 0; i < 9; i++) {
    document.getElementById('nav' + i)?.addEventListener('click', () => goPage(i));
  }

  // Botões de navegação nas páginas
  document.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => goPage(Number(btn.dataset.go)));
  });

  // Header + sidebar actions
  document.getElementById('btnBaixarTemplate')?.addEventListener('click', openModalTemplate);

  // Modal template
  document.getElementById('modalTemplateClose')?.addEventListener('click', closeModalTemplate);
  document.getElementById('modalTemplate')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModalTemplate();
  });
  document.getElementById('btnTemplateEmBranco')?.addEventListener('click', () => {
    closeModalTemplate();
    baixarTemplateEmBranco();
  });
  document.getElementById('btnTemplateDados')?.addEventListener('click', () => {
    closeModalTemplate();
    baixarTemplateComDados();
  });
  document.getElementById('btnSbGerar')?.addEventListener('click', gerarPDF);
  document.getElementById('btnSbXlsx')?.addEventListener('click', gerarXLSX);

  // Upload da base (async para chamar preview depois)
  document.getElementById('uploadFile')?.addEventListener('change', async function () {
    await processarBase(this);
    updateCapaPreview();
  });

  // Imagens da capa
  document.getElementById('logoInput')?.addEventListener('change', function () {
    loadImg('logo', this);
    setTimeout(updateCapaPreview, 300);
  });
  document.getElementById('fotoInput')?.addEventListener('change', function () {
    loadImg('foto', this);
    setTimeout(updateCapaPreview, 300);
  });

  // Anexos (6 slots)
  for (let i = 0; i < 6; i++) {
    document.getElementById('anFile' + i)?.addEventListener('change', function () { loadAnexo(i, this); });
    document.getElementById('anRemove' + i)?.addEventListener('click', () => removeAnexo(i));
    document.getElementById('anCaption' + i)?.addEventListener('input', () => syncAnexoCaption(i));
  }

  // Auto-semana ao mudar data de início — força recálculo sempre
  document.getElementById('c_ini')?.addEventListener('change', () => { autoWeek(true); updateCapaPreview(); });

  // Preview ao vivo — atualiza ao mudar qualquer campo da capa
  ['c_nome','c_ini','c_fim','c_sem','c_eng','c_obra','c_ger','c_avanco'].forEach(id => {
    document.getElementById(id)?.addEventListener('input',  updateCapaPreview);
    document.getElementById(id)?.addEventListener('change', updateCapaPreview);
  });

  // Persistência — salva ao alterar qualquer campo
  FORM_FIELDS.forEach(id => {
    document.getElementById(id)?.addEventListener('input', saveState);
    document.getElementById(id)?.addEventListener('change', saveState);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
// Em <script type="module"> o DOM já está pronto quando o módulo executa
// (módulos são deferred por padrão — não precisamos de DOMContentLoaded)

wireEvents();
restoreState();

const _ini = document.getElementById('c_ini');
if (_ini && !_ini.value) _ini.valueAsDate = new Date();
autoWeek();
updateCapaPreview();
window.addEventListener('resize', scaleCapaPreview);
window.lucide?.createIcons();
