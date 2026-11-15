/* Legacy Sensor v1.7.0 BETA | W6 local-only PC + WebApp profile.
 * UI-only. No Firebase, network leaderboard, video, pose or game-loop changes.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const int=x=>{const n=Number(x);return Number.isFinite(n)?Math.max(0,Math.trunc(n)):0};
const fmt=x=>int(x).toLocaleString();
const linked=()=>!!window.LegacyW4?.usePC?.();
const current=()=>window.LegacyW4?.getProfile?.()||null;
window.LegacyW5={isLinked:linked,openBoard:()=>{}};
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n};
const badge=(name,v)=>{const e=node('div','lsw5-value');e.append(node('b','',fmt(v)),node('small','',name));return e};
const normalize=s=>String(s||'').split(/[\\/]/).pop().replace(/\.(png|jpe?g|webp)$/i,'').replace(/(?:_p\d+)?_?(?:ava|avatar)$/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
let catalog=null,last='',wasLinked=false,portraitFor='';
async function portrait(p){
 const img=$('lsw5Portrait');if(!img||!p||!linked())return;
 const name=normalize(p.selectedAvatarAsset);if(!name||name===portraitFor)return;
 try{if(!catalog){const r=await fetch('lsw2_assets/catalog.json',{cache:'force-cache'});if(!r.ok)return;catalog=await r.json()}
  const items=[...(catalog.avatars||[]),...(catalog.styles||[])];
  const item=items.find(x=>normalize(x.id)===name)||items.find(x=>name.length>=7&&normalize(x.id).startsWith(name));
  if(item?.thumb){img.src='lsw2_assets/'+item.thumb;img.alt='Selected Windows avatar';portraitFor=name}
 }catch(_){/* keep default logo on offline/catalog errors */}
}
function createUI(){if($('lsw5Identity')||!$('profileCardView'))return;
 const hero=node('section','lsw5-identity');hero.id='lsw5Identity';hero.hidden=true;
 const left=node('div','lsw5-hero-left');const img=node('img','lsw5-portrait');img.id='lsw5Portrait';img.src='assets/icons/webapp-icon-180.png';img.alt='Legacy Sensor profile';
 const title=node('div');title.append(node('small','lsw5-kicker','✦ LOCAL DANCER PROFILE · WINDOWS + WEBAPP'),node('h3','lsw5-name','Windows dancer'),node('p','lsw5-sub','One level · One XP balance · One collection'));
 left.append(img,title);const values=node('div','lsw5-numbers');values.id='lsw5Numbers';
 const footer=node('div','lsw5-foot');footer.append(node('span','','Your Windows progress stays on the PC. Phone cosmetics stay local; your original phone save is preserved.'));
 hero.append(left,values,footer);$('profileCardView').prepend(hero);
 const css=document.createElement('link');css.rel='stylesheet';css.href='lsw6_assets/offline_profile.css?v=6';document.head.append(css);
 for(const [tab,id,text] of [
  ['tab-home','lsw5HomeNote','Your Windows challenges and XP are the source of progression while linked. Local phone XP is paused to prevent duplicates.'],
  ['tab-gift','lsw5GiftNote','Use the Windows Gift Machine for linked coins and rewards. Your phone-only coins remain unchanged.']
 ]){
  const base=$(tab);if(!base||$(id))continue;const note=node('section','lsw5-hold-note',text);note.id=id;base.querySelector('.top')?.after(note);
 }
}
function render(){const active=linked(),p=current();document.body.classList.toggle('lsw5-pc-linked',active);
 const hero=$('lsw5Identity');if(hero)hero.hidden=!active;
 if(active&&p){const name=hero?.querySelector('.lsw5-name');if(name)name.textContent=p.nickname||'Dancer';
  const sign=[p.level,p.xp,p.legacyCoins,p.sessions,p.nickname,p.selectedAvatarAsset].join('|');
  if(sign!==last){const values=$('lsw5Numbers');if(values)values.replaceChildren(badge('PC LEVEL',p.level),badge('PC XP',p.xp),badge('PC COINS',p.legacyCoins),badge('PC SESSIONS',p.sessions));
   if(p.selectedAvatarAsset!==portraitFor){portraitFor='';portrait(p)}last=sign;
  }
  if($('coinBalance'))$('coinBalance').textContent=fmt(p.legacyCoins);
  if($('coinBalanceHome'))$('coinBalanceHome').textContent=fmt(p.legacyCoins);
 }
 if(!active&&wasLinked){last='';portraitFor='';}
 wasLinked=active;
}
function blockDuplicateSpending(e){if(!linked())return;
 const target=e.target?.closest?.('#gmKnob,[data-claim]');if(!target)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(typeof window.lsToast==='function')window.lsToast({title:'PC profile is active',msg:'Use Windows for shared coins and rewards. Your phone look can still be customized.',icon:'✦',ms:3300});
}
function init(){createUI();render();document.addEventListener('click',blockDuplicateSpending,true);
 setInterval(()=>{if(!document.hidden)render()},2600);
 document.querySelectorAll('.nav-btn[data-tab="tab-profile"]').forEach(b=>b.addEventListener('click',()=>setTimeout(render,110)));
 window.addEventListener('pageshow',render);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
