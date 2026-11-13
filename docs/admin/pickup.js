(() => {
  const status = document.getElementById('setup-status');
  for (const [id, file, label] of [['copy-apps', 'apps-script.txt', 'Apps Script'], ['copy-worker', 'worker.txt', 'Worker']]) {
    const button = document.getElementById(id); let source = '';
    fetch(`../update-line/${file}?v=pickup-20261113`, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw Error(); return r.text(); })
      .then(text => {
        if (!text.includes('pickup-20261113') || !text.includes('meetingPointCode')) throw Error();
        source = text; button.disabled = false; button.textContent = `複製完整 ${label} 程式`;
      }).catch(() => { button.textContent = '載入失敗，請重新整理'; });
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(source); button.textContent = `✓ 已複製 ${label}`; status.textContent = '請貼上、儲存，再部署。'; }
      catch {
        let box = document.getElementById(`${id}-source`);
        if (!box) { box = document.createElement('textarea'); box.id = `${id}-source`; box.setAttribute('aria-label', `${label} 完整程式`); box.style.width = '100%'; box.style.height = '200px'; button.after(box); }
        box.value = source; box.focus(); box.select(); status.textContent = '請全選程式後手動複製。';
      }
    });
  }
})();
