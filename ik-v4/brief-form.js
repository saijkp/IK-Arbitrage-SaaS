// Enquiry capture only. No automatic campaign emails or quote promises.
(() => {
  document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
  document.querySelectorAll('.chk input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => cb.closest('.chk').classList.toggle('selected', cb.checked)));
  const form = document.getElementById('briefForm');
  if (!form) return;
  const error = document.createElement('p');
  error.id = 'briefError';
  error.setAttribute('role', 'alert');
  error.style.color = '#a32727';
  error.hidden = true;
  form.append(error);
  let submitting = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (submitting) return;
    error.hidden = true;
    if (!form.reportValidity()) return;
    if (!form.querySelector('input[name=role]:checked')) {
      error.textContent = 'Please select your role.';
      error.hidden = false;
      return;
    }
    const button = form.querySelector('button[type=submit]');
    submitting = true;
    button.disabled = true;
    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error('Submission not accepted');
      document.getElementById('briefSuccess').classList.add('show');
      button.textContent = 'Brief received';
      if (window._ikGtmLoaded && Array.isArray(window.dataLayer)) window.dataLayer.push({ event: 'generate_lead', form_name: 'sourcing_brief' });
    } catch {
      error.textContent = 'We could not confirm receipt of your brief. Your details remain here. Please try again or email sai@ikeng.co.uk. If you are unsure whether it arrived, ask us to check before resending.';
      error.hidden = false;
      button.disabled = false;
      submitting = false;
    }
  });
})();
