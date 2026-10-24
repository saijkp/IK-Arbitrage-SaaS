// Only known collection references can pre-fill a brief.
(() => {
  const items = {
  "IKE-K01": {
    "name": "Grey island kitchen",
    "category": "Kitchen cabinets"
  },
  "IKE-K04": {
    "name": "White linear kitchen",
    "category": "Kitchen cabinets"
  },
  "IKE-K05": {
    "name": "Warm timber kitchen",
    "category": "Kitchen cabinets"
  },
  "IKE-K06": {
    "name": "Taupe peninsula kitchen",
    "category": "Kitchen cabinets"
  },
  "IKE-W02": {
    "name": "Open timber dressing wall",
    "category": "Wardrobes & storage"
  },
  "IKE-W03": {
    "name": "Warm timber dressing room",
    "category": "Wardrobes & storage"
  },
  "IKE-W04": {
    "name": "Wardrobe with drawers",
    "category": "Wardrobes & storage"
  },
  "IKE-W06": {
    "name": "Light wardrobe interior",
    "category": "Wardrobes & storage"
  },
  "IKE-F03": {
    "name": "Upholstered dining chair",
    "category": "Dining furniture"
  },
  "IKE-F04": {
    "name": "Cream tub chair",
    "category": "Sofas & living room"
  },
  "IKE-F05": {
    "name": "Round pale coffee table",
    "category": "Sofas & living room"
  },
  "IKE-F06": {
    "name": "Oval pale coffee table",
    "category": "Sofas & living room"
  },
  "IKE-F07": {
    "name": "Dark console table",
    "category": "Sofas & living room"
  },
  "IKE-F08": {
    "name": "Drawer console table",
    "category": "Sofas & living room"
  },
  "IKE-F09": {
    "name": "Round bedside cabinet",
    "category": "Beds & bedroom"
  }
};
  const code = new URLSearchParams(window.location.search).get('item');
  if (!code || !/^IKE-[A-Z]\d{2}$/.test(code) || !Object.prototype.hasOwnProperty.call(items, code)) return;
  const description = document.getElementById('brief-description');
  const brief = document.getElementById('brief');
  if (!description || !brief) return;
  const item = items[code];
  if (description.value === '') {
    description.value = "I'm interested in " + code + ' (' + item.name + ') from your collection. \n';
    description.dispatchEvent(new Event('input', { bubbles: true }));
  }
  brief.querySelectorAll('input[name="cat"]').forEach(input => {
    if (input.value === item.category) { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  brief.scrollIntoView({ behavior: 'auto', block: 'start' });
})();
// ?design=1 pre-ticks the optional design & specification checkbox on the brief form.
(() => {
  if (new URLSearchParams(window.location.search).get('design') !== '1') return;
  const box = document.getElementById('brief-design_support');
  if (!box) return;
  box.checked = true;
  box.dispatchEvent(new Event('change', { bubbles: true }));
})();
