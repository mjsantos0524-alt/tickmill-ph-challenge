function fmtMoney(n, currency) {
  const symbol = currency === 'PHP' ? '₱' : '$';
  return symbol + Number(n).toLocaleString();
}

function prizeLine(p) {
  const amount = p.winner_count > 1
    ? `${fmtMoney(p.amount_usd, p.currency)} each`
    : fmtMoney(p.amount_usd, p.currency);
  return `${p.emoji} ${p.label} — ${p.description} (${amount})`;
}

async function loadHeroPrizes() {
  const { data, error } = await supabaseClient.from('prizes').select('*').order('category').order('sort_order');
  if (error) return;

  const roi = data.filter(p => p.category === 'roi');
  const raffle = data.filter(p => p.category === 'raffle');
  const quarterly = data.filter(p => p.category === 'quarterly');

  const heroRoi = document.getElementById('hero-roi-list');
  const heroRaffle = document.getElementById('hero-raffle-list');
  if (heroRoi) heroRoi.innerHTML = roi.map(p => `<li>${prizeLine(p)}</li>`).join('');
  if (heroRaffle) heroRaffle.innerHTML = raffle.map(p => `<li>${prizeLine(p)}</li>`).join('');

  const budgetRow = p => `<tr><td>${p.emoji} ${p.label}${p.winner_count > 1 ? ' ×' + p.winner_count : ''}</td><td>${fmtMoney(p.amount_usd * p.winner_count, p.currency)}</td></tr>`;

  const budgetRoiBody = document.getElementById('budget-roi-body');
  const budgetRaffleBody = document.getElementById('budget-raffle-body');
  const budgetQuarterlyBody = document.getElementById('budget-quarterly-body');
  if (budgetRoiBody) budgetRoiBody.innerHTML = roi.map(budgetRow).join('');
  if (budgetRaffleBody) budgetRaffleBody.innerHTML = raffle.map(budgetRow).join('');
  if (budgetQuarterlyBody) budgetQuarterlyBody.innerHTML = quarterly.map(budgetRow).join('') || '<tr><td colspan="2" class="loading-row">No prizes yet.</td></tr>';
}

loadHeroPrizes();
