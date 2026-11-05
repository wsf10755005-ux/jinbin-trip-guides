(() => {
  'use strict';
  const API = 'https://employee-trip-line-bot.wsf10755005.workers.dev';
  const KEY = 'jinbin-reminder-admin-session';
  const $ = id => document.getElementById(id);
  const state = { token: '', routes: [], reminders: [], offset: 0, editing: null, submission: null, filter: 'upcoming', saving: false, refresh: false };
  try { state.token = sessionStorage.getItem(KEY) || ''; } catch {}
  const now = () => Date.now() + state.offset;
  const localIso = ms => new Date(ms + 8 * 3600000).toISOString();
  const day = ms => localIso(ms).slice(0, 10);
  const stamp = ms => { const iso = localIso(ms); return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`; };
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };

  function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); $('status').hidden = !text; }
  function storeToken(token) { state.token = token; try { if (token) sessionStorage.setItem(KEY, token); else sessionStorage.removeItem(KEY); } catch {} }
  function loginScreen() {
    if ($('confirmation').open) $('confirmation').close();
    $('app').hidden = true; $('login-panel').hidden = false; $('logout').hidden = true;
    state.routes = []; state.reminders = []; state.editing = null;
    state.submission = null; state.confirmAction = null;
    $('reminder-form').reset(); $('confirmation-body').replaceChildren();
    $('reminder-list').replaceChildren();
  }
  function logout() { storeToken(''); loginScreen(); status('已登出。'); }

  async function api(path, body, login = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (!login) headers.Authorization = 'Bearer ' + state.token;
    let response;
    try { response = await fetch(API + path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(22000) }); }
    catch { throw new Error('無法連線，請檢查網路後重試；不需要連按儲存。'); }
    let result;
    try { result = await response.json(); } catch { throw new Error('管理功能尚未連接完成，請確認後台程式已更新。'); }
    if (!response.ok) {
      if (response.status === 401 && !login) { storeToken(''); loginScreen(); }
      const error = new Error(result.error || '暫時無法處理，請稍後再試。'); error.code = result.code; throw error;
    }
    return result;
  }

  function tab(which) {
    const editing = which === 'new';
    $('editor').hidden = !editing; $('listing').hidden = editing;
    $('tab-new').classList.toggle('active', editing); $('tab-list').classList.toggle('active', !editing);
    $('tab-new').setAttribute('aria-selected', String(editing)); $('tab-list').setAttribute('aria-selected', String(!editing));
  }

  function routes() {
    const selected = $('route').value;
    return selected === 'ALL' ? state.routes : state.routes.filter(r => r.id === selected);
  }

  function formTime() {
    const date = $('date').value, time = $('time').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
    const ms = Date.parse(`${date}T${time}:00+08:00`);
    return Number.isFinite(ms) && localIso(ms).slice(0, 16) === `${date}T${time}` ? ms : null;
  }

  function updateHints() {
    const selected = routes(), count = selected.reduce((sum, r) => sum + r.recipientCount, 0);
    $('recipient-hint').textContent = selected.length ? `目前 ${count} 位有效綁定員工；發送時依實際綁定名單為準。${!count ? '目前尚無有效收件人。' : ''}` : '依所選路線的有效綁定名單發送。';
    const ms = formTime(), invalid = ms !== null && ms < now() + 11 * 60000;
    $('send-time').classList.toggle('invalid', invalid);
    $('send-time').textContent = ms === null ? '提醒會在集合前 10 分鐘自動發送。' : invalid ? '這個時間太接近或已過期，請選擇至少 11 分鐘後。' : `預計提醒時間：${stamp(ms - 10 * 60000)}（台灣時間）`;
  }

  function resetEditor() {
    state.editing = null; state.submission = null; $('reminder-form').reset(); $('date').value = day(now()); $('date').min = day(now());
    const all = $('route').querySelector('[value="ALL"]'); if (all) all.disabled = false;
    $('editor-title').textContent = '新增集合提醒'; $('stop-edit').hidden = true; updateHints();
  }

  function routeOptions() {
    const selected = $('route').value;
    $('route').replaceChildren(new Option('請選擇路線', ''));
    for (const r of state.routes) $('route').append(new Option(`${r.id}｜${r.name}`, r.id));
    if (state.routes.length > 1) $('route').append(new Option('兩個方案都通知', 'ALL'));
    $('route').value = selected;
    if (state.editing) { $('route').value = state.editing.routeId; const all = $('route').querySelector('[value="ALL"]'); if (all) all.disabled = true; }
    updateHints();
  }

  function badge(item) {
    if (item.status === '已發送') return ['已發送', 'sent'];
    if (['取消', '停用'].includes(item.status)) return ['已取消', 'cancelled'];
    if (!item.meetingMs) return ['日期待確認', 'expired'];
    if (item.meetingMs <= now()) return ['已逾集合時間', 'expired'];
    if (item.sendMs <= now()) return ['已到提醒時段', 'sending'];
    return ['待發送', ''];
  }

  function list() {
    const container = $('reminder-list'); container.replaceChildren();
    const items = state.reminders.filter(item => state.filter === 'all' || (item.meetingMs > now() && !['已發送', '取消', '停用'].includes(item.status)));
    $('reminder-count').textContent = `(${state.reminders.length})`;
    if (!items.length) { container.append(el('p', state.filter === 'all' ? '目前沒有集合提醒。' : '目前沒有等待發送的提醒。', 'empty')); return; }
    for (const item of items) {
      const card = el('article', undefined, 'reminder-card'), top = el('div', undefined, 'card-top'), meta = el('div');
      meta.append(el('p', `${item.routeId}｜${item.routeName}`, 'route-name'), el('h3', item.meetingMs ? stamp(item.meetingMs) : `${item.date} ${item.time}`, 'meeting-date'));
      const [label, type] = badge(item); top.append(meta, el('span', label, 'badge ' + type)); card.append(top);
      if (item.placeName) card.append(el('p', item.placeName, 'place-name'));
      if (item.mapUrl) { try { const url = new URL(item.mapUrl); if (url.protocol === 'https:' && !url.username && !url.password) { const link = el('a', '開啟集合地圖 ↗', 'map-link'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link); } } catch {} }
      card.append(el('p', item.sendMs ? `提醒時間：${stamp(item.sendMs)}` : '請確認這筆的日期時間。', 'card-send'));
      if (item.canEdit || item.canCancel) {
        const actions = el('div', undefined, 'card-actions');
        if (item.canEdit) { const edit = el('button', '修改'); edit.type = 'button'; edit.addEventListener('click', () => editItem(item)); actions.append(edit); }
        if (item.canCancel) { const cancel = el('button', '取消提醒', 'cancel-button'); cancel.type = 'button'; cancel.addEventListener('click', () => cancelItem(item)); actions.append(cancel); }
        card.append(actions);
      }
      container.append(card);
    }
  }

  async function refresh() {
    if (state.refresh) return;
    state.refresh = true; $('refresh').disabled = true;
    try {
      const result = await api('/admin/reminders');
      if (!Array.isArray(result.routes) || !Array.isArray(result.reminders) || !Number.isFinite(result.serverNow)) throw new Error('後台資料不完整，請稍後再試。');
      state.offset = result.serverNow - Date.now(); state.routes = result.routes; state.reminders = result.reminders;
      routeOptions(); list(); $('updated-at').textContent = `最後更新：${stamp(now())}；最多顯示最近 100 筆。`;
    } finally { state.refresh = false; $('refresh').disabled = false; }
  }

  async function enter() {
    await refresh(); $('login-panel').hidden = true; $('app').hidden = false; $('logout').hidden = false; $('password').value = ''; resetEditor();
  }

  function editItem(item) {
    state.editing = item; state.submission = null;
    $('editor-title').textContent = '修改集合提醒'; $('stop-edit').hidden = false;
    $('route').value = item.routeId; $('date').value = item.date; $('time').value = item.time; $('place').value = item.placeName; $('map').value = item.mapUrl;
    const all = $('route').querySelector('[value="ALL"]'); if (all) all.disabled = true;
    updateHints(); status(''); tab('new'); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function dialog(title, content, confirmLabel, action) {
    $('confirmation-title').textContent = title; $('confirmation-body').replaceChildren(content); $('confirm').textContent = confirmLabel;
    $('confirmation-error').hidden = true; $('dismiss').textContent = confirmLabel === '確認取消' ? '保留提醒' : '返回修改';
    state.confirmAction = action; $('confirmation').showModal();
  }

  function preview(event) {
    event.preventDefault(); status('');
    const selected = routes(), ms = formTime();
    if (!selected.length) { status('請先選擇路線。', true); return; }
    if (!ms || ms < now() + 11 * 60000) { updateHints(); status('集合時間需距現在至少 11 分鐘。', true); return; }
    const placeName = $('place').value.trim().replace(/\s+/g, ' '); let mapUrl = $('map').value.trim();
    if (mapUrl) { try { const url = new URL(mapUrl); if (url.protocol !== 'https:' || url.username || url.password) throw Error(); mapUrl = url.href; } catch { status('請貼上 HTTPS 地圖分享連結。', true); return; } }
    const place = [placeName, mapUrl].filter(Boolean).join('\n');
    if (!place || place.length > 200 || /^[=+\-@]/.test(placeName)) { status('請填集合地點或地圖連結，合計最多 200 字；網址太長時，請使用地圖分享短連結。', true); return; }
    const payload = { operation: state.editing ? 'update' : 'create', routeIds: selected.map(r => r.id), date: $('date').value, time: $('time').value, placeName, mapUrl };
    if (state.editing) { payload.id = state.editing.id; payload.rowNumber = state.editing.rowNumber; payload.version = state.editing.version; }
    else {
      const signature = JSON.stringify(payload);
      if (!state.submission || state.submission.signature !== signature) state.submission = { signature, id: crypto.randomUUID() };
      payload.submissionId = state.submission.id;
    }
    const body = el('div'), info = el('dl', undefined, 'preview-info'), names = selected.map(r => `${r.id} ${r.name}`).join('、');
    for (const [label, value] of [['通知路線', names], ['集合時間', stamp(ms)], ['提醒時間', stamp(ms - 10 * 60000)], ['集合地點', place]]) info.append(el('dt', label), el('dd', value));
    body.append(info, el('p', '員工收到的提醒內容', 'preview-label'), el('div', `時間快到囉～僅剩十分鐘，集合地點在${place.replaceAll('\n', ' ')}\n路線：${selected.length > 1 ? '各自所屬路線名稱' : selected[0].name}\n集合時間：${stamp(ms)}\n集合地點：${place}`, 'message-preview'), el('p', `目前共 ${selected.reduce((sum, r) => sum + r.recipientCount, 0)} 位有效綁定員工；實際發送依當時的綁定名單。${selected.length > 1 ? '兩方案會分別發送。' : ''}`, 'dialog-note'));
    dialog(state.editing ? '確認修改提醒' : '確認新增提醒', body, '確認儲存', () => save(payload, `已儲存。預計 ${stamp(ms - 10 * 60000)} 提醒。`));
  }

  function cancelItem(item) {
    const body = el('p', undefined, 'cancel-confirm'); body.append(document.createTextNode(`確定取消 ${item.routeId} 在 ${stamp(item.meetingMs)} 的集合提醒嗎？取消後不再排程發送。`));
    dialog('取消集合提醒', body, '確認取消', () => save({ operation: 'cancel', id: item.id, rowNumber: item.rowNumber, version: item.version }, '已取消這筆提醒。'));
  }

  async function save(payload, message) {
    if (state.saving) return;
    state.saving = true; $('confirm').disabled = true; $('dismiss').disabled = true; $('confirmation-error').hidden = true;
    try {
      await api('/admin/reminders', payload); $('confirmation').close(); resetEditor(); tab('list'); status(message);
      try { await refresh(); } catch { status(message + ' 列表暫時無法更新，請稍後重新整理。'); }
    } catch (error) {
      if ($('confirmation').open) { $('confirmation-error').textContent = error.message; $('confirmation-error').hidden = false; }
      else status(error.message, true);
    } finally { state.saving = false; $('confirm').disabled = false; $('dismiss').disabled = false; }
  }

  $('login-form').addEventListener('submit', async event => {
    event.preventDefault(); $('login-button').disabled = true; status('');
    try { const result = await api('/admin/login', { password: $('password').value }, true); if (typeof result.token !== 'string' || !result.token) throw new Error('登入回應不完整。'); storeToken(result.token); await enter(); }
    catch (error) { status(error.message, true); }
    finally { $('login-button').disabled = false; }
  });
  $('show-password').addEventListener('click', () => { const show = $('password').type === 'password'; $('password').type = show ? 'text' : 'password'; $('show-password').textContent = show ? '隱藏' : '顯示'; $('show-password').setAttribute('aria-pressed', String(show)); });
  $('logout').addEventListener('click', logout);
  $('tab-new').addEventListener('click', () => tab('new')); $('tab-list').addEventListener('click', () => { tab('list'); refresh().catch(error => status(error.message, true)); });
  $('stop-edit').addEventListener('click', resetEditor); $('reminder-form').addEventListener('submit', preview);
  for (const id of ['route', 'date', 'time']) $(id).addEventListener('change', updateHints);
  $('refresh').addEventListener('click', () => refresh().catch(error => status(error.message, true)));
  $('dismiss').addEventListener('click', () => { if (!state.saving) $('confirmation').close(); });
  $('confirm').addEventListener('click', () => { if (state.confirmAction) state.confirmAction(); });
  $('confirmation').addEventListener('cancel', event => { if (state.saving) event.preventDefault(); });
  for (const filter of ['upcoming', 'all']) $('filter-' + filter).addEventListener('click', () => { state.filter = filter; $('filter-upcoming').classList.toggle('selected', filter === 'upcoming'); $('filter-all').classList.toggle('selected', filter === 'all'); list(); });
  setInterval(() => { if (state.token && !document.hidden && !state.saving) refresh().catch(error => status(error.message, true)); }, 60000);
  if (state.token) enter().catch(error => { loginScreen(); status(error.message, true); });
})();
