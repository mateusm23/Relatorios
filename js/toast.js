let _tt;

export function showToast(type, msg) {
  const t = document.getElementById('toast');
  document.getElementById('tMsg').textContent = msg;
  document.getElementById('tSpin').style.display = type === 'load' ? 'flex' : 'none';
  document.getElementById('tIco').textContent = type === 'ok' ? '✓' : type === 'err' ? '✕' : '';
  t.className = `toast show t-${type}`;
  clearTimeout(_tt);
  if (type !== 'load') _tt = setTimeout(() => t.classList.remove('show'), 5000);
}

export function setProgress(pct, msg) {
  document.getElementById('progFill').style.width = pct + '%';
  document.getElementById('progLbl').textContent = pct + '%';
  document.getElementById('overlayMsg').textContent = msg;
}

export function showOverlay() { document.getElementById('overlay').classList.add('show'); }
export function hideOverlay() { document.getElementById('overlay').classList.remove('show'); }
