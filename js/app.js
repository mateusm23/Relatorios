import { goPage }          from './nav.js';
import { showToast }        from './toast.js';
import { loadImg, loadAnexo, removeAnexo, syncAnexoCaption } from './images.js';
import { processarBase }    from './excel/reader.js';
import { gerarXLSX, baixarTemplate, baixarTemplateEmBranco } from './excel/exporter.js';
import { gerarPDF }         from './pdf/builder.js';
import { isoWeek }          from './utils.js';

// ── LocalStorage ──────────────────────────────────────────────────────────────

const LS_KEY = 'rso_form_state';
const FORM_FIELDS = ['c_nome','c_cod','c_ini','c_fim','c_sem','c_eng','c_obra','c_avanco','parecer','positivos','atencao','encam','anexosObs'];

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
  if (!ini || !semEl) return;
  if (!force && semEl.value) return;
  if (ini.value) semEl.value = isoWeek(new Date(ini.value + 'T12:00:00'));
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
    baixarTemplate();
  });
  document.getElementById('btnExportPDF')?.addEventListener('click', gerarPDF);
  document.getElementById('btnSbGerar')?.addEventListener('click', gerarPDF);
  document.getElementById('btnSbXlsx')?.addEventListener('click', gerarXLSX);

  // Upload da base
  document.getElementById('uploadFile')?.addEventListener('change', function () { processarBase(this); });

  // Imagens da capa
  document.getElementById('logoInput')?.addEventListener('change', function () { loadImg('logo', this); });
  document.getElementById('fotoInput')?.addEventListener('change', function () { loadImg('foto', this); });

  // Anexos (6 slots)
  for (let i = 0; i < 6; i++) {
    document.getElementById('anFile' + i)?.addEventListener('change', function () { loadAnexo(i, this); });
    document.getElementById('anRemove' + i)?.addEventListener('click', () => removeAnexo(i));
    document.getElementById('anCaption' + i)?.addEventListener('input', () => syncAnexoCaption(i));
  }

  // Auto-semana ao mudar data de início — força recálculo sempre
  document.getElementById('c_ini')?.addEventListener('change', () => autoWeek(true));

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
const _fim = document.getElementById('c_fim');
if (_ini && !_ini.value) _ini.valueAsDate = new Date();
if (_fim && !_fim.value) _fim.valueAsDate = new Date();
autoWeek();
