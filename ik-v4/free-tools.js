/* Tool inputs are kept in the DOM only: no requests, storage or analytics. */
(function () {
  'use strict';
  function calculateCartons(rows) {
    let cbm = 0, weight = 0;
    for (const row of rows) {
      const [l, w, h, qty, kg] = row.values;
      if (![l, w, h, qty, kg].every(Number.isFinite) || l <= 0 || w <= 0 || h <= 0 || qty < 1 || !Number.isInteger(qty) || kg < 0) throw Error('Check every row: dimensions must be positive, quantity a whole number of at least 1, and gross kg per carton zero or more.');
      const divisor = row.unit === 'mm' ? 1000 : 100;
      cbm += (l / divisor) * (w / divisor) * (h / divisor) * qty;
      weight += kg * qty;
    }
    const air = cbm * 1000000 / 6000;
    const sea = Math.max(cbm, weight / 1000);
    if (![cbm, weight, air, sea].every(Number.isFinite)) throw Error('These values are too large. Check the measurements and quantities.');
    return { cbm, weight, air, sea, airComparison: Math.max(air, weight) };
  }
  function csvCell(value) {
    const safe = /^[\s]*[=+\-@\t\r\n]/.test(value) ? "'" + value : value;
    return '"' + safe.replace(/"/g, '""') + '"';
  }
  // Export pure calculations for local verification without a browser.
  if (typeof module !== 'undefined') module.exports = { calculateCartons, csvCell };
  if (typeof document === 'undefined') return;
  const calcScript = document.getElementById('carton-rows');
  const schedule = document.getElementById('schedule-rows');
  let cartonId = 0, scheduleId = 0;
  const fmt = value => value.toLocaleString('en-GB', { maximumFractionDigits: 6 });
  function update() {
    const output = document.getElementById('carton-results');
    try {
      const cartons = [...document.querySelectorAll('.carton')].filter(row => [...row.querySelectorAll('input')].some(input => input.value.trim() !== '' || input.validity.badInput));
      if (!cartons.length) { output.textContent = 'Enter carton dimensions, quantity and gross weight to see totals.'; return; }
      const totals = calculateCartons(cartons.map(row => ({ unit: row.querySelector('select').value, values: [...row.querySelectorAll('input')].map(input => input.value.trim() === '' ? NaN : Number(input.value)) })));
      output.textContent = `Total volume: ${fmt(totals.cbm)} CBM. Total gross weight: ${fmt(totals.weight)} kg. Sea LCL comparison: ${fmt(totals.cbm)} CBM versus ${fmt(totals.weight / 1000)} tonnes; larger measure: ${fmt(totals.sea)} W/M units. Air volumetric weight (6,000 divisor): ${fmt(totals.air)} kg; larger of total gross and volumetric weight: ${fmt(totals.airComparison)} kg. Estimates only; confirm the service rules with your forwarder.`;
    } catch (error) { output.textContent = error.message; }
  }
  function addCarton(focus) {
    const id = ++cartonId;
    const group = document.createElement('fieldset'); group.className = 'carton';
    group.innerHTML = `<legend>Carton group ${id}</legend><div class="fields"><label>Dimensions unit<select aria-label="Carton group ${id}: dimensions unit"><option value="cm">cm</option><option value="mm">mm</option></select></label>${['Length','Width','Height','Quantity','Gross kg per carton'].map((name, i) => `<label>${name}<input aria-label="Carton group ${id}: ${name}" type="number" min="${i === 3 ? '1' : '0'}" step="${i === 3 ? '1' : 'any'}" required></label>`).join('')}</div><button type="button" aria-label="Remove carton group ${id}">Remove group</button>`;
    group.querySelector('button').addEventListener('click', () => { group.remove(); document.getElementById('add-carton').focus(); update(); });
    document.getElementById('carton-rows').append(group);
    if (focus) group.querySelector('input').focus();
  }
  if (calcScript) {
    document.getElementById('add-carton').addEventListener('click', () => addCarton(true));
    calcScript.addEventListener('input', update); calcScript.addEventListener('change', update); addCarton(false); update();
  }
  const headings = ['Room','Item','Qty','Size','Finish / colour','Spec notes','Fire label required Y/N','Sample approved Y/N'];
  function addSchedule(focus) {
    const id = ++scheduleId, row = document.createElement('tr');
    row.innerHTML = headings.map((name, i) => `<td>${i >= 6 ? `<select aria-label="Row ${id}: ${name}"><option value="">—</option><option value="Y">Y</option><option value="N">N</option></select>` : i === 5 ? `<textarea aria-label="Row ${id}: ${name}"></textarea>` : `<input aria-label="Row ${id}: ${name}" type="${i === 2 ? 'number' : 'text'}" ${i === 2 ? 'min="0" step="1"' : ''}>`}</td>`).join('') + `<td class="remove-cell"><button type="button" aria-label="Remove schedule row ${id}">Remove</button></td>`;
    row.querySelector('button').addEventListener('click', () => { row.remove(); document.getElementById('add-schedule').focus(); });
    schedule.append(row); if (focus) row.querySelector('input').focus();
  }
  if (schedule) {
    for (let i = 0; i < 4; i++) addSchedule(false);
    document.getElementById('add-schedule').addEventListener('click', () => addSchedule(true));
    document.getElementById('print-schedule').addEventListener('click', () => window.print());
    document.getElementById('download-csv').addEventListener('click', () => {
      const fields = [...schedule.querySelectorAll('input')];
      if (fields.some(field => !field.reportValidity())) return;
      const rows = [...schedule.rows].map(row => [...row.querySelectorAll('input,select,textarea')].map(input => input.value));
      const csv = '\uFEFF' + [headings, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'room-furniture-schedule.csv'; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      document.getElementById('schedule-status').textContent = 'CSV prepared. Check your browser downloads.';
    });
  }
}());
