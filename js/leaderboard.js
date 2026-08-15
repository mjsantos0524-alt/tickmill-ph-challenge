const PRIZES = [
  { label: '🥇 Champion', amount: 'USD 1,200 · Travel Package' },
  { label: '🥈 2nd Place', amount: 'USD 1,000 · Laptop' },
  { label: '🥉 3rd Place', amount: 'USD 300 Cash' },
  { label: '4th Place', amount: 'USD 200 Cash' },
  { label: '5th Place', amount: 'USD 200 Cash' },
];

async function loadLeaderboard() {
  const { data, error } = await supabaseClient
    .from('leaderboard_entries')
    .select('trader_alias, account_type, roi_pct, risk_adjusted_score, max_drawdown_pct, weeks_active, lots_traded, is_qualified')
    .order('risk_adjusted_score', { ascending: false });

  if (error) {
    document.getElementById('lb-list').innerHTML = `<div class="loading-row">Couldn't load leaderboard: ${error.message}</div>`;
    return;
  }

  const qualified = data.filter(d => d.is_qualified).slice(0, 5);
  const unqualified = data.filter(d => !d.is_qualified);

  const lbList = document.getElementById('lb-list');
  if (!qualified.length) {
    lbList.innerHTML = '<div class="loading-row">No qualified entries yet.</div>';
  } else {
    lbList.innerHTML = qualified.map((row, i) => `
      <div class="lb-row ${i === 0 ? 'top1' : ''}">
        <div class="lb-rank">${i + 1}</div>
        <div>
          <div class="lb-name">${row.trader_alias} <span class="badge badge-navy">${row.account_type}</span></div>
          <div class="lb-meta">ROI ${row.roi_pct}% · Drawdown ${row.max_drawdown_pct}% · ${row.weeks_active} weeks active</div>
        </div>
        <div class="lb-score">
          <div class="val">${row.risk_adjusted_score}</div>
          <div class="lab">Risk-Adj Score</div>
          <div class="lab" style="margin-top:2px;">${PRIZES[i] ? PRIZES[i].amount : ''}</div>
        </div>
      </div>
    `).join('');
  }

  const body = document.getElementById('unqualified-body');
  if (!unqualified.length) {
    body.innerHTML = '<tr><td colspan="4" class="loading-row">Everyone with recorded activity is currently ranked.</td></tr>';
  } else {
    body.innerHTML = unqualified.map(row => {
      const reasons = [];
      if (row.lots_traded < 5) reasons.push('under 5 lots');
      if (row.weeks_active < 3) reasons.push('not spread across 3+ weeks');
      return `<tr>
        <td>${row.trader_alias}</td>
        <td>${row.roi_pct}%</td>
        <td>${row.weeks_active}</td>
        <td><span class="badge badge-red">${reasons.join(', ') || 'not eligible'}</span></td>
      </tr>`;
    }).join('');
  }
}

loadLeaderboard();
