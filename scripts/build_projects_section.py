"""Local, offline preparation of the supplied project evidence (Pillow required)."""
from pathlib import Path
import json
import re
from PIL import Image, ImageOps, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'ik-v4'
SOURCE = Path(r'C:\Users\HP\Downloads\Zoe all photos')

def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text.replace('\r\n', '\n').replace('\n', '\r\n').encode('utf-8'))

def data(path, value):
    write(path, json.dumps(value, ensure_ascii=False, indent=2) + '\n')

rows = [
    (41, 'Furniture for a 56-room HMO', 'Bristol', 'Residential', ['Made-to-size bed, wardrobe, chest, bedside, desk and chair per room']),
    (39, 'Six-bedroom house', 'Surrey', 'Residential', ['Aluminium glazing, two kitchens, flooring, lighting and bathrooms']),
    (54, 'Whole-house cabinetry', 'Southampton area', 'Residential', ['Two kitchens, dressing rooms and wardrobes, including loft eaves']),
    (52, 'Full-house package', '', 'Residential', ['Windows, doors and bathrooms first; kitchen later']),
    (3, 'Fitted furniture and joinery', '', 'Joinery', ['Fitted furniture and joinery package']),
    (30, 'New-build kitchen and bathrooms', '', 'Residential', ['Kitchen and bathrooms']),
    (51, 'PVC wall panels', 'Lincolnshire', 'Shipping', ['Door-to-door shipment from China']),
    (48, 'Brewery and distillery machinery', 'London', 'Shipping', ['20ft container from China']),
    (46, 'Gym equipment', 'Greater Manchester', 'Shipping', ['20ft container from China']),
    (47, 'Toys shipment', 'London', 'Shipping', ['Part-container from Shenzhen with customs clearance']),
]
projects = [dict(id=str(i), title=t, location=l, sector=s, scope=sc,
    approach='Next: confirm the shipping specification.' if s == 'Shipping' else 'Next: confirm the product specification.',
    stage='Brief and specification', stage_confirmed=False, updated='2026-11', consent=True, photos=[]) for i,t,l,s,sc in rows]
data(SITE / 'data/projects.json', projects)

# Numbers refer to the supplied contact sheets, sorted by original filename.
# Deliberately omit ambiguous/distorted or identifying views rather than publish them.
excluded = {3,7,8,14,15,16,18,19,20,24,25,26,29,30,31,32,36,41,44,45,46,50}
captions = {
1:'Factory production floor',2:'Production machinery and material rolls',4:'Machinery on the factory floor',5:'Factory production aisle',6:'Material rolls staged in the factory',9:'Profile sample checked by hand',
10:'Chandelier and decorative ceiling',11:'Lighting and ceiling details',12:'Chandelier detail',13:'Stairwell lighting and decorative ceiling',17:'Kitchen cabinetry on site',21:'Decorative interior screen',22:'Residence exterior',23:'Decorative exterior railing',
27:'Crated goods inside a container',28:'Packed cartons inside a container',33:'Chandelier components before shipment',34:'Chandelier finish detail',35:'Chandelier assembly before shipment',37:'Doors in a factory showroom',38:'Decorative door in a factory showroom',39:'Screen doors in a factory showroom',40:'Door in a factory showroom',42:'Mirror before shipment',43:'Rug detail before shipment',47:'Vanity cabinet before basin fitting',48:'Vanity cabinet with basin fitted',49:'Basin and worktop detail',51:'Basin checked with a tape measure',52:'Dining table before shipment',53:'Marble dining tabletop',54:'Tabletop finish detail',55:'Desk, chair and wall lights',56:'Seating and side table',57:'Beds and upholstered headboards',58:'Upholstered seating',59:'Guest room seating and tables',60:'Furnished bedroom and seating',61:'Bedroom set in a factory showroom',62:'Before: carved entrance gate at the factory',63:'After: carved entrance gate installed'}
groups = {**{i:'vatakara' for i in range(10,14)}, **{i:'residence' for i in [17,21,22,23]}, **{i:'guest-rooms' for i in range(55,61)},62:'gate',63:'gate'}
photos=[]
for number, source in enumerate(sorted(SOURCE.glob('Image_20261121*.jpg')), 1):
    if number in excluded:
        continue
    im=ImageOps.exif_transpose(Image.open(source)).convert('RGB')
    w,h=im.size
    if number in range(10,14):
        im=im.crop((0,0,w,int(h*.90))) # remove date/location overlay
    if number == 22:
        # Vehicle, including its plate, at the bottom right.
        box=(int(w*.76),int(h*.61),w,int(h*.91))
        im.paste(im.crop(box).filter(ImageFilter.GaussianBlur(55)),box)
    if number == 27:
        box=(int(w*.27),int(h*.28),int(w*.45),int(h*.53))
        im.paste(im.crop(box).filter(ImageFilter.GaussianBlur(50)),box)
        for coords in [(.47,.35,.55,.42),(.39,.49,.45,.56),(.88,.58,1,.84)]:
            box=tuple(int(v*(w if j%2==0 else h)) for j,v in enumerate(coords))
            im.paste(im.crop(box).filter(ImageFilter.GaussianBlur(45)),box)
    if number in [33,35]:
        box=(int(w*.92),int(h*.20),w,int(h*.44))
        im.paste(im.crop(box).filter(ImageFilter.GaussianBlur(45)),box)
    if number == 63:
        # Keep the installed gate; remove people at the right edge.
        im=im.crop((0,0,int(w*.74),h))
    im.thumbnail((1200,1200), Image.Resampling.LANCZOS)
    target=SITE / f'images/process/photo-{number:02}.jpg'
    target.parent.mkdir(parents=True,exist_ok=True)
    im.save(target,quality=82,optimize=True) # new file: no EXIF, GPS or source metadata
    stage=('Delivered' if number in groups else 'Factory showroom' if number in [37,38,39,40,61] else 'Material and sample checks' if number==9 else 'Container loading' if number in [27,28] else 'Factory visits' if number<=6 else 'Pre-shipment inspection')
    photos.append(dict(file=f'/images/process/photo-{number:02}.jpg',caption=captions[number],stage=stage,date='2025-08' if number in range(10,14) else '',project_ref=groups.get(number,''),needs_sai_caption=False,source_number=number))
data(SITE / 'data/process-photos.json',photos)
write(SITE / 'images/process/README.txt', '''Real project and process photographs only.
Name files photo-NN.jpg using the supplied contact-sheet number; use descriptive unique names for new uploads.
Before upload, blur factory staff faces, client names, company signage/logos, carton labels, container numbers and vehicle plates. Check reflections too.
Resize to at most 1200 px and strip EXIF/GPS metadata with Pillow. Never alter the source files.
Add file, caption, stage, date (YYYY-MM or empty when unknown), and optional project_ref to data/process-photos.json.
Delivered photo sets use stage Delivered and project_ref vatakara, residence, guest-rooms or gate.
Do not infer dates, locations or project identity. Captions describe visible content.
See scripts/build_projects_section.py for preparation of the initial supplied photographs.
''')

reference=(SITE / 'case-study-manchester-hmo.html').read_text(encoding='utf-8')
css=re.search(r'<style>(.*?)</style>',reference,re.S).group(1)
footer=re.search(r'<footer>.*?</footer>',reference,re.S).group(0)
html='''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Projects | IK ENG</title>
<meta name="description" content="Delivered sourcing projects, current client briefs and photographs of factory visits, sample checks, inspection and container loading.">
<link rel="canonical" href="https://ikeng.co.uk/projects.html"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>'''+css+'''
.wrap{max-width:1100px}nav{display:flex;flex-wrap:wrap;gap:16px}section{margin-top:48px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:24px}.card{border:1px solid var(--border);border-radius:8px;padding:24px;min-width:0}.card h3{margin:12px 0;font-size:1.15rem}.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-weight:600;font-size:.85rem}.delivered{background:#e2f4e8;color:#185b31}.progress{background:#fff0c2;color:#704b00}.process{background:var(--accent-tint);color:var(--accent)}.meta{color:var(--text-soft);font-size:.9rem}figure{margin:0}figure img{display:block;width:100%;height:auto;max-height:480px;object-fit:contain;background:var(--panel);border-radius:6px}figcaption{padding:10px 0 20px}.photo-set{margin-top:32px}.photo-set h3{margin-bottom:20px}.video{aspect-ratio:16/9;background:var(--panel);display:grid;place-items:center;margin:20px 0}.video button{padding:18px;background:var(--accent);color:white;border:0;border-radius:6px;font:inherit;cursor:pointer}.video iframe{width:100%;height:100%;border:0}a:focus-visible,button:focus-visible,iframe:focus-visible{outline:3px solid #ae6500;outline-offset:4px}[hidden]{display:none!important}@media(max-width:600px){main{padding-top:32px}.card{padding:18px}.wrap{padding:0 20px}}
</style></head><body>
<header class="site"><div class="wrap"><a class="logo" href="/">IK <em>ENG</em></a><nav aria-label="Main navigation"><a href="/">Home</a><a href="/projects.html" aria-current="page">Projects</a><a href="/how-it-works.html">How it works</a><a href="/shipping-from-china-to-uk.html">Shipping only</a><a href="/#brief">Send a brief</a></nav></div></header>
<main class="wrap"><p class="kicker">Project evidence</p><h1>Projects</h1><p>Delivered work, current client briefs and the work of our team in China.</p>
<section aria-labelledby="delivered-heading"><h2 id="delivered-heading">Delivered</h2>
<article class="card"><span class="badge delivered">Delivered</span><h3>Full-house supply from China</h3><p>Private residence, Malappuram, India.</p><div class="video" data-project-video><button type="button">Play project video</button></div><p class="meta">Video by the project architects, Arif Associates.</p></article>
<article class="card"><span class="badge delivered">Delivered</span><h3>China to UK shipment</h3><p>Pre-shipment inspection by our team in China.</p></article>
<div id="delivered-photos" aria-live="polite"></div></section>
<section aria-labelledby="progress-heading"><h2 id="progress-heading">Projects in progress</h2><p class="meta">Current briefs. Stage labels marked “to confirm” await a project update.</p><p id="projects-status" role="status">Loading current projects…</p><div class="grid" id="projects"></div><noscript><p>Enable JavaScript to view consented current project briefs.</p></noscript></section>
<section id="process-section" aria-labelledby="process-heading" hidden><h2 id="process-heading">How we work — in pictures</h2><div id="process-photos"></div></section>
</main>'''+footer+'''
<script>
(() => {
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
  const badge = (text, cls) => el('span', text, 'badge ' + cls);
  const localImage = value => typeof value === 'string' && /^\\/images\\/[a-zA-Z0-9/_-]+\\.(jpg|jpeg|png|webp)$/.test(value);
  function figure(photo) {
    const f = el('figure'), img = el('img'); img.src = photo.file; img.alt = photo.caption; img.loading = 'lazy'; img.decoding = 'async';
    f.append(img, el('figcaption', photo.caption)); return f;
  }
  async function read(path) { const response = await fetch(path); if (!response.ok) throw new Error('Data unavailable'); const result = await response.json(); if (!Array.isArray(result)) throw new Error('Invalid data'); return result; }
  read('/data/projects.json').then(entries => {
    const visible = entries.filter(p => p.consent === true), host = document.getElementById('projects');
    document.getElementById('projects-status').textContent = visible.length ? '' : 'Current client projects will appear here as clients approve them.';
    visible.forEach(p => {
      const card = el('article', '', 'card');
      card.append(badge(p.stage === 'Delivered' ? 'Delivered' : 'In progress', p.stage === 'Delivered' ? 'delivered' : 'progress'), el('h3', p.title));
      card.append(el('p', [p.location, p.sector].filter(Boolean).join(' · '), 'meta'));
      const list = el('ul'); (p.scope || []).forEach(s => list.append(el('li', s))); card.append(list, el('p', p.approach));
      card.append(el('p', (p.stage_confirmed === false ? 'Stage to confirm: ' : 'Stage: ') + p.stage, 'meta'), el('p', 'Updated: ' + p.updated, 'meta'));
      (p.photos || []).filter(photo => localImage(photo.file) && photo.caption).forEach(photo => card.append(figure(photo)));
      host.append(card);
    });
  }).catch(() => { document.getElementById('projects-status').textContent = 'Current projects could not be loaded. Please try again later.'; });
  const titles = {vatakara:'Delivered: lighting and interior finishes, private residence, Vatakara, India (2025)', residence:'Delivered: private residence, India', 'guest-rooms':'Delivered: furnished guest rooms — beds, upholstered headboards, seating, tables, wall lights', gate:'Delivered: carved entrance gate, from factory to site'};
  read('/data/process-photos.json').then(entries => {
    const groups = new Map();
    entries.filter(p => localImage(p.file) && p.caption).forEach(p => {
      if (p.stage === 'Delivered' && !titles[p.project_ref]) return;
      const key = p.stage === 'Delivered' ? p.project_ref : p.stage;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(p);
    });
    groups.forEach((photos, key) => {
      const delivered = Boolean(titles[key]), set = el('article', '', 'photo-set');
      set.append(badge(delivered ? 'Delivered' : 'Process evidence', delivered ? 'delivered' : 'process'), el('h3', titles[key] || key));
      const grid = el('div', '', 'grid'); photos.forEach(p => grid.append(figure(p))); set.append(grid);
      document.getElementById(delivered ? 'delivered-photos' : 'process-photos').append(set);
      if (!delivered) document.getElementById('process-section').hidden = false;
    });
  }).catch(() => { const host = document.getElementById('delivered-photos'); host.append(el('p', 'Project photographs could not be loaded. Please try again later.')); });
  document.querySelectorAll('[data-project-video] button').forEach(button => button.addEventListener('click', () => {
    const frame = el('iframe'); frame.src = 'https://www.youtube-nocookie.com/embed/5RZrTLAk7eU?autoplay=1'; frame.title = 'Full-house supply, Malappuram — video by Arif Associates'; frame.allow = 'autoplay; encrypted-media; picture-in-picture'; frame.allowFullscreen = true; frame.tabIndex = 0; button.parentElement.replaceChildren(frame); frame.focus();
  }));
})();
</script></body></html>
'''
write(SITE / 'projects.html',html)
index=(SITE / 'index.html').read_text(encoding='utf-8')
if '<a href="/projects.html">Projects</a>' not in index:
    index=index.replace('<a href="/collection.html">Collection</a>', '<a href="/collection.html">Collection</a>\n<a href="/projects.html">Projects</a>',1)
# PR #47 is not present in this checkout: add the supplied click-to-load video locally.
section='''<section class="section section-white" id="project-video"><div class="inner"><div class="sec-label">Project video</div><h2 class="sec-title">Full-house supply from China</h2><p>Delivered: private residence, Malappuram, India. Video by the project architects, Arif Associates.</p><div id="home-project-video" style="aspect-ratio:16/9;max-width:800px;display:grid;place-items:center;background:#eef1f5"><button type="button" class="btn-gold" id="play-project-video">Play project video</button></div><p><a href="/projects.html">View projects and process photos</a></p></div></section>
<script>document.getElementById('play-project-video').addEventListener('click', function () { const frame = document.createElement('iframe'); frame.src = 'https://www.youtube-nocookie.com/embed/5RZrTLAk7eU?autoplay=1'; frame.title = 'Malappuram project video by Arif Associates'; frame.allow = 'autoplay; encrypted-media; picture-in-picture'; frame.allowFullscreen = true; frame.tabIndex = 0; frame.style.cssText = 'width:100%;height:100%;border:0'; this.parentElement.replaceChildren(frame); frame.focus(); });</script>
'''
if 'id="project-video"' not in index:
    index=index.replace('<section class="section section-white" id="who-we-serve">',section+'<section class="section section-white" id="who-we-serve">',1)
write(SITE / 'index.html',index)
sitemap=(SITE / 'sitemap.xml').read_bytes()
if b'https://ikeng.co.uk/projects.html' not in sitemap:
    ending=b'\r\n' if b'\r\n' in sitemap else b'\n'
    (SITE / 'sitemap.xml').write_bytes(sitemap.replace(b'</urlset>',b'<url><loc>https://ikeng.co.uk/projects.html</loc><lastmod>2026-11-21</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>'+ending+b'</urlset>'))
print(f'Prepared {len(photos)} photographs and {len(projects)} consented briefs.')
