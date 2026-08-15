function escAnn(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

const SEVERITY_ICON = { update: '📢', important: '❗', warning: '⚠️', promo: '🎉' };

async function loadAnnouncements() {
  const mount = document.getElementById('announcement-banner');
  if (!mount) return;

  const { data, error } = await supabaseClient
    .from('announcements')
    .select('id, title, body, severity')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error || !data || !data.length) return;

  mount.innerHTML = data.map(a => `
    <div class="announcement announcement-${a.severity}">
      <span class="announcement-icon">${SEVERITY_ICON[a.severity] || '📢'}</span>
      <div>
        <strong>${escAnn(a.title)}</strong>
        ${a.body ? `<span class="announcement-body">${escAnn(a.body)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

loadAnnouncements();
