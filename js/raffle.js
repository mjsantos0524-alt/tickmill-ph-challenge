async function loadRafflePrizes() {
  const { data, error } = await supabaseClient.from('prizes').select('*').eq('category', 'raffle').order('sort_order');
  const wrap = document.getElementById('raffle-prize-cards');
  if (error || !data || !data.length) { wrap.innerHTML = '<div class="card"><p>Prizes unavailable.</p></div>'; return; }

  wrap.innerHTML = data.map((p, i) => `
    <div class="card">
      <span class="badge ${i === 0 ? 'badge-gold' : 'badge-green'}">${p.label}</span>
      <h3>${p.emoji} ${p.description}</h3>
      <p>${p.winner_count > 1 ? `USD ${Number(p.amount_usd).toLocaleString()} each · ${p.winner_count} winners` : `Value: USD ${Number(p.amount_usd).toLocaleString()} · 1 winner`}</p>
    </div>
  `).join('');
}

async function loadRaffleStats() {
  const { data, error } = await supabaseClient
    .from('raffle_entries')
    .select('entry_count, source');

  const tiles = document.querySelectorAll('#stats-tiles .num');

  if (error) {
    tiles.forEach(t => t.textContent = '—');
    return;
  }

  const total = data.reduce((sum, r) => sum + r.entry_count, 0);
  const qualification = data.filter(r => r.source === 'qualification').reduce((s, r) => s + r.entry_count, 0);
  const referral = data.filter(r => r.source === 'referral').reduce((s, r) => s + r.entry_count, 0);

  tiles[0].textContent = total;
  tiles[1].textContent = qualification;
  tiles[2].textContent = referral;
}

loadRafflePrizes();
loadRaffleStats();
