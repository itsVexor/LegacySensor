/* Legacy Sensor W4 — ONE PC-FIRST LOCAL PROFILE VIEW.
   Display layer only: no writes to PC progression, camera, tracking, pose or FPS.
   Firebase leaderboard deliberately keeps WebApp-local XP until verified cloud accounts. */
(()=>{'use strict';
const KEY='lsSyncKey',PAIR_KEY='ls_w3_pairing_key',ENDPOINT='/ls-profile/v2/profile';
let key='',pc=null,connected=false,pcPrimary=true,pending=false,panel=null;
let originalLocalName='',requestedAt=0;
const $=id=>document.getElementById(id);
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n}
function n(v){const t=Number(v);return Number.isFinite(t)?Math.max(0,Math.floor(t)):0}
function fmt(v){return n(v).toLocaleString()}
function minutes(s){const m=Math.round(n(s)/60);return m>=60?Math.floor(m/60)+'h '+(m%60)+'m':m+'m'}
function loadKey(){try{
 const u=new URL(location.href),received=u.searchParams.get(KEY);
 if(received&&/^[0-9a-f]{64}$/.test(received)){
  key=received;sessionStorage.setItem(PAIR_KEY,key);u.searchParams.delete(KEY);
  history.replaceState(history.state,'',u.pathname+u.search+u.hash);
 }else key=sessionStorage.getItem(PAIR_KEY)||'';
 }catch(_){}if(!/^[0-9a-f]{64}$/.test(key))key='';}
function usePC(){return connected&&pcPrimary&&!!pc}
window.LegacyW4={usePC,refresh:()=>fetchPC(true),getProfile:()=>usePC()?pc:null};
function addTile(host,label,value){const tile=el('div','lsw4-number');tile.append(el('strong','',value),el('small','',label));host.append(tile)}
function status(message,active){const e=$('lsw4Status');if(e){e.textContent=message;e.classList.toggle('on',!!active)}}
function build(){if($('lsw4UnifiedProfile'))return;
 const tab=$('tab-profile');if(!tab)return;
 const p=el('section','lsw4-panel');p.id='lsw4UnifiedProfile';
 const eyebrow=el('div','lsw4-eyebrow','✦ LOCAL PROFILE · PC ↔ PHONE');
 const heading=el('h3','','Your shared dancer progress');
 const info=el('p','lsw4-status','Scan a fresh Legacy Sensor QR code to connect.');info.id='lsw4Status';
 const summary=el('div','lsw4-summary');summary.id='lsw4Summary';
 const primaryLabel=el('div','lsw4-choice-label','PROFILE VIEW');
 const toggle=el('button','lsw4-toggle','PC progression: ON');toggle.id='lsw4Toggle';toggle.type='button';toggle.setAttribute('aria-pressed','true');
 toggle.addEventListener('click',()=>{pcPrimary=true;syncView();});
 const btn=el('button','lsw4-refresh','Refresh PC data');btn.type='button';btn.onclick=()=>fetchPC(true);
 const unlink=el('button','lsw4-disconnect','Unlink phone');unlink.type='button';unlink.onclick=()=>{
  key='';pc=null;connected=false;try{sessionStorage.removeItem(PAIR_KEY)}catch(_){}
  syncView();status('Local phone mode. Re-scan the QR to pair.',false);
 };
 const actions=el('div','lsw4-actions');actions.append(toggle,btn,unlink);
 const collection=el('div','lsw4-collection');collection.id='lsw4Collection';
 const foot=el('p','lsw4-disclaimer','Your Windows profile supplies level, XP, coins and rewards while paired over local Wi-Fi. Your existing phone save is preserved separately.');
 p.append(eyebrow,heading,info,summary,primaryLabel,actions,collection,foot);
 const anchor=$('lswProfileHero')||tab.querySelector('.hero')||tab.querySelector('.top');anchor?.after(p);
 const board=el('p','lsw4-board-notice','Leaderboard still uses phone XP. Your verified PC score will be supported in a later online-account update.');
 board.id='lsw4BoardNote';
 const boardView=$('profileBoardView');if(boardView)boardView.prepend(board);
 const css=document.createElement('link');css.rel='stylesheet';css.href='lsw4_assets/unified_profile.css?v=4';document.head.appendChild(css);
 panel=p;
 if(!key)status('Not linked — your offline phone profile is safe.',false);
 syncView();
}
function collectionRender(){const host=$('lsw4Collection');if(!host)return;host.replaceChildren();if(!pc)return;
 const title=el('b','lsw4-collection-title','PC COLLECTION · GIFT MACHINE');host.append(title);
 const grid=el('div','lsw4-collection-grid');
 const labels=[['avatars','Avatars'],['backgrounds','Backgrounds'],['titles','Titles'],['stickers','Stickers']];
 for(const [type,label] of labels){const v=pc.collection?.[type]||{};const all=v.total==null?'':` / ${fmt(v.total)}`;addTile(grid,label,fmt(v.unlocked)+all)}
 host.append(grid);
 const names=[];for(const type of ['avatars','backgrounds','titles','stickers']){
  const arr=pc.unlockedGiftRewards?.[type];if(Array.isArray(arr))for(const item of arr.slice(0,3)){names.push(item.replace(/\.(png|jpe?g|webp)$/i,''))}
 }
 const preview=el('p','lsw4-rewards',names.length?'Recently available PC rewards: '+names.slice(0,8).join(' · '):'Your PC Gift Machine collection is currently empty.');host.append(preview);
 const note=el('p','lsw4-rewards','PC selected avatar: '+(pc.selectedAvatarAsset||'unknown')+'. The mobile appearance is still customized separately, so no unlocked PC item is overwritten.');host.append(note);
}
function setText(id,text){const e=$(id);if(e)e.textContent=String(text)}
function restorePhone(){const a=$('profileNickname');if(a){a.readOnly=false;if(originalLocalName)a.value=originalLocalName;}
 try{window.__lsRenderLevel?.()}catch(_){}
 try{window.__lsRenderStats?.()}catch(_){}
 // W2 will keep rendering the phone's own Player Card and appearance.
}
function syncView(){const active=usePC();const toggle=$('lsw4Toggle');if(toggle){toggle.textContent=active?'PC progression: ON':'PC progression: OFF';toggle.setAttribute('aria-pressed',String(active));}
 if(!active){restorePhone();if(panel)panel.classList.remove('linked');if(pc){status('PC connected · showing phone-only progression until you turn on PC mode.',true);collectionRender()};return}
 if(panel)panel.classList.add('linked');
 setText('profileLvl','LVL '+pc.level);setText('lvlTitle','Level '+pc.level);setText('lvlRank','PC · Shared progress');
 setText('lvlXpText',fmt(pc.xpInLevel)+' / '+fmt(pc.xpGoal)+' XP');
 const fill=$('lvlFill');if(fill)fill.style.width=Math.min(100,100*n(pc.xpInLevel)/Math.max(1,n(pc.xpGoal)))+'%';
 setText('lvlHint',fmt(n(pc.xpGoal)-n(pc.xpInLevel))+' XP to next PC level. Your phone-only experience is preserved.');
 const a=$('profileNickname');if(a){if(!originalLocalName)originalLocalName=a.value;a.value=pc.nickname||'Dancer';a.readOnly=true;a.title='To change the linked nickname, edit the Player Card on Windows';}
 setText('statHighScore','—');setText('statDances',fmt(pc.sessions));setText('statAvg',minutes(pc.danceSeconds));
 setText('statStreak','—');setText('statStars',fmt(pc.giftUnlockedCount));setText('statKcal','—');
 status('✓ Connected locally · '+pc.nickname+' · Level '+pc.level+' · '+fmt(pc.legacyCoins)+' PC coins',true);
 const summary=$('lsw4Summary');if(summary){summary.replaceChildren();addTile(summary,'PC LEVEL',fmt(pc.level));addTile(summary,'PC XP',fmt(pc.xp));addTile(summary,'PC COINS',fmt(pc.legacyCoins));addTile(summary,'PC SESSIONS',fmt(pc.sessions))}
 collectionRender();
 // W2 previews take the level from #profileLvl at render time, not from a second counter.
}
async function fetchPC(notify=false){if(!key){status('Open the QR code in your Windows app and pair again.',false);return}
 if(pending)return;pending=true;requestedAt=Date.now();
 try{
  const url=ENDPOINT+'?lsSyncKey='+encodeURIComponent(key);
  const resp=await fetch(url,{cache:'no-store',credentials:'same-origin',referrerPolicy:'no-referrer'});
  if(!resp.ok)throw new Error(resp.status===403?'QR key invalid — scan again':'PC server returned '+resp.status);
  const data=await resp.json();if(!data.ok||data.profile?.schema!==2)throw new Error('Old bridge — install W4 on Windows');
  pc=data.profile;connected=true;syncView();
  if(notify&&typeof window.lsToast==='function')window.lsToast({title:'PC profile updated',msg:'Level '+pc.level+' · '+fmt(pc.legacyCoins)+' PC coins',icon:'✓',ms:2300});
 }catch(err){if(pc){connected=true;syncView();status('PC temporarily offline · last synced Windows progress (read-only)',false)}else{connected=false;restorePhone();syncView();if(panel)panel.classList.remove('linked');status('PC unavailable · scan your QR again',false)}}finally{pending=false}
}
async function shareLook(){if(!key||!connected)return;
 let look=null;try{look=JSON.parse(localStorage.getItem('lsw_card_v1')||'null')}catch(_){}
 if(!look||typeof look!=='object')return;
 try{await fetch('/ls-profile/v1/mobile-look?lsSyncKey='+encodeURIComponent(key),{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(look),cache:'no-store',referrerPolicy:'no-referrer'
 })}catch(_){}
}
loadKey();
function init(){build();if(key)fetchPC();
 setInterval(()=>{if(!document.hidden&&key&&Date.now()-requestedAt>=12000)fetchPC()},15000);
 document.querySelectorAll('.nav-btn[data-tab="tab-profile"]').forEach(e=>e.addEventListener('click',()=>setTimeout(syncView,80)));
 document.addEventListener('click',(e)=>{if(e.target.closest?.('#lswSave'))setTimeout(shareLook,90)});
 window.addEventListener('pageshow',()=>{if(key)fetchPC()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
