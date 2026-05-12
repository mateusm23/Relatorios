const completedPages = new Set();
let curPage = 0;

export function getCurPage() { return curPage; }

export function goPage(n) {
  // marca a página atual como concluída ao avançar (não ao voltar)
  if (n > curPage) completedPages.add(curPage);

  document.querySelectorAll('.page').forEach((p, i) => {
    p.className = 'page' + (i === n ? ' on' : '');
  });

  for (let i = 0; i < 9; i++) {
    const el = document.getElementById('nav' + i);
    if (!el) continue;
    let cls = 'sb-item';
    if (i === n) cls += ' active';
    else if (completedPages.has(i)) cls += ' done';
    el.className = cls;
  }

  curPage = n;
  document.getElementById('mainContent').scrollTop = 0;
}

export function markDone(n) {
  completedPages.add(n);
  const el = document.getElementById('nav' + n);
  if (el && curPage !== n) el.className = 'sb-item done';
}
