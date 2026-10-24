/* Offline protocol search and safe developer tools in the existing NI dashboard. */
(function () {
'use strict';
if (window.__LATIF_IANA_UI || !window.LATIF_IANA) return;
window.__LATIF_IANA_UI = true;
const css=document.createElement('style');
css.textContent=[
'#li-launch{position:fixed;right:16px;bottom:78px;z-index:2147483000;padding:14px;',
'border:1px solid #4be5d0;border-radius:25px;color:#dff;background:#07313a;font:700 14px system-ui}',
'#li-panel{position:fixed;inset:0;z-index:2147483001;display:none;flex-direction:column;',
'font:14px system-ui;color:#e4f4ff;background:#081320}',
'#li-panel *{box-sizing:border-box}',
'#li-top{display:flex;gap:10px;align-items:center;padding:15px;background:#142638}',
'#li-top strong{flex:1;font-size:17px}',
'#li-body{overflow:auto;flex:1;max-width:850px;width:100%;margin:auto;padding:15px}',
'#li-panel button,#li-panel select{border:1px solid #417083;background:#113541;color:#dcfff5;',
'border-radius:11px;padding:11px;margin:3px;cursor:pointer}',
'#li-panel input,#li-panel textarea{width:100%;background:#102132;color:#fff;',
'border:1px solid #315063;border-radius:10px;padding:13px;font:15px system-ui}',
'#li-results{margin-top:15px}',
'.li-result{background:#102538;border:1px solid #294457;padding:13px;border-radius:12px;margin:10px 0;',
'word-break:break-word;white-space:pre-wrap;line-height:1.5}',
'.li-result strong{color:#97f2d7;display:block;margin-bottom:6px}',
'.li-result a{color:#88dfff;display:block;margin-top:7px}',
'#li-status{font-size:12px;color:#a7c4d4;margin:10px 0}',
'#li-output{white-space:pre-wrap;word-break:break-word;background:#091d2d;padding:12px;',
'border:1px solid #2b455b;min-height:50px}'
].join('');
document.head.appendChild(css);
const node=(tag,parent,label)=>{const e=document.createElement(tag);if(label!=null)e.textContent=label;if(parent)parent.appendChild(e);return e};
const btn=(parent,label,callback)=>{const b=node('button',parent,label);b.type='button';b.addEventListener('click',callback);return b};
const launch=btn(document.body,'◇ IANA INTELLIGENCE',open);launch.id='li-launch';
const panel=node('section',document.body);panel.id='li-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Offline IANA registry search');
const head=node('div',panel);head.id='li-top';node('strong',head,'IANA Protocol Intelligence');btn(head,'Close',close);
const body=node('div',panel);body.id='li-body';
const nav=node('div',body);
const browse=node('section',body),tools=node('section',body);
btn(nav,'Registry Search',()=>show('browse'));
btn(nav,'Local Security Tools',()=>show('tools'));
const status=node('div',browse,'Offline registry archive');status.id='li-status';
const query=node('input',browse);query.placeholder='Search DNS, TLS, TCP, ports, MIME, OAuth…';query.type='search';
const results=node('div',browse);results.id='li-results';
btn(browse,'Browse categories',listCategories);
function item(title,text,source){
const box=node('article',results);box.className='li-result';node('strong',box,title);node('div',box,text);
if(source && /^https:\/\/www\.iana\.org\/assignments\/[a-z0-9-]+(?:#[a-z0-9-]+)?$/i.test(source)){
const a=node('a',box,'View official source ↗');a.href=source;a.rel='noopener noreferrer';a.target='_blank';}
}
function search(){
const term=query.value.trim();results.replaceChildren();if(!term)return;
try{
const hits=JSON.parse(window.LATIF_IANA.search(term,40));
hits.forEach(h=>item(h.registry,(h.summary||'').slice(0,1200),h.source));
if(!hits.length)item('No matches','Try another term or browse categories');
status.textContent=hits.length+' results · offline lookup';
}catch(e){status.textContent='Search unavailable: '+e.message;}
}
let throttle;query.addEventListener('input',()=>{clearTimeout(throttle);throttle=setTimeout(search,180);});
function listCategories(){
results.replaceChildren();
try{const data=JSON.parse(window.LATIF_IANA.registryList(0));
data.forEach(x=>item(x.name,String(x.records)+' records · '+x.family,x.source));
status.textContent=data.length+' categories shown · search includes all available registries';
}catch(e){status.textContent=e.message;}
}
function show(mode){browse.style.display=mode==='browse'?'block':'none';tools.style.display=mode==='tools'?'block':'none';}
function open(){
panel.style.display='flex';launch.style.display='none';
try{const info=JSON.parse(window.LATIF_IANA.info());
status.textContent=info.available ? info.registry_count+' registries · '+info.row_count+' records · '+info.built_at_utc
: 'Offline data missing: '+(info.error||'Unknown error');
}catch(e){status.textContent='Native database unavailable: '+e.message;}
query.focus();
}
function close(){panel.style.display='none';launch.style.display='block';}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.style.display==='flex')close();});
show('browse');
node('p',tools,'All utilities run locally. No device scanning or remote requests.');
const pick=node('select',tools);
[['sha256','SHA-256 hash'],['json','JSON formatter/validator'],['base64e','Base64 UTF-8 encode'],
['base64d','Base64 UTF-8 decode'],['url','URL parser'],['cidr','IPv4 CIDR inspector'],
['uri','URI component encoder']].forEach(([v,name])=>{const x=node('option',pick,name);x.value=v;});
const input=node('textarea',tools);input.rows=5;input.placeholder='Type or paste input';
const output=node('pre',tools,'Ready');output.id='li-output';
btn(tools,'Run on device',async()=>{
try{
const value=input.value;let result='';
if(pick.value==='sha256'){
const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
result=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
}else if(pick.value==='json'){result=JSON.stringify(JSON.parse(value),null,2);
}else if(pick.value==='base64e'){
const data=new TextEncoder().encode(value);let s='';data.forEach(x=>s+=String.fromCharCode(x));result=btoa(s);
}else if(pick.value==='base64d'){
result=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value.trim()),x=>x.charCodeAt(0)));
}else if(pick.value==='url'){
const u=new URL(value);result=JSON.stringify({scheme:u.protocol,host:u.hostname,port:u.port,path:u.pathname,query:u.search,fragment:u.hash},null,2);
}else if(pick.value==='cidr'){
const m=/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d|[12]\d|3[012])$/.exec(value.trim());
if(!m)throw Error('Use address/prefix like 192.168.1.10/24');
const octets=m[1].split('.').map(Number);if(octets.some(n=>n>255))throw Error('Invalid IPv4 octet');
const bits=Number(m[2]),ip=octets.reduce((a,b)=>((a<<8)|b)>>>0,0);
const mask=bits===0?0:(0xffffffff<<(32-bits))>>>0;
const fmt=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.');
result=JSON.stringify({address:fmt(ip),prefix:bits,netmask:fmt(mask),network:fmt(ip&mask),broadcast:fmt((ip&mask)|(~mask)),addresses:2**(32-bits)},null,2);
}else{result=encodeURIComponent(value);}
output.textContent=result;
}catch(e){output.textContent='Error: '+e.message;}
});
})();