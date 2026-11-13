(() => {
  const button = document.getElementById('copy-apps');
  const status = document.getElementById('setup-status');
  let source = '';
  fetch('../update-line/apps-script.txt?v=agency-layout-20261113', { cache: 'no-store' })
    .then(response => { if (!response.ok) throw Error(); return response.text(); })
    .then(text => {
      if (!text.includes("build: 'agency-layout-20261113'") || !text.includes('tripImportDiningTables_')) throw Error();
      source = text; button.disabled = false; button.textContent = '複製完整 Apps Script 程式';
    })
    .catch(() => { button.textContent = '載入失敗，請重新整理'; });
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(source);
      button.textContent = '✓ 已複製完整程式';
      status.textContent = '請開啟 Apps Script，貼上、儲存，再更新原本的部署。';
    } catch {
      let box = document.getElementById('manual-source');
      if (!box) {
        box = document.createElement('textarea'); box.id = 'manual-source';
        box.setAttribute('aria-label', 'Apps Script 完整程式');
        box.style.width = '100%'; box.style.height = '200px'; button.after(box);
      }
      box.value = source; box.focus(); box.select();
      status.textContent = '請全選上方程式後手動複製。';
    }
  });
})();
