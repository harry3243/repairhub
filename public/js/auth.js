let signup = false;
const $ = (id) => document.getElementById(id);
$('swap').onclick = (e) => {
  e.preventDefault(); signup = !signup;
  $('title').textContent = $('go').textContent = signup ? 'Create account' : 'Log in';
  $('nameRow').hidden = $('roleRow').hidden = !signup;
  $('swap').textContent = signup ? 'Already have an account? Log in' : 'New here? Create an account';
};
$('go').onclick = async () => {
  try {
    const body = { email: $('email').value, password: $('password').value };
    if (signup) { body.name = $('name').value; body.role = $('role').value; }
    const d = await api(signup ? '/auth/register' : '/auth/login', { method: 'POST', body });
    Auth.save(d);
    location.href = d.user.role === 'owner' ? 'dashboard.html' : 'index.html';
  } catch (e) { toast(e.message, true); }
};
document.addEventListener('keydown', e => { if (e.key === 'Enter') $('go').click(); });
