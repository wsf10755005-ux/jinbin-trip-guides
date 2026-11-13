(() => {
  const status = document.getElementById('setup-status');
  const check = document.createElement('button'); check.type = 'button'; check.className = 'secondary full'; check.textContent = '檢查 Worker 與密碼設定';
  status.before(check);
  check.addEventListener('click', async () => {
    check.disabled = true;
    try {
      const r = await fetch('https://employee-trip-line-bot.wsf10755005.workers.dev/admin/health', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const result = await r.json();
      if (!r.ok || result.build !== 'workbook-vehicle-20261113') throw Error();
      status.textContent = result.adminConfigured ? 'Worker 已更新，管理密碼已設定。請開啟管理頁登入，核對 Apps Script 連線。' : 'Worker 已更新，還需要設定 ADMIN_PASSWORD 密鑰。';
    } catch { status.textContent = '尚未確認到新版 Worker，請完成第 2 步後再試一次。'; }
    finally { check.disabled = false; }
  });
  for (const [id, path, label] of [['copy-apps', '../update-line/apps-script.txt?v=workbook-vehicle-20261113', 'Apps Script'], ['copy-worker', '../update-line/worker.txt?v=workbook-vehicle-20261113', 'Worker']]) {
    const button = document.getElementById(id); let source = '';
    fetch(path, { cache: 'no-store' }).then(r => { if (!r.ok) throw Error(); return r.text(); }).then(text => {
      if (!text.includes('adminReminders') && !text.includes('handleAdminRequest')) throw Error();
      source = text; button.disabled = false; button.textContent = `複製完整 ${label} 程式`;
    }).catch(() => { button.textContent = '載入失敗，請重新整理'; });
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(source); button.textContent = `✓ 已複製 ${label} 程式`; status.textContent = '請貼到對應的後台，儲存並部署。'; }
      catch { const box = document.createElement('textarea'); box.value = source; box.setAttribute('aria-label', `${label} 完整程式`); box.style.width = '100%'; box.style.height = '200px'; button.after(box); box.focus(); box.select(); status.textContent = '請全選下方程式後手動複製。'; }
    });
  }
})();
