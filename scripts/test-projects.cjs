// Offline renderer checks: run with node scripts/test-projects.cjs.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const site = path.join(__dirname, '../ik-v4');
const html = fs.readFileSync(path.join(site, 'projects.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const projects = JSON.parse(fs.readFileSync(path.join(site, 'data/projects.json')));
const photos = JSON.parse(fs.readFileSync(path.join(site, 'data/process-photos.json')));
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.textContent = ''; this.hidden = true; }
  append(...items) { this.children.push(...items); items.forEach(i => i.parentElement = this); }
  replaceChildren(...items) { this.children = []; this.append(...items); }
  addEventListener(name, fn) { this[name] = fn; }
  focus() { this.focused = true; }
}
async function render(entries, images, fail = false) {
  const ids = Object.fromEntries(['projects', 'projects-status', 'delivered-photos', 'process-photos', 'process-section'].map(id => [id, new Element('div')]));
  const button = new Element('button'), video = new Element('div'); video.append(button);
  const document = { createElement: tag => new Element(tag), getElementById: id => ids[id], querySelectorAll: () => [button] };
  vm.runInNewContext(script, { document, fetch: async url => { if(fail) throw new Error('offline'); return {ok:true,json:async () => url.includes('projects.json') ? entries : images}; } });
  await new Promise(resolve => setImmediate(resolve));
  return {ids, button, video};
}
(async () => {
  assert.equal(projects.length, 10);
  assert.equal(new Set(projects.map(p => p.id)).size, 10);
  const stages = ['Brief and specification','Factory comparison','Samples and drawings','In production','Shipping','Delivered'];
  projects.forEach(p => { assert.equal(p.consent, true); assert.ok(stages.includes(p.stage)); assert.match(p.updated,/^\d{4}-\d{2}$/); assert.ok(Array.isArray(p.scope)); assert.ok(Array.isArray(p.photos)); });
  photos.forEach(p => { assert.ok(fs.existsSync(path.join(site,p.file))); assert.ok(p.caption); assert.ok(p.date === '' || /^\d{4}-\d{2}$/.test(p.date)); });
  let r = await render(projects, photos);
  assert.equal(r.ids.projects.children.length,10);
  assert.equal(r.ids['delivered-photos'].children.length,4);
  assert.equal(r.ids['process-section'].hidden,false);
  assert.equal(r.video.children[0].tagName,'button');
  r.button.click();
  assert.match(r.video.children[0].src,/^https:\/\/www.youtube-nocookie.com\/embed\/5RZrTLAk7eU/);
  assert.equal(r.video.children[0].focused,true);
  r = await render(projects.map(p => ({...p,consent:false})),[]);
  assert.equal(r.ids.projects.children.length,0);
  assert.equal(r.ids['projects-status'].textContent,'Current client projects will appear here as clients approve them.');
  assert.equal(r.ids['process-section'].hidden,true);
  r = await render([],[],true);
  assert.match(r.ids['projects-status'].textContent,/could not be loaded/);
  r = await render([{...projects[0],title:'<img onerror=alert(1)>',photos:[{file:'https://external.invalid/a.jpg',caption:'No'}]}],[{file:'javascript:alert(1)',caption:'No',stage:'Factory visits'}]);
  assert.equal(r.ids.projects.children[0].children[1].textContent,'<img onerror=alert(1)>');
  assert.equal(r.ids['process-section'].hidden,true);
  assert.ok(!/<iframe|<script[^>]+src=|Review|AggregateRating/.test(html));
  console.log(`PASS: 10 consented briefs, ${photos.length} image paths, four delivered sets, consent filtering, empty galleries, fetch failure, safe text/image rendering and click-only video focus.`);
})().catch(e => { console.error(e); process.exitCode=1; });
