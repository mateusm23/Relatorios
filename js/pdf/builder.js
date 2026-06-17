import { v } from '../utils.js';
import { sleep } from '../utils.js';
import { showToast, setProgress, showOverlay, hideOverlay } from '../toast.js';
import { goPage } from '../nav.js';
import { buildPages } from './pages.js';

export async function gerarPDF() {
  if (!v('c_nome')) { showToast('err', '❌ Preencha o nome da obra na Capa'); goPage(1); return; }

  showOverlay();
  setProgress(0, 'Preparando páginas...');
  await sleep(100);

  try {
    const { jsPDF } = window.jspdf;
    const semStr   = v('c_sem') || 'XX';
    const iniStr   = v('c_ini') ? new Date(v('c_ini')).toLocaleDateString('pt-BR') : '';
    const fimStr   = v('c_fim') ? new Date(v('c_fim')).toLocaleDateString('pt-BR') : '';
    const nomeObra = v('c_nome');
    const container = document.getElementById('pdfContainer');

    const pages = buildPages(semStr, iniStr, fimStr, nomeObra);
    let pdf = null;

    for (let i = 0; i < pages.length; i++) {
      setProgress(Math.round((i / pages.length) * 88), `Renderizando página ${i + 1} de ${pages.length}...`);
      await sleep(60);

      container.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.innerHTML = pages[i].html;
      container.appendChild(wrapper.firstElementChild);
      await sleep(120);

      const isLand = pages[i].landscape;
      const W = isLand ? 1123 : 794;
      const H = isLand ? 794  : 1123;

      const canvas = await window.html2canvas(container.firstElementChild, {
        scale: 3, useCORS: true, allowTaint: true,
        backgroundColor: '#ffffff', logging: false,
        width: W, height: H, windowWidth: W,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.93);

      if (i === 0) {
        pdf = new jsPDF({
          orientation: isLand ? 'landscape' : 'portrait',
          unit: 'mm',
          format: isLand ? [297, 210] : 'a4',
        });
      } else {
        pdf.addPage(isLand ? [297, 210] : 'a4', isLand ? 'landscape' : 'portrait');
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, isLand ? 297 : 210, isLand ? 210 : 297);
    }

    setProgress(96, 'Finalizando...');
    await sleep(300);
    container.innerHTML = '';

    const nome = nomeObra.replace(/\s+/g, '_').toUpperCase();
    pdf.save(`RLT_SEM${semStr}_${nome}.pdf`);
    setProgress(100, 'Concluído!');
    await sleep(400);
    hideOverlay();
    showToast('ok', `✅ PDF gerado — ${pages.length} páginas`);
  } catch (e) {
    hideOverlay();
    showToast('err', '❌ Erro: ' + e.message);
    console.error(e);
  }
}
