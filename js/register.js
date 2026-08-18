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

  const { error } = await supabaseClient.rpc('register_participant', {
    p_full_name: full_name,
    p_email: email,
    p_account_type: account_type,
    p_trading_account_numbers: trading_account_numbers,
  });

  if (!error) {
    document.getElementById('reg-form').style.display = 'none';
    document.getElementById('success-panel').style.display = 'block';
    showMsg('', '');
    document.getElementById('form-msg').className = 'form-msg';
    return;
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Register →';

  if (error.code === '23505') {
    showMsg('That email is already registered.', 'error');
  } else {
    showMsg('Something went wrong: ' + error.message, 'error');
  }
});
