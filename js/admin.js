let registrantsCache = [];
let tradingAccountsByRegistrant = {};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function showLoginMsg(text, type) {
  const el = document.getElementById('login-msg');
  el.textContent = text;
  el.className = 'form-msg ' + (type || '');
}

function showPanel(loggedIn, email) {
  document.getElementById('login-screen').style.display = loggedIn ? 'none' : 'block';
  document.getElementById('admin-panel').style.display = loggedIn ? 'block' : 'none';
  if (loggedIn) {
    document.getElementById('admin-email').textContent = email || '';
    loadAll();
  }
}

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();
  showPanel(!!data.session, data.session?.user?.email);
}

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
  showPanel(true, data.user?.email);
});

document.getElementById('logout-btn').addEventListener('click', async () => {
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
}

// ---------- Registrants ----------
async function loadRegistrants() {
  const [{ data, error }, { data: accounts, error: acctError }] = await Promise.all([
    supabaseClient.from('registrants').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('trading_accounts').select('registrant_id, account_number').order('created_at'),
  ]);
  const body = document.getElementById('registrants-body');
  if (error) { body.innerHTML = `<tr><td colspan="8">Error: ${esc(error.message)}</td></tr>`; return; }

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
      <td>${esc(r.referral_code)}</td>
      <td>${esc(r.referred_by_code || '—')}</td>
      <td>${new Date(r.created_at).toLocaleDateString()}</td>
      <td><button class="btn btn-sm btn-danger" data-action="del-registrant">Delete</button></td>
    </tr>
  `).join('') : '<tr><td colspan="8" class="loading-row">No registrants yet.</td></tr>';
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

async function loadPrizes() {
  const { data, error } = await supabaseClient.from('prizes').select('*').order('category').order('sort_order');
  const roiBody = document.getElementById('prizes-roi-body');
  const raffleBody = document.getElementById('prizes-raffle-body');
  if (error) { roiBody.innerHTML = `<tr><td colspan="7">Error: ${esc(error.message)}</td></tr>`; return; }

  const roi = data.filter(p => p.category === 'roi');
  const raffle = data.filter(p => p.category === 'raffle');
  roiBody.innerHTML = roi.length ? roi.map(prizeRowHtml).join('') : '<tr><td colspan="7" class="loading-row">No ROI prizes yet.</td></tr>';
  raffleBody.innerHTML = raffle.length ? raffle.map(prizeRowHtml).join('') : '<tr><td colspan="7" class="loading-row">No raffle prizes yet.</td></tr>';
}

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

checkSession();
