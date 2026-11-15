/* Legacy Sensor W3 — profile link, entirely outside motion/camera/pose code. */
(()=>{'use strict';
const KEY='lsSyncKey', ENDPOINT='/ls-profile/v1/profile';
let key='';let linked=false;let currentProfile=null;let busy=false;let interval=null;
function readKey(){
  try { const url=new URL(location.href);const k=url.searchParams.get(KEY);
    if(k&&/^[a-f0-9]{64}$/.test(k)){
      key=k;sessionStorage.setItem('ls_w3_pairing_key',k);
      url.searchParams.delete(KEY);history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    }else{key=sessionStorage.getItem('ls_w3_pairing_key')||'';}
  }catch(_){}
  if(!/^[a-f0-9]{64}$/.test(key))key='';
}
const id=(x)=>document.getElementById(x);
function node(tag,classes,text){let e=document.createElement(tag);if(classes)e.className=classes;if(text!=null)e.textContent=text;return e}
function init(){if(id('lsw3ProfileLink'))return;
  const tab=id('tab-profile');if(!tab)return;
  const container=node('section','lsw3-account');container.id='lsw3ProfileLink';
  const heading=node('h3','', 'PC ↔ WebApp · Legacy Account');
  const indicator=node('p','lsw3-status','Connect your phone using the QR from Legacy Sensor on your PC.');indicator.id='lsw3Status';
  const info=node('div','lsw3-stats');info.id='lsw3Stats';
  const details=node('p','lsw3-hint','Your Windows XP and Legacy Coins are displayed here as the trusted PC values. Phone-only levels and coins are not yet merged.');
  const refresh=node('button','lsw3-refresh','Refresh PC profile');refresh.type='button';refresh.onclick=()=>update(true);
  container.append(heading,indicator,info,details,refresh);
  const hero=id('lswProfileHero');(hero||tab.querySelector('.hero')||tab.querySelector('.top'))?.after(container);
  const css=document.createElement('link');css.rel='stylesheet';css.href='lsw3_assets/profile_sync.css?v=3';document.head.appendChild(css);
  if(key){update();interval=setInterval(()=>{if(!document.hidden)update()},12000)}
}
function status(s){const n=id('lsw3Status');if(n)n.textContent=s}
function render(p){const host=id('lsw3Stats');if(!host)return;host.replaceChildren();
 const items=[['PC LEVEL',p.level],['XP',p.xp.toLocaleString()],['LEGACY COINS',p.legacyCoins.toLocaleString()],['SESSIONS',p.sessions]];
 for(const [name,v] of items){const d=node('div','lsw3-stat');d.append(node('b','',String(v)),node('small','',name));host.appendChild(d)}
 status('✓ Connected locally · '+p.nickname+' · '+p.title);
 const text=id('lsw3ProfileLink')?.querySelector('.lsw3-hint');if(text)text.textContent='PC: '+p.xpInLevel+' / '+p.xpGoal+' XP to next level · '+Math.round(p.danceSeconds/60)+' min dancing. This is a local pairing, not yet a cloud account.';
}
async function update(notify=false){if(!key){status('Scan the current QR on your PC to link this WebApp.');return}
 if(busy)return;busy=true;
 try{const r=await fetch(ENDPOINT+'?lsSyncKey='+encodeURIComponent(key),{cache:'no-store',credentials:'same-origin',referrerPolicy:'no-referrer'});
  if(!r.ok)throw new Error(r.status===403?'QR pairing expired or was changed':'PC is unreachable ('+r.status+')');
  const j=await r.json();if(!j.ok||!j.profile)throw Error('Invalid PC response');linked=true;currentProfile=j.profile;render(j.profile);
  if(notify && window.lsToast)window.lsToast({title:'PC profile linked',msg:'Level '+j.profile.level+' · '+j.profile.legacyCoins+' coins',icon:'✓',ms:2300});
 }catch(e){linked=false;status('Not synced · '+e.message+' · Your offline phone profile is unchanged.')}finally{busy=false}
}
async function shareLook(){if(!key||!linked)return;
 let look;try{look=JSON.parse(localStorage.getItem('lsw_card_v1')||'null')}catch(_){return}
 if(!look||typeof look!=='object')return;
 try{await fetch('/ls-profile/v1/mobile-look?lsSyncKey='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',referrerPolicy:'no-referrer',body:JSON.stringify(look)});
 // The Windows card is intentionally not overwritten until cosmetics can be mapped by asset ID.
 }catch(_){}
}
readKey();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
// W2 saves when #lswSave is clicked. Capture after the original click handler finishes.
document.addEventListener('click',(e)=>{if(e.target.closest?.('#lswSave'))setTimeout(shareLook,50)},false);
window.addEventListener('pageshow',()=>{if(key)update()});
})();
