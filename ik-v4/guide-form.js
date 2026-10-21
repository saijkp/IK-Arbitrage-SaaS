// Free buyer's guide: modal, Netlify form capture and the guide email.
function openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; }
(() => {
  const modal = document.getElementById('guideModal');
  const form = document.getElementById('guideForm');
  if (!modal || !form) return;
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('guideModal'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal('guideModal'); });
  const error = document.createElement('p');
  error.setAttribute('role', 'alert');
  error.style.cssText = 'color:#a32727;font-size:.78rem;margin-top:8px;';
  error.hidden = true;
  form.append(error);
  let submitting = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (submitting) return;
    const name = document.getElementById('g-name').value.trim();
    const email = document.getElementById('g-email').value.trim();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error.textContent = 'Please enter your name and a valid email address.';
      error.hidden = false;
      return;
    }
    error.hidden = true;
    submitting = true;
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error('Submission not accepted');
    } catch {
      error.textContent = 'Sorry, we could not send that. Please try again or email sai@ikeng.co.uk for the guide.';
      error.hidden = false;
      button.disabled = false;
      submitting = false;
      return;
    }
    // The sign-up is already recorded above, so a failed email send is not shown as an error.
    try {
      await fetch('/.netlify/functions/send-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
    } catch (err) { console.error('Guide email send failed', err); }
    if (window._ikGtmLoaded && Array.isArray(window.dataLayer)) window.dataLayer.push({ event: 'generate_lead', form_name: 'guide_download' });
    document.getElementById('guide-success').classList.add('show');
    form.style.display = 'none';
  });
})();
