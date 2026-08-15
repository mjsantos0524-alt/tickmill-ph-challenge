function showStatusMsg(text, type) {
  const el = document.getElementById('status-msg');
  el.textContent = text;
  el.className = 'form-msg ' + (type || '');
}

document.getElementById('status-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('status-submit-btn');
  const email = document.getElementById('status-email').value.trim();
  btn.disabled = true;
  btn.textContent = 'Checking…';
  document.getElementById('status-result').style.display = 'none';
  showStatusMsg('', '');

  const { data, error } = await supabaseClient.rpc('get_registrant_status', { p_email: email });

  btn.disabled = false;
  btn.textContent = 'Check Status →';

  if (error) {
    showStatusMsg('Something went wrong: ' + error.message, 'error');
    return;
  }

  const row = data && data[0];
  if (!row || !row.full_name) {
    showStatusMsg('No registration found for that email. Check the spelling, or register at the Register page.', 'error');
    return;
  }

  document.getElementById('s-name').textContent = row.full_name;
  document.getElementById('s-account-type').textContent = row.account_type === 'raw' ? 'RAW' : 'Classic';
  document.getElementById('s-account-number').textContent = row.trading_account_number;
  document.getElementById('s-referral-code').textContent = row.referral_code;

  document.getElementById('s-lots').textContent = row.has_leaderboard_entry ? Number(row.lots_traded).toFixed(1) : '0';
  document.getElementById('s-weeks').textContent = row.has_leaderboard_entry ? row.weeks_active : '0';
  document.getElementById('s-entries').textContent = row.raffle_entry_count;

  const lbText = document.getElementById('s-leaderboard-text');
  if (!row.has_leaderboard_entry) {
    lbText.innerHTML = 'Your trading activity hasn\'t been recorded by campaign admins yet. Once your deposit and trades are verified, your ROI and ranking will show up here.';
  } else if (row.is_qualified) {
    lbText.innerHTML = `✅ <strong>Qualified.</strong> ROI: ${row.roi_pct}% · Drawdown: ${row.max_drawdown_pct}% · Risk-Adjusted Score: <strong>${row.risk_adjusted_score}</strong>` +
      (row.roi_rank ? ` · Current rank: <strong>#${row.roi_rank}</strong>` : ' · Outside the current Top 5');
  } else {
    const reasons = [];
    if (Number(row.lots_traded) < 5) reasons.push('under 5 lots traded');
    if (row.weeks_active < 3) reasons.push('not yet spread across 3+ weeks');
    lbText.innerHTML = `⏳ <strong>Not yet qualified</strong> — ${reasons.join(', ') || 'requirements not yet met'}. ROI so far: ${row.roi_pct}%.`;
  }

  document.getElementById('status-result').style.display = 'block';
});
