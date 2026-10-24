// Capture the request before sending the one-off catalogue email.
(() => {
  document.querySelectorAll('form[name="trade-catalogue"]').forEach(form => {
    const status = form.querySelector('.catalogue-status');
    const button = form.querySelector('button[type="submit"]');
    let busy = false;
    let captured = '';
    let requestId = '';
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || !form.reportValidity()) return;
      if (form.elements['bot-field'].value) return;
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      status.hidden = true;
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status.textContent = 'Please enter your name and a valid email address.';
        status.dataset.error = 'true';
        status.hidden = false;
        return;
      }
      busy = true;
      button.disabled = true;
      button.textContent = 'Sending your catalogue...';
      const data = new FormData(form);
      data.set('name', name);
      data.set('email', email);
      const encoded = new URLSearchParams(data).toString();
      try {
        if (captured !== encoded) {
          const capture = await fetch('/', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: encoded, signal: AbortSignal.timeout(20000)
          });
          if (!capture.ok) throw new Error('capture');
          captured = encoded;
          requestId = crypto.randomUUID();
        }
        const delivery = await fetch('/.netlify/functions/send-catalogue', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, requestId, 'bot-field': data.get('bot-field') }),
          signal: AbortSignal.timeout(20000)
        });
        if (!delivery.ok || !(await delivery.json()).sent) throw new Error('delivery');
        status.textContent = 'Check your inbox - the catalogue is on its way.';
        status.dataset.error = 'false';
        status.hidden = false;
        button.textContent = 'Catalogue requested';
      } catch {
        status.textContent = captured === encoded
          ? 'Your request was saved, but we could not confirm the email was sent. Please try again or email sai@ikeng.co.uk.'
          : 'We could not save your request. Please try again or email sai@ikeng.co.uk.';
        status.dataset.error = 'true';
        status.hidden = false;
        button.disabled = false;
        button.textContent = 'Email me the free catalogue';
        busy = false;
      }
    });
  });
})();
