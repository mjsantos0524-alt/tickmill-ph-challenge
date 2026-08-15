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

loadRaffleStats();
