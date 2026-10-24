const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../ik-v4/package-builder.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../ik-v4/package-builder.html'), 'utf8');
const nodes = new Map();
const element = () => ({innerHTML:'',value:'',textContent:'',hidden:false,disabled:false,addEventListener(){},setAttribute(){},focus(){},scrollIntoView(){}});
function node(selector) { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); }
const fields = Object.fromEntries(['form-name','bot-field','property_type','number_of_properties','role','rooms','products','selected_items','finish_level','specifications','storage_notes','delivery_postcode','required_delivery','budget','brief_summary','name','email','phone','company'].map(key => [key, {value:''}]));
fields['form-name'].value = 'package-brief'; fields.name.value = 'Test'; fields.email.value = 'test@example.com';
const form = node('#package-form'); form.elements = {namedItem:key=>fields[key]}; form.reportValidity = () => true;
for (const key of ['name','email','phone','company']) nodes.set('#package-form [name="'+key+'"]', fields[key]);
let mode = 'failure', requests = [];
const context = {console,URL,URLSearchParams,AbortController,Blob,setTimeout,clearTimeout,Math,Date,confirm:()=>false,location:{origin:'https://example.test',search:'?type=hmo',reload(){}},window:{print(){}},navigator:{},document:{querySelector:node,querySelectorAll:()=>[],createElement:()=>({click(){}})},FormData:class { constructor() {this.values=Object.entries(fields).map(([key,field])=>[key,field.value]);} [Symbol.iterator](){return this.values[Symbol.iterator]();}},fetch:async (url,options)=>{if(!options?.method)return {ok:false}; requests.push({url,options}); if(mode==='failure')throw new Error('Offline');return {ok:true};}};
vm.createContext(context); vm.runInContext(source, context);
const run = code => vm.runInContext(code, context);
(async()=>{
  assert.equal(run('state.type'),'HMO / shared home');
  assert.equal(run('validate(1).length'),1);
  run("state.categories=['Kitchens & utility cabinetry'];state.rooms.Bedrooms=2;state.properties=3;state.kitchenLayout='Island';skipToContact()");
  assert.equal(run('state.step'),5); assert.equal(form.hidden,false);
  for(let step=0;step<6;step++){run('state.step='+step+';render()');assert.match(node('#panel').innerHTML,new RegExp('Step '+(step+1)+' of 6'));}
  run('state.step=5;render()');
  const brief=run('briefFields()');assert.match(brief.rooms,/Bedrooms: 2 per property/);assert.match(brief.brief_summary,/6 total/);assert.match(brief.specifications,/Island/);assert.equal(brief.selected_items,'');
  assert.equal(run("cleanImage('https://other.test/images/collection/item.webp')"),'');
  assert.equal(run("cleanImage('/images/collection/item.webp')"),'/images/collection/item.webp');
  await run('sendBrief({preventDefault(){}})');
  assert.equal(node('#send-brief').disabled,false);assert.match(node('#send-status').textContent,/could not confirm/);assert.match(run('textBrief()'),/Test/);
  mode='success'; await run('sendBrief({preventDefault(){}})');
  assert.equal(requests.length,2);assert.equal(requests[1].url,'/');assert.equal(requests[1].options.method,'POST');
  const body=new URLSearchParams(requests[1].options.body);assert.equal(body.get('form-name'),'package-brief');assert.equal(body.get('email'),'test@example.com');assert.equal(body.get('property_type'),'HMO / shared home');assert.match(body.get('brief_summary'),/Island/);
  assert.match(node('#send-status').textContent,/within 48 hours/);assert.equal(node('#sent-whatsapp').hidden,false);
  await run('sendBrief({preventDefault(){}})');assert.equal(requests.length,2,'Duplicate submission must be blocked');
  assert.match(html, /name="package-brief"[^>]+data-netlify="true"/);assert.match(html,/name="bot-field"/);
  assert.equal(Buffer.byteLength(source)+Buffer.byteLength(html)<150000,true);
  console.log('PASS: six steps, optional-field skip, per-property totals, exact Netlify payload, failed submission fallback, success and duplicate guard, safe image URLs, static form and weight budget.');
})().catch(error=>{console.error(error);process.exitCode=1;});
