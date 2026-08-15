function fmtUsd(n) {
  return 'USD ' + Number(n).toLocaleString();
}

function prizeLine(p) {
  const amount = p.winner_count > 1
    ? `${fmtUsd(p.amount_usd)} each`
    : fmtUsd(p.amount_usd);
  return `${p.emoji} ${p.label} — ${p.description} (${amount})`;
}

async function loadHeroPrizes() {
  const { data, error } = await supabaseClient.from('prizes').select('*').order('category').order('sort_order');
  if (error) return;

  const roi = data.filter(p => p.category === 'roi');
  const raffle = data.filter(p => p.category === 'raffle');

  const heroRoi = document.getElementById('hero-roi-list');
  const heroRaffle = document.getElementById('hero-raffle-list');
  if (heroRoi) heroRoi.innerHTML = roi.map(p => `<li>${prizeLine(p)}</li>`).join('');
  if (heroRaffle) heroRaffle.innerHTML = raffle.map(p => `<li>${prizeLine(p)}</li>`).join('');

  const budgetRoiBody = document.getElementById('budget-roi-body');
  const budgetRaffleBody = document.getElementById('budget-raffle-body');
  if (budgetRoiBody) {
    budgetRoiBody.innerHTML = roi.map(p => `<tr><td>${p.emoji} ${p.label}${p.winner_count > 1 ? ' ×' + p.winner_count : ''}</td><td>${fmtUsd(p.amount_usd * p.winner_count)}</td></tr>`).join('');
  }
  if (budgetRaffleBody) {
    budgetRaffleBody.innerHTML = raffle.map(p => `<tr><td>${p.emoji} ${p.label}${p.winner_count > 1 ? ' ×' + p.winner_count : ''}</td><td>${fmtUsd(p.amount_usd * p.winner_count)}</td></tr>`).join('');
  }

  const total = data.reduce((sum, p) => sum + p.amount_usd * p.winner_count, 0);
  const totalEl = document.getElementById('total-prize-pool');
  if (totalEl) totalEl.textContent = fmtUsd(total);
}

loadHeroPrizes();
