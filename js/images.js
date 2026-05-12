import { DB } from './state.js';

export function loadImg(tipo, input) {
  const f = input.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    DB[tipo] = e.target.result;
    const zone = document.getElementById(tipo + 'Zone');
    let img = zone.querySelector('img');
    if (!img) { img = document.createElement('img'); zone.appendChild(img); }
    img.src = e.target.result;
    const lbl = zone.querySelector('.img-zone-lbl');
    if (lbl) lbl.style.opacity = '0';
  };
  r.readAsDataURL(f);
}

export function loadAnexo(idx, input) {
  const f = input.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    const caption = document.getElementById('anCaption' + idx)?.value || '';
    DB.anexos[idx] = { src: e.target.result, caption };

    const slot = document.getElementById('an' + idx);
    let img = slot.querySelector('.an-img');
    if (!img) {
      img = document.createElement('img');
      img.className = 'an-img';
      Object.assign(img.style, {
        position: 'absolute', inset: '0', width: '100%', height: '100%',
        objectFit: 'cover', borderRadius: '7px'
      });
      slot.appendChild(img);
    }
    img.src = e.target.result;
    slot.querySelector('.an-label').style.display = 'none';

    const removeBtn = document.getElementById('anRemove' + idx);
    if (removeBtn) removeBtn.style.display = 'flex';
  };
  r.readAsDataURL(f);
}

export function removeAnexo(idx) {
  DB.anexos[idx] = null;
  const slot = document.getElementById('an' + idx);
  const img = slot.querySelector('.an-img');
  if (img) { img.src = ''; img.style.display = 'none'; }
  slot.querySelector('.an-label').style.display = '';

  const caption = document.getElementById('anCaption' + idx);
  if (caption) caption.value = '';

  const removeBtn = document.getElementById('anRemove' + idx);
  if (removeBtn) removeBtn.style.display = 'none';

  const fileInput = slot.querySelector('input[type="file"]');
  if (fileInput) fileInput.value = '';
}

export function syncAnexoCaption(idx) {
  if (DB.anexos[idx]) {
    DB.anexos[idx].caption = document.getElementById('anCaption' + idx)?.value || '';
  }
}
