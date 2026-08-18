function makeReferralCode(fullName) {
  const base = (fullName.split(' ')[0] || 'TRADER').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'TRADER';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return base + suffix;
}

function showMsg(text, type) {
  const el = document.getElementById('form-msg');
  el.textContent = text;
  el.className = 'form-msg ' + type;
}

document.getElementById('add-account-btn').addEventListener('click', () => {
  const wrap = document.getElementById('extra-accounts');
  const row = document.createElement('div');
  row.className = 'extra-account-row';
  row.innerHTML = `
    <input type="text" class="extra-account-input" placeholder="e.g. 87654321">
    <button type="button" class="remove-account" title="Remove">×</button>
  `;
  row.querySelector('.remove-account').addEventListener('click', () => row.remove());
  wrap.appendChild(row);
});

function collectAccountNumbers() {
  const primary = document.getElementById('trading_account_number').value.trim();
  const extras = Array.from(document.querySelectorAll('.extra-account-input'))
    .map(i => i.value.trim())
    .filter(v => v.length > 0);
  return [primary, ...extras];
}

document.getElementById('reg-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Registering…';

  const full_name = document.getElementById('full_name').value.trim();
  const email = document.getElementById('email').value.trim();
  const account_type = document.getElementById('account_type').value;
  const trading_account_numbers = collectAccountNumbers();
  const referred_by_raw = document.getElementById('referral_code').value.trim().toUpperCase();
  const referred_by_code = referred_by_raw.length ? referred_by_raw : null;

  let attempt = 0;
  let lastError = null;

  while (attempt < 3) {
    const referral_code = makeReferralCode(full_name);
    const { error } = await supabaseClient.rpc('register_participant', {
      p_full_name: full_name,
      p_email: email,
      p_account_type: account_type,
      p_trading_account_numbers: trading_account_numbers,
      p_referral_code: referral_code,
      p_referred_by_code: referred_by_code,
    });

    if (!error) {
      document.getElementById('reg-form').style.display = 'none';
      document.getElementById('my-code').textContent = referral_code;
      document.getElementById('success-panel').style.display = 'block';
      showMsg('', '');
      document.getElementById('form-msg').className = 'form-msg';
      return;
    }

    lastError = error;
    // referral_code collision (rare) -> retry with a new random code
    if (error.code === '23505' && error.message.includes('referral_code')) {
      attempt++;
      continue;
    }
    break;
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Register →';

  if (lastError && lastError.code === '23505') {
    showMsg('That email is already registered.', 'error');
  } else if (lastError && lastError.code === '23503') {
    showMsg('That referral code was not found. Double-check it or leave it blank.', 'error');
  } else {
    showMsg('Something went wrong: ' + (lastError ? lastError.message : 'unknown error'), 'error');
  }
});
