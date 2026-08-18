let registrantsCache = [];
let tradingAccountsByRegistrant = {};
let currentAdminRole = null;
let currentUserId = null;
let currentPermissions = [];

// Captured synchronously before Supabase's client can process/strip it.
const initialAuthHash = window.location.hash;
const isInviteLink = initialAuthHash.includes('type=invite') || initialAuthHash.includes('type=recovery');

const PERMISSION_MODULES = [
  { key: 'registrants', label: 'Registrants' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'raffle', label: 'Raffle' },
  { key: 'prizes', label: 'Prizes' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'settings', label: 'Settings' },
];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function permChecklistHtml(namePrefix, checked) {
  return PERMISSION_MODULES.map(m => `
    <label>
      <input type="checkbox" class="${namePrefix}-perm" value="${m.key}" ${checked.includes(m.key) ? 'checked' : ''}>
      ${m.label}
    </label>
  `).join('');
}

document.getElementById('admin-add-permissions').innerHTML = permChecklistHtml('add', []);

function showLoginMsg(text, type) {
  const el = document.getElementById('login-msg');
  el.textContent = text;
  el.className = 'form-msg ' + (type || '');
}

function showScreen(name) {
  document.getElementById('login-screen').style.display = name === 'login' ? 'block' : 'none';
  document.getElementById('set-password-screen').style.display = name === 'set-password' ? 'block' : 'none';
  document.getElementById('suspended-screen').style.display = name === 'suspended' ? 'block' : 'none';
  document.getElementById('admin-panel').style.display = name === 'panel' ? 'block' : 'none';
}

async function showPanel(loggedIn, email, userId) {
  if (!loggedIn) {
    showScreen('login');
    return;
  }

  const { data: myAdmin, error } = await supabaseClient
    .from('admins')
    .select('role, is_active, permissions')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !myAdmin || !myAdmin.is_active) {
    showScreen('suspended');
    return;
  }

  currentAdminRole = myAdmin.role;
  currentUserId = userId;
  currentPermissions = myAdmin.permissions || [];

  showScreen('panel');
  document.getElementById('admin-email').textContent = email || '';
  document.querySelectorAll('.super-only').forEach(el => {
    el.style.display = currentAdminRole === 'super_admin' ? '' : 'none';
  });

  const isSuper = currentAdminRole === 'super_admin';
  let firstVisibleTab = null;
  document.querySelectorAll('.admin-tab[data-tab]').forEach(tab => {
    const module = tab.dataset.tab;
    if (module === 'admins') return; // handled by .super-only above
    const allowed = isSuper || currentPermissions.includes(module);
    tab.style.display = allowed ? '' : 'none';
    if (allowed && !firstVisibleTab) firstVisibleTab = tab;
  });

  document.getElementById('no-access-msg').style.display = firstVisibleTab ? 'none' : 'block';

  if (firstVisibleTab && !firstVisibleTab.classList.contains('active')) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel-section').forEach(p => p.style.display = 'none');
    firstVisibleTab.classList.add('active');
    document.getElementById('panel-' + firstVisibleTab.dataset.tab).style.display = 'block';
  }

  loadAll();
}

function showSetPasswordMsg(text, type) {
  const el = document.getElementById('set-password-msg');
  el.textContent = text;
  el.className = 'form-msg ' + (type || '');
}

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();

  if (isInviteLink && data.session) {
    showScreen('set-password');
    return;
  }

  await showPanel(!!data.session, data.session?.user?.email, data.session?.user?.id);
}

document.querySelectorAll('.password-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.textContent = showing ? '👁' : '🙈';
    btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });
});

document.getElementById('set-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (password !== confirmPassword) {
    showSetPasswordMsg('Passwords do not match.', 'error');
    return;
  }

  const btn = document.getElementById('set-password-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const { data, error } = await supabaseClient.auth.updateUser({ password });

  btn.disabled = false;
  btn.textContent = 'Set Password & Continue';

  if (error) {
    showSetPasswordMsg(error.message, 'error');
    return;
  }

  await showPanel(true, data.user?.email, data.user?.id);
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  showLoginMsg('Logging in…', '');
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showLoginMsg(error.message, 'error');
    return;
  }
  showLoginMsg('', '');
  await showPanel(true, data.user?.email, data.user?.id);
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  showPanel(false);
});

document.getElementById('suspended-logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  showPanel(false);
});

document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel-section').forEach(p => p.style.display = 'none');
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).style.display = 'block';
  });
});

function loadAll() {
  loadRegistrants();
  loadLeaderboard();
  loadRaffle();
  loadPrizes();
  loadAnnouncementsAdmin();
  loadCampaignSettings();
  if (currentAdminRole === 'super_admin') loadAdmins();
}

// ---------- Registrants ----------
async function loadRegistrants() {
  const [{ data, error }, { data: accounts, error: acctError }] = await Promise.all([
    supabaseClient.from('registrants').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('trading_accounts').select('registrant_id, account_number').order('created_at'),
  ]);
  const body = document.getElementById('registrants-body');
  if (error) { body.innerHTML = `<tr><td colspan="6">Error: ${esc(error.message)}</td></tr>`; return; }

  tradingAccountsByRegistrant = {};
  if (!acctError && accounts) {
    accounts.forEach(a => {
      (tradingAccountsByRegistrant[a.registrant_id] ||= []).push(a.account_number);
    });
  }

  registrantsCache = data;
  populateRegistrantSelects(data);

  body.innerHTML = data.length ? data.map(r => `
    <tr data-id="${r.id}">
      <td>${esc(r.full_name)}</td>
      <td>${esc(r.email)}</td>
      <td>${esc(r.account_type)}</td>
      <td>${esc((tradingAccountsByRegistrant[r.id] || []).join(', ') || '—')}</td>
      <td>${new Date(r.created_at).toLocaleDateString()}</td>
      <td><button class="btn btn-sm btn-danger" data-action="del-registrant">Delete</button></td>
    </tr>
  `).join('') : '<tr><td colspan="6" class="loading-row">No registrants yet.</td></tr>';
}

function populateRegistrantSelects(data) {
  const opts = data.map(r => `<option value="${r.id}">${esc(r.full_name)} (${esc(r.email)})</option>`).join('');
  document.getElementById('lb-registrant').innerHTML = '<option value="">— no registrant link —</option>' + opts;
  document.getElementById('raffle-registrant').innerHTML = '<option value="">— select registrant —</option>' + opts;
}

document.getElementById('lb-registrant').addEventListener('change', (e) => {
  const accounts = tradingAccountsByRegistrant[e.target.value] || [];
  const select = document.getElementById('lb-trading-account');
  select.innerHTML = accounts.length
    ? accounts.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')
    : '<option value="">— no accounts on file —</option>';
});

document.getElementById('registrants-body').addEventListener('click', async (e) => {
  if (e.target.dataset.action !== 'del-registrant') return;
  const tr = e.target.closest('tr');
  if (!confirm('Delete this registrant? Their leaderboard/raffle records will also be removed.')) return;
  const { error } = await supabaseClient.from('registrants').delete().eq('id', tr.dataset.id);
  if (error) { alert(error.message); return; }
  loadAll();
});

// ---------- Leaderboard ----------
async function loadLeaderboard() {
  const { data, error } = await supabaseClient.from('leaderboard_entries').select('*').order('risk_adjusted_score', { ascending: false });
  const body = document.getElementById('lb-body');
  if (error) { body.innerHTML = `<tr><td colspan="13">Error: ${esc(error.message)}</td></tr>`; return; }

  body.innerHTML = data.length ? data.map(row => {
    const accounts = tradingAccountsByRegistrant[row.registrant_id] || [];
    const acctOptions = accounts.length
      ? accounts.map(a => `<option value="${esc(a)}" ${row.trading_account_number === a ? 'selected' : ''}>${esc(a)}</option>`).join('')
      : `<option value="${esc(row.trading_account_number || '')}" selected>${esc(row.trading_account_number || '— none —')}</option>`;
    return `
    <tr data-id="${row.id}">
      <td><input type="text" class="f-alias" value="${esc(row.trader_alias)}"></td>
      <td><select class="f-trading-account">${acctOptions}</select></td>
      <td><select class="f-account_type"><option value="classic" ${row.account_type==='classic'?'selected':''}>Classic</option><option value="raw" ${row.account_type==='raw'?'selected':''}>RAW</option></select></td>
      <td><input type="number" step="0.01" class="f-deposit" value="${row.initial_deposit}"></td>
      <td><input type="number" step="0.01" class="f-profit" value="${row.net_profit}"></td>
      <td><input type="number" step="0.01" class="f-drawdown" value="${row.max_drawdown_pct}"></td>
      <td><input type="number" step="0.01" class="f-lots" value="${row.lots_traded}"></td>
      <td><input type="number" step="1" class="f-weeks" value="${row.weeks_active}"></td>
      <td>${row.roi_pct}%</td>
      <td>${row.risk_adjusted_score}</td>
      <td>${row.is_qualified ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-red">No</span>'}</td>
      <td class="row-actions">
        <button class="btn btn-sm btn-save" data-action="save-lb">Save</button>
        <button class="btn btn-sm btn-danger" data-action="del-lb">Delete</button>
      </td>
      <td><button class="btn btn-sm" data-action="history-lb">History</button></td>
    </tr>`;
  }).join('') : '<tr><td colspan="13" class="loading-row">No leaderboard entries yet.</td></tr>';
}

const LB_FIELD_LABELS = {
  trader_alias: 'Alias',
  trading_account_number: 'Trading Account',
  account_type: 'Account Type',
  initial_deposit: 'Deposit',
  net_profit: 'Net Profit',
  max_drawdown_pct: 'Drawdown %',
  lots_traded: 'Lots',
  weeks_active: 'Weeks Active',
  registrant_id: 'Registrant',
};

async function toggleLbHistory(tr, id) {
  const existing = tr.nextElementSibling;
  if (existing && existing.classList.contains('lb-history-row')) {
    existing.remove();
    return;
  }
  document.querySelectorAll('.lb-history-row').forEach(r => r.remove());

  const historyRow = document.createElement('tr');
  historyRow.className = 'lb-history-row';
  historyRow.innerHTML = `<td colspan="13" class="loading-row">Loading history…</td>`;
  tr.after(historyRow);

  const { data, error } = await supabaseClient
    .from('leaderboard_entry_history')
    .select('*')
    .eq('leaderboard_entry_id', id)
    .order('changed_at', { ascending: false });

  if (error) { historyRow.innerHTML = `<td colspan="13">Error: ${esc(error.message)}</td>`; return; }
  if (!data.length) { historyRow.innerHTML = `<td colspan="13" class="loading-row">No edits recorded for this entry yet.</td>`; return; }

  historyRow.innerHTML = `<td colspan="13"><div class="history-list">${data.map(h => {
    const changes = Object.keys(LB_FIELD_LABELS)
      .filter(k => JSON.stringify(h.old_data[k]) !== JSON.stringify(h.new_data[k]))
      .map(k => `<li><strong>${LB_FIELD_LABELS[k]}:</strong> ${esc(h.old_data[k])} → ${esc(h.new_data[k])}</li>`)
      .join('');
    return `<div class="history-entry">
      <div class="history-meta">${new Date(h.changed_at).toLocaleString()} · by ${esc(h.changed_by)}</div>
      <ul>${changes || '<li>No tracked fields changed</li>'}</ul>
    </div>`;
  }).join('')}</div></td>`;
}

document.getElementById('lb-body').addEventListener('click', async (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  const tr = e.target.closest('tr');
  const id = tr.dataset.id;

  if (action === 'history-lb') {
    await toggleLbHistory(tr, id);
    return;
  }

  if (action === 'del-lb') {
    if (!confirm('Delete this leaderboard entry?')) return;
    const { error } = await supabaseClient.from('leaderboard_entries').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    loadLeaderboard();
    return;
  }

  if (action === 'save-lb') {
    const payload = {
      trader_alias: tr.querySelector('.f-alias').value,
      trading_account_number: tr.querySelector('.f-trading-account').value || null,
      account_type: tr.querySelector('.f-account_type').value,
      initial_deposit: parseFloat(tr.querySelector('.f-deposit').value),
      net_profit: parseFloat(tr.querySelector('.f-profit').value),
      max_drawdown_pct: parseFloat(tr.querySelector('.f-drawdown').value),
      lots_traded: parseFloat(tr.querySelector('.f-lots').value),
      weeks_active: parseInt(tr.querySelector('.f-weeks').value, 10),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseClient.from('leaderboard_entries').update(payload).eq('id', id);
    if (error) { alert(error.message); return; }
    loadLeaderboard();
  }
});

document.getElementById('lb-add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const registrant_id = document.getElementById('lb-registrant').value || null;
  const payload = {
    registrant_id,
    trader_alias: document.getElementById('lb-alias').value,
    trading_account_number: document.getElementById('lb-trading-account').value || null,
    account_type: document.getElementById('lb-account-type').value,
    initial_deposit: parseFloat(document.getElementById('lb-deposit').value),
    net_profit: parseFloat(document.getElementById('lb-profit').value),
    max_drawdown_pct: parseFloat(document.getElementById('lb-drawdown').value),
    lots_traded: parseFloat(document.getElementById('lb-lots').value),
    weeks_active: parseInt(document.getElementById('lb-weeks').value, 10),
  };
  const { error } = await supabaseClient.from('leaderboard_entries').insert(payload);
  if (error) { alert(error.message); return; }
  e.target.reset();
  document.getElementById('lb-account-type').value = 'classic';
  document.getElementById('lb-deposit').value = 500;
  document.getElementById('lb-lots').value = 5;
  document.getElementById('lb-weeks').value = 3;
  document.getElementById('lb-trading-account').innerHTML = '<option value="">— select registrant first —</option>';
  loadLeaderboard();
});

// ---------- Raffle ----------
async function loadRaffle() {
  const { data, error } = await supabaseClient
    .from('raffle_entries')
    .select('id, entry_count, source, created_at, registrants(full_name, email)')
    .order('created_at', { ascending: false });
  const body = document.getElementById('raffle-body');
  if (error) { body.innerHTML = `<tr><td colspan="5">Error: ${esc(error.message)}</td></tr>`; return; }

  body.innerHTML = data.length ? data.map(row => `
    <tr data-id="${row.id}">
      <td>${row.registrants ? esc(row.registrants.full_name) + ' (' + esc(row.registrants.email) + ')' : '—'}</td>
      <td><span class="badge badge-navy">${esc(row.source)}</span></td>
      <td>${row.entry_count}</td>
      <td>${new Date(row.created_at).toLocaleString()}</td>
      <td><button class="btn btn-sm btn-danger" data-action="del-raffle">Delete</button></td>
    </tr>
  `).join('') : '<tr><td colspan="5" class="loading-row">No raffle entries yet.</td></tr>';
}

document.getElementById('raffle-body').addEventListener('click', async (e) => {
  if (e.target.dataset.action !== 'del-raffle') return;
  const tr = e.target.closest('tr');
  if (!confirm('Delete this raffle entry?')) return;
  const { error } = await supabaseClient.from('raffle_entries').delete().eq('id', tr.dataset.id);
  if (error) { alert(error.message); return; }
  loadRaffle();
});

document.getElementById('raffle-add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const registrant_id = document.getElementById('raffle-registrant').value;
  if (!registrant_id) { alert('Select a registrant.'); return; }
  const entry_count = parseInt(document.getElementById('raffle-count').value, 10);
  const { error } = await supabaseClient.from('raffle_entries').insert({ registrant_id, entry_count, source: 'admin_bonus' });
  if (error) { alert(error.message); return; }
  e.target.reset();
  document.getElementById('raffle-count').value = 1;
  loadRaffle();
});

// ---------- Prizes ----------
function prizeRowHtml(p) {
  return `
    <tr data-id="${p.id}">
      <td><input type="number" step="1" class="f-order" value="${p.sort_order}" style="width:60px;"></td>
      <td><input type="text" class="f-emoji" value="${esc(p.emoji)}" style="width:50px;"></td>
      <td><input type="text" class="f-label" value="${esc(p.label)}"></td>
      <td><input type="text" class="f-desc" value="${esc(p.description)}"></td>
      <td><input type="number" step="0.01" class="f-amount" value="${p.amount_usd}" style="width:100px;"></td>
      <td><input type="number" step="1" class="f-winners" value="${p.winner_count}" style="width:70px;"></td>
      <td class="row-actions">
        <button class="btn btn-sm btn-save" data-action="save-prize">Save</button>
        <button class="btn btn-sm btn-danger" data-action="del-prize">Delete</button>
      </td>
    </tr>`;
}

const PRIZE_CATEGORY_BODIES = {
  roi: 'prizes-roi-body',
  raffle: 'prizes-raffle-body',
  quarterly: 'prizes-quarterly-body',
};

async function loadPrizes() {
  const { data, error } = await supabaseClient.from('prizes').select('*').order('category').order('sort_order');
  if (error) {
    document.getElementById('prizes-roi-body').innerHTML = `<tr><td colspan="7">Error: ${esc(error.message)}</td></tr>`;
    return;
  }

  Object.entries(PRIZE_CATEGORY_BODIES).forEach(([category, bodyId]) => {
    const rows = data.filter(p => p.category === category);
    document.getElementById(bodyId).innerHTML = rows.length
      ? rows.map(prizeRowHtml).join('')
      : `<tr><td colspan="7" class="loading-row">No prizes yet.</td></tr>`;
  });
}

function addPrizeFormHtml(category) {
  return `
    <div class="card" id="prize-add-form" data-category="${category}" style="margin:12px 0 24px;">
      <h4 class="mt-0" style="margin-bottom:12px;">New ${esc(category)} prize</h4>
      <div class="admin-form-row">
        <input type="number" step="1" id="new-prize-order" placeholder="Order" value="1" style="width:70px;">
        <input type="text" id="new-prize-emoji" placeholder="Emoji" style="width:70px;">
        <input type="text" id="new-prize-label" placeholder="Label" required style="width:160px;">
        <input type="text" id="new-prize-desc" placeholder="Description" style="width:220px;">
        <input type="number" step="0.01" id="new-prize-amount" placeholder="Prize" value="0" style="width:110px;">
        <input type="number" step="1" id="new-prize-winners" placeholder="Winners" value="1" style="width:90px;">
        <button type="button" class="btn btn-primary btn-sm" id="save-new-prize-btn">Add</button>
        <button type="button" class="btn btn-sm" id="cancel-new-prize-btn">Cancel</button>
      </div>
    </div>`;
}

document.querySelectorAll('.btn-add-prize').forEach(btn => {
  btn.addEventListener('click', () => {
    const wrap = document.getElementById('prize-add-form-wrap');
    wrap.innerHTML = addPrizeFormHtml(btn.dataset.category);
    document.getElementById('cancel-new-prize-btn').addEventListener('click', () => { wrap.innerHTML = ''; });
    document.getElementById('save-new-prize-btn').addEventListener('click', async () => {
      const label = document.getElementById('new-prize-label').value.trim();
      if (!label) { alert('Label is required.'); return; }
      const payload = {
        category: btn.dataset.category,
        sort_order: parseInt(document.getElementById('new-prize-order').value, 10) || 1,
        emoji: document.getElementById('new-prize-emoji').value.trim(),
        label,
        description: document.getElementById('new-prize-desc').value.trim(),
        amount_usd: parseFloat(document.getElementById('new-prize-amount').value) || 0,
        winner_count: parseInt(document.getElementById('new-prize-winners').value, 10) || 1,
      };
      const { error } = await supabaseClient.from('prizes').insert(payload);
      if (error) { alert(error.message); return; }
      wrap.innerHTML = '';
      loadPrizes();
    });
  });
});

async function handlePrizeAction(e) {
  const action = e.target.dataset.action;
  if (!action) return;
  const tr = e.target.closest('tr');
  const id = tr.dataset.id;

  if (action === 'del-prize') {
    if (!confirm('Delete this prize?')) return;
    const { error } = await supabaseClient.from('prizes').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    loadPrizes();
    return;
  }

  if (action === 'save-prize') {
    const payload = {
      sort_order: parseInt(tr.querySelector('.f-order').value, 10),
      emoji: tr.querySelector('.f-emoji').value,
      label: tr.querySelector('.f-label').value,
      description: tr.querySelector('.f-desc').value,
      amount_usd: parseFloat(tr.querySelector('.f-amount').value),
      winner_count: parseInt(tr.querySelector('.f-winners').value, 10),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseClient.from('prizes').update(payload).eq('id', id);
    if (error) { alert(error.message); return; }
    loadPrizes();
  }
}

document.getElementById('prizes-roi-body').addEventListener('click', handlePrizeAction);
document.getElementById('prizes-raffle-body').addEventListener('click', handlePrizeAction);
document.getElementById('prizes-quarterly-body').addEventListener('click', handlePrizeAction);

// ---------- Announcements ----------
async function loadAnnouncementsAdmin() {
  const { data, error } = await supabaseClient.from('announcements').select('*').order('created_at', { ascending: false });
  const body = document.getElementById('ann-table-body');
  if (error) { body.innerHTML = `<tr><td colspan="6">Error: ${esc(error.message)}</td></tr>`; return; }

  body.innerHTML = data.length ? data.map(a => `
    <tr data-id="${a.id}">
      <td><strong>${esc(a.title)}</strong></td>
      <td>${esc(a.body || '—')}</td>
      <td><span class="badge badge-navy">${esc(a.severity)}</span></td>
      <td>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" class="f-active" ${a.is_active ? 'checked' : ''}> ${a.is_active ? 'Active' : 'Hidden'}
        </label>
      </td>
      <td>${new Date(a.created_at).toLocaleString()}</td>
      <td class="row-actions">
        <button class="btn btn-sm btn-danger" data-action="del-ann">Delete</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="6" class="loading-row">No announcements yet.</td></tr>';
}

document.getElementById('ann-add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('ann-title').value.trim(),
    body: document.getElementById('ann-body').value.trim(),
    severity: document.getElementById('ann-severity').value,
    is_active: true,
  };
  const { error } = await supabaseClient.from('announcements').insert(payload);
  if (error) { alert(error.message); return; }
  e.target.reset();
  document.getElementById('ann-severity').value = 'update';
  loadAnnouncementsAdmin();
});

document.getElementById('ann-table-body').addEventListener('click', async (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const id = tr.dataset.id;

  if (e.target.dataset.action === 'del-ann') {
    if (!confirm('Delete this announcement?')) return;
    const { error } = await supabaseClient.from('announcements').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    loadAnnouncementsAdmin();
    return;
  }

  if (e.target.classList.contains('f-active')) {
    const { error } = await supabaseClient.from('announcements')
      .update({ is_active: e.target.checked, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { alert(error.message); loadAnnouncementsAdmin(); return; }
    loadAnnouncementsAdmin();
  }
});

// ---------- Settings ----------
function toLocalDatetimeInputValue(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function loadCampaignSettings() {
  const { data, error } = await supabaseClient.from('campaign_settings').select('campaign_end_at').eq('id', 1).single();
  if (error || !data) return;
  document.getElementById('campaign-end').value = toLocalDatetimeInputValue(new Date(data.campaign_end_at));
}

function showSettingsMsg(text, type) {
  const el = document.getElementById('settings-msg');
  el.textContent = text;
  el.className = 'form-msg ' + (type || '');
}

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const localValue = document.getElementById('campaign-end').value;
  const campaign_end_at = new Date(localValue).toISOString();

  const { error } = await supabaseClient.from('campaign_settings')
    .update({ campaign_end_at, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) { showSettingsMsg(error.message, 'error'); return; }
  showSettingsMsg('Saved — the Overview page countdown will update.', 'success');
});

// ---------- Admins (super admin only) ----------
function showAdminAddMsg(text, type) {
  const el = document.getElementById('admin-add-msg');
  el.textContent = text;
  el.className = 'form-msg ' + (type || '');
}

function permPillsHtml(a) {
  if (a.role === 'super_admin') return '<span class="perm-pill">All (Super Admin)</span>';
  const perms = a.permissions || [];
  if (!perms.length) return '<span class="perm-pill perm-none">None</span>';
  return `<div class="perm-pill-row">${perms.map(p => {
    const mod = PERMISSION_MODULES.find(m => m.key === p);
    return `<span class="perm-pill">${esc(mod ? mod.label : p)}</span>`;
  }).join('')}</div>`;
}

async function loadAdmins() {
  const { data, error } = await supabaseClient.from('admins').select('*').order('created_at');
  const body = document.getElementById('admins-body');
  if (error) { body.innerHTML = `<tr><td colspan="7">Error: ${esc(error.message)}</td></tr>`; return; }

  body.innerHTML = data.length ? data.map(a => {
    const isSelf = a.user_id === currentUserId;
    return `
    <tr data-id="${a.id}" data-user-id="${a.user_id}" data-permissions='${JSON.stringify(a.permissions || [])}'>
      <td>${esc(a.full_name)}${isSelf ? ' <span class="badge badge-navy">You</span>' : ''}</td>
      <td>${esc(a.email)}</td>
      <td>${a.role === 'super_admin' ? 'Super Admin' : 'Admin'}</td>
      <td>${permPillsHtml(a)}</td>
      <td>${a.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Suspended</span>'}</td>
      <td>${new Date(a.created_at).toLocaleDateString()}</td>
      <td class="row-actions">
        ${a.role === 'super_admin' ? '<span style="color:var(--ink-400); font-size:0.82rem;">—</span>' : `
          <button class="btn btn-sm" data-action="edit-perms">Edit Access</button>
        `}
        ${isSelf ? '' : `
          <button class="btn btn-sm ${a.is_active ? '' : 'btn-save'}" data-action="toggle-admin">${a.is_active ? 'Suspend' : 'Reactivate'}</button>
          <button class="btn btn-sm btn-danger" data-action="remove-admin">Remove</button>
        `}
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" class="loading-row">No admins found.</td></tr>';
}

document.getElementById('admins-body').addEventListener('click', async (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  const tr = e.target.closest('tr');
  const id = tr.dataset.id;

  if (action === 'toggle-admin') {
    const suspending = e.target.textContent.trim() === 'Suspend';
    if (!confirm(suspending ? 'Suspend this admin? They will immediately lose access to everything.' : 'Reactivate this admin?')) return;
    const { error } = await supabaseClient.from('admins').update({ is_active: !suspending }).eq('id', id);
    if (error) { alert(error.message); return; }
    loadAdmins();
    return;
  }

  if (action === 'remove-admin') {
    if (!confirm('Remove this admin entirely? This permanently revokes their access (their login itself is not deleted, but they will never be able to access the dashboard again unless re-added).')) return;
    const { error } = await supabaseClient.from('admins').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    loadAdmins();
    return;
  }

  if (action === 'edit-perms') {
    const existing = tr.nextElementSibling;
    if (existing && existing.classList.contains('perm-edit-row')) { existing.remove(); return; }
    document.querySelectorAll('.perm-edit-row').forEach(r => r.remove());

    const checked = JSON.parse(tr.dataset.permissions || '[]');
    const editRow = document.createElement('tr');
    editRow.className = 'perm-edit-row';
    editRow.innerHTML = `<td colspan="7">
      <div class="perm-checklist">${permChecklistHtml('edit', checked)}</div>
      <button class="btn btn-sm btn-save" data-action="save-perms">Save Access</button>
    </td>`;
    tr.after(editRow);
    return;
  }

  if (action === 'save-perms') {
    const editRow = tr;
    const dataRow = editRow.previousElementSibling;
    const selected = Array.from(editRow.querySelectorAll('.edit-perm:checked')).map(cb => cb.value);
    const { error } = await supabaseClient.from('admins').update({ permissions: selected }).eq('id', dataRow.dataset.id);
    if (error) { alert(error.message); return; }
    loadAdmins();
  }
});

document.getElementById('admin-add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('admin-add-btn');
  btn.disabled = true;
  btn.textContent = 'Sending Invite…';
  showAdminAddMsg('', '');

  const full_name = document.getElementById('admin-name').value.trim();
  const email = document.getElementById('new-admin-email').value.trim();
  // Role is display-only here — "Super Admin" is a disabled option in the
  // dropdown, and the create-admin function ignores this field entirely
  // (it always creates regular admins server-side).
  const role = document.getElementById('admin-role').value;
  const permissions = Array.from(document.querySelectorAll('.add-perm:checked')).map(cb => cb.value);

  const { data, error } = await supabaseClient.functions.invoke('create-admin', {
    body: { full_name, email, role, permissions },
  });

  btn.disabled = false;
  btn.textContent = 'Send Invite';

  if (error) {
    // FunctionsHttpError carries the actual JSON error body on .context (a Response)
    let message = error.message;
    try {
      const body = await error.context.json();
      if (body?.error) message = body.error;
    } catch (_) { /* fall back to error.message */ }
    showAdminAddMsg(message, 'error');
    return;
  }

  if (data?.error) {
    showAdminAddMsg(data.error, 'error');
    return;
  }

  showAdminAddMsg('Invite sent — they\'ll get an email to set their password. Delivery can take a few minutes.', 'success');
  e.target.reset();
  document.getElementById('admin-role').value = 'admin';
  document.querySelectorAll('.add-perm').forEach(cb => cb.checked = false);
  loadAdmins();
});

checkSession();
