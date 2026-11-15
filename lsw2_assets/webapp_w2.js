/* Legacy Sensor WebApp Patch W: no camera/tracking/bridge hooks. */
(function(){'use strict';
 const ROOT='lsw2_assets/', CARD_KEY='lsw_card_v1', LEGACY_KEY='ls_profile_v1';
 const safeRead=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch(_){return null}};
 const write=(key,val)=>{try{localStorage.setItem(key,JSON.stringify(val));return true}catch(_){return false}};
 const esc=(s)=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const els={}; let catalogue=null,stage=null,section='avatars',page=0,mode='edit';const PAGE_SIZE=16;
 const categories=[['avatars','Avatars'],['styles','Avatar styles'],['backgrounds','Backgrounds'],['borders','Borders'],['badges','Badges'],['aliases','Aliases'],['effects','Effects']];
 const aliases=['Legacy Dancer!','Legacy Fan!','Legacy Star!','I\'m da BEST!','Legacy SuperStar!','I\'ll Show You How to Dance!','Legacy MegaStar!','Gift Machine Fan!','Dancing Legend!','Dance the Night!'];
 const effects=['No effect','Cartoon Pop','Burning Hearts','Butterflies','Spotlight','Cool Traveler','Dove & Laurel','EDM Lights','Confetti','Fireworks','Blooming Flowers','Ghostly Glow','Mystic Magic','Neon Pulse','Pixel Spark','Rainbow','Rose Petals','Cosmic','Wild West','Zodiac'];
 const effectGlyph=(s)=>({'Cartoon Pop':'✦','Burning Hearts':'♥','Butterflies':'🦋','Spotlight':'','Cool Traveler':'◌','Dove & Laurel':'❧','EDM Lights':'▮','Confetti':'▰','Fireworks':'✺','Blooming Flowers':'✿','Ghostly Glow':'◌','Mystic Magic':'✧','Neon Pulse':'','Pixel Spark':'◆','Rainbow':'','Rose Petals':'❀','Cosmic':'✶','Wild West':'✦','Zodiac':'✧'}[s]||'✧');
 const effectColor=(s)=>({'Burning Hearts':'#ff668a','Cool Traveler':'#4ad9ff','EDM Lights':'#2fc9fa','Fireworks':'#ffc77d','Confetti':'#ff8dce','Pixel Spark':'#55e7f5','Cosmic':'#ac90ff','Wild West':'#e9ae60','Ghostly Glow':'#dde7ff','Rose Petals':'#f4a1ce'}[s]||'#f8b1ec');
 const byId=(list,id)=>Array.isArray(list)?list.find(x=>x.id===id):null;
 const currentNick=()=>{const p=safeRead(LEGACY_KEY);return String(p?.nickname||'ItsVexor').slice(0,18)};
 function defaults(){return {nickname:currentNick(),avatar:null,background:null,border:null,badge:null,alias:'Legacy Dancer!',effect:'No effect'}}
 function fromStorage(){const saved=safeRead(CARD_KEY);return {...defaults(),...(saved&&typeof saved==='object'?saved:{})}}
 function listOf(type){return catalogue?.[type]||[]}
 function asset(item,part='image'){return item?.[part]?ROOT+item[part]:''}
 function itemFor(type){return byId(listOf(type),stage?.[type]||null)}
 function setText(node,value){if(node)node.textContent=value||''}
 function applyEffect(fx,choice){if(!fx)return;fx.replaceChildren();const klass=choice?.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'none';fx.className='lsw-fx '+klass;if(choice==='No effect')return;
  const glyph=effectGlyph(choice);if(!glyph)return;
  for(let i=0;i<11;i++){const el=document.createElement('i');el.textContent=glyph;el.style.left=(6+(i*31)%89)+'%';el.style.top=(5+(i*23)%83)+'%';el.style.fontSize=(11+(i*7)%14)+'px';el.style.animationDelay=((-i*0.46)%4)+'s';el.style.setProperty('--fx-speed',(2.4+(i%4)*.48)+'s');el.style.setProperty('--fx-color',effectColor(choice));fx.appendChild(el)}
 }
 function renderCard(){if(!stage||!catalogue)return;
  const a=byId(listOf('avatars'),stage.avatar)||byId(listOf('styles'),stage.avatar)||listOf('avatars')[0];
  const b=byId(listOf('backgrounds'),stage.background)||listOf('backgrounds')[0];const border=byId(listOf('borders'),stage.border);const badge=byId(listOf('badges'),stage.badge);
  for(const target of document.querySelectorAll('.lsw-preview')){
    const bg=target.querySelector('.lsw-bg'),art=target.querySelector('.lsw-dancer'),frame=target.querySelector('.lsw-frame'),badgeImg=target.querySelector('.lsw-card-badge');
    bg.src=asset(b,'art');art.src=asset(a,'art');frame.src=asset(border,'art');frame.hidden=!border;
    if(badge){badgeImg.src=asset(badge,'art');badgeImg.hidden=false}else badgeImg.hidden=true;
    setText(target.querySelector('.lsw-cardname'),stage.nickname||currentNick());setText(target.querySelector('.lsw-alias'),stage.alias||'');
    setText(target.querySelector('.lsw-level'),(document.getElementById('profileLvl')?.textContent||'PLAYER CARD').trim());applyEffect(target.querySelector('.lsw-fx'),stage.effect)
  }
  const oldEl=document.getElementById('lswMiniArt'),oldBg=document.getElementById('lswMiniBg');if(oldEl)oldEl.src=asset(a,'thumb');if(oldBg)oldBg.src=asset(b,'thumb');const profileAvatar=document.getElementById('profileAvatarImg');if(profileAvatar&&a)profileAvatar.src=asset(a,'thumb');
  setText(document.getElementById('lswMiniName'),stage.nickname||currentNick());
 }
 function cardTemplate(){return `<div class="lsw-preview" role="img" aria-label="Live Dancer Card preview"><img class="lsw-bg" alt=""><img class="lsw-dancer" alt=""><div class="lsw-fx" aria-hidden="true"></div><img class="lsw-frame" alt=""><img class="lsw-card-badge" alt="" hidden><span class="lsw-level">PLAYER CARD</span><div class="lsw-cardname"></div><div class="lsw-alias"></div></div>`}
 function renderTiles(){const grid=els.gallery;grid.replaceChildren();const arr=section==='aliases'?aliases:section==='effects'?effects:listOf(section);const start=page*PAGE_SIZE;const shown=arr.slice(start,start+PAGE_SIZE);
  const key=section==='avatars'||section==='styles'?'avatar':section==='backgrounds'?'background':section==='borders'?'border':section==='badges'?'badge':section==='aliases'?'alias':'effect';
  for(let idx=0;idx<shown.length;idx++){
   const v=shown[idx],id=typeof v==='string'?v:v.id;const button=document.createElement('button');button.type='button';button.className=section==='backgrounds'?'lsw-tile lsw-cover':section==='aliases' || section==='effects'?'lsw-text-option':'lsw-tile';button.setAttribute('aria-pressed',String(stage[key]===id));button.setAttribute('aria-label',section==='aliases'||section==='effects'?String(id):(v.name||'Look'));
   if(typeof v==='string'){button.textContent=v;button.classList.toggle('active',stage[key]===id)}
   else{const img=document.createElement('img');img.src=asset(v,'thumb');img.alt='';img.loading=idx<8?'eager':'lazy';img.decoding='async';button.appendChild(img);if(section==='borders'||section==='badges'){const txt=document.createElement('span');txt.className='lsw-tile-label';txt.textContent=v.name;button.appendChild(txt)}}
   button.onclick=()=>{stage[key]=id;renderCard();renderTiles();setText(els.message,'Preview only · Save my look to keep changes')};grid.appendChild(button)
  }
  els.pager.textContent=`${Math.min(page+1,Math.max(1,Math.ceil(arr.length/PAGE_SIZE)))} / ${Math.max(1,Math.ceil(arr.length/PAGE_SIZE))}`;
  els.prev.disabled=page===0;els.next.disabled=(page+1)*PAGE_SIZE>=arr.length;
  setText(els.count,`${arr.length} items · page ${Math.min(page+1,Math.max(1,Math.ceil(arr.length/PAGE_SIZE)))} of ${Math.max(1,Math.ceil(arr.length/PAGE_SIZE))}`)
 }
 function chooseSection(type){section=type;page=0;els.gallery.hidden=false;els.gallery.parentElement.classList.remove('lsw-card-only');document.querySelectorAll('.lsw-tab').forEach(b=>b.classList.toggle('active',b.dataset.section===type));setText(els.title,categories.find(x=>x[0]===section)?.[1].toUpperCase());renderTiles()}
 function open(type='edit'){if(!catalogue){return}mode=type;stage=fromStorage();const pc=window.LegacyW4?.getProfile?.();if(pc)stage.nickname=String(pc.nickname||stage.nickname).slice(0,18);els.overlay.classList.toggle('lsw-card-mode',type==='card');const mainTitle=els.overlay.querySelector('.lsw-header h2');if(mainTitle)mainTitle.textContent=type==='card'?'YOUR PLAYER CARD':'LOCKER ROOM';els.overlay.hidden=false;document.body.dataset.lswOpen='true';document.body.style.overflow='hidden';els.name.value=stage.nickname||currentNick();els.name.readOnly=!!window.LegacyW4?.getProfile?.();setText(els.message,'Preview your look · Save locally without changing your Windows XP');chooseSection('avatars');renderCard();if(type==='card')els.gallery.scrollTop=0;els.close.focus()}
 function close(){els.overlay.hidden=true;document.body.style.overflow='';delete document.body.dataset.lswOpen}
 function save(){const pc=window.LegacyW4?.getProfile?.();stage.nickname=pc?String(pc.nickname||'Dancer').slice(0,18):(els.name.value||'Dancer').trim().slice(0,18);if(!write(CARD_KEY,stage)){setText(els.message,'Could not save: storage unavailable');return}
  // Keep the existing WebApp profile nickname, country, stats, coins, and level data.
  const legacy=safeRead(LEGACY_KEY);if(!pc&&legacy&&typeof legacy==='object'){legacy.nickname=stage.nickname;write(LEGACY_KEY,legacy)}
  const nick=document.getElementById('profileNickname');if(nick&&!pc)nick.value=stage.nickname;
  renderCard();setText(els.message,'Look saved locally · Windows level and XP were not changed')
 }
 function init(){if(document.getElementById('lswOverlay'))return;
  const profile=document.getElementById('tab-profile');if(!profile)return;
  const strip=document.createElement('div');strip.id='lswProfileHero';strip.innerHTML=`<div class="lsw-mini-portrait"><img id="lswMiniBg" class="lsw-mini-bg" alt=""><img id="lswMiniArt" class="lsw-mini-art" alt=""></div><div><span class="lsw-eyebrow">YOUR DANCER CARD · WEBAPP v1.7.0 BETA</span><h2 id="lswMiniName">Dancer</h2><p>Avatars, backgrounds, borders and effects. Your appearance is saved locally.</p><div class="lsw-button-group"><button id="lswOpenLocker" class="lsw-primary" type="button">✦ Locker Room</button><button id="lswOpenCard" class="lsw-secondary" type="button">Player Card</button></div></div>`;
  const oldHero=profile.querySelector('.hero');(oldHero||profile.querySelector('.top')).after(strip);
  const overlay=document.createElement('div');overlay.id='lswOverlay';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Locker Room');
  overlay.innerHTML=`<div class="lsw-shell"><div class="lsw-header"><div><span class="lsw-eyebrow">✦ LEGACY SENSOR WEBAPP · v1.7.0 BETA</span><h2>LOCKER ROOM</h2><p>Your dance. Your legacy. Customize your profile locally.</p></div><button type="button" class="lsw-secondary" id="lswClose">✕ Close</button></div><div class="lsw-cols"><aside class="lsw-card"><span class="lsw-subtitle">Make it yours</span><div class="lsw-tabs" id="lswTabs"></div></aside><section class="lsw-card"><span class="lsw-subtitle">Choose your look</span><h3 class="lsw-content-title" id="lswTitle">AVATARS</h3><p class="lsw-count" id="lswCount"></p><div id="lswGallery" class="lsw-gallery"></div><div class="lsw-pager"><button type="button" class="lsw-secondary" id="lswPrev">← Previous</button><span id="lswPager" class="lsw-page-label"></span><button type="button" class="lsw-secondary" id="lswNext">Next →</button></div></section><section class="lsw-card lsw-preview-column"><span class="lsw-subtitle">✦ YOUR PLAYER CARD</span>${cardTemplate()}<div><input aria-label="Dancer nickname" maxlength="18" id="lswName" placeholder="Your nickname"><div id="lswFooterNote">Avatars are static in the gallery. Only the selected look gently animates here. Your sensor, camera and scoring remain untouched.</div><div class="lsw-button-group" style="margin-top:12px"><button id="lswSave" class="lsw-primary" type="button">✓ Save my look</button><button id="lswReset" class="lsw-secondary" type="button">Reset preview</button></div><p id="lswMessage" aria-live="polite"></p></div></section></div></div>`;
  document.body.appendChild(overlay);
  els.overlay=overlay;els.gallery=overlay.querySelector('#lswGallery');els.count=overlay.querySelector('#lswCount');els.title=overlay.querySelector('#lswTitle');els.prev=overlay.querySelector('#lswPrev');els.next=overlay.querySelector('#lswNext');els.pager=overlay.querySelector('#lswPager');els.name=overlay.querySelector('#lswName');els.message=overlay.querySelector('#lswMessage');els.close=overlay.querySelector('#lswClose');
  const tabs=overlay.querySelector('#lswTabs');categories.forEach(([key,label])=>{const b=document.createElement('button');b.type='button';b.className='lsw-tab';b.textContent=label;b.dataset.section=key;b.onclick=()=>chooseSection(key);tabs.appendChild(b)});
  document.getElementById('lswOpenLocker').onclick=()=>open('edit');document.getElementById('lswOpenCard').onclick=()=>open('card');els.close.onclick=close;document.querySelectorAll('.nav-btn[data-tab="tab-profile"]').forEach(b=>b.addEventListener('click',()=>requestAnimationFrame(()=>{stage=fromStorage();renderCard()})));
  els.prev.onclick=()=>{if(page){page--;renderTiles();els.gallery.scrollTop=0}};els.next.onclick=()=>{page++;renderTiles();els.gallery.scrollTop=0};
  overlay.querySelector('#lswSave').onclick=save;overlay.querySelector('#lswReset').onclick=()=>{stage=fromStorage();els.name.value=stage.nickname;renderCard();renderTiles();setText(els.message,'Restored previously saved look')};
  els.name.addEventListener('input',()=>{stage.nickname=els.name.value.trim();renderCard()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close()});
  stage=fromStorage();renderCard();
  const oldNick=document.getElementById('profileNickname');if(oldNick)oldNick.addEventListener('change',()=>{const stored=fromStorage();stored.nickname=oldNick.value.trim().slice(0,18)||'Dancer';write(CARD_KEY,stored);stage=stored;renderCard()});
 }
 async function start(){try{const response=await fetch(ROOT+'catalog.json',{cache:'force-cache'});if(!response.ok)throw Error(response.status);catalogue=await response.json();init()}catch(e){console.warn('[Legacy WebApp UI W] Cosmetics not loaded:',e)}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
