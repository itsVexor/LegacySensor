/* Legacy Sensor W5 - one PC-first profile, optional Firebase email binding.
 * Pure WebApp UI; never alters camera / tracking / pose / FPS / scoring.
 * Public ranking is READ-ONLY until a trusted cloud publisher is deployed.
 */
(()=>{'use strict';
const API_KEY='AIzaSyAE67NrHZnEW8Y-yZkOSB8LEr1Wh2VEB2s';
const FIREBASE={apiKey:API_KEY,authDomain:'legacy-sensor.firebaseapp.com',projectId:'legacy-sensor',appId:'1:189966351889:web:f9b3e72d4c70f86d29bbb0'};
const $=(id)=>document.getElementById(id);
const toNum=(x)=>{const v=Number(x);return Number.isFinite(v)?Math.max(0,Math.floor(v)):0};
const fmt=(x)=>toNum(x).toLocaleString();
const linked=()=>!!window.LegacyW4?.usePC?.();
const current=()=>window.LegacyW4?.getProfile?.()||null;
const key=()=>{try{const k=sessionStorage.getItem('ls_w3_pairing_key')||'';return /^[a-f0-9]{64}$/.test(k)?k:''}catch(_){return ''}};
let wasLinked=false, lastSignature='', fbPromise=null, firebaseAuth=null, authUser=null, loadingBoard=false;
window.LegacyW5={isLinked:linked,openBoard:showBoard};

function node(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=String(txt);return e}
function message(id,text){const e=$(id);if(e)e.textContent=text}
function badge(label,value){const item=node('div','lsw5-value');item.append(node('b','',value),node('small','',label));return item}
function safeNormalize(s){return String(s||'').split(/[\\/]/).pop().replace(/\.(png|jpe?g|webp)$/i,'').replace(/(?:_p\d+)?_?(?:ava|avatar)$/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase()}
let catalog=null;
async function loadCatalog(){if(catalog)return catalog;try{const r=await fetch('lsw2_assets/catalog.json',{cache:'force-cache'});if(r.ok)catalog=await r.json()}catch(_){}return catalog}
async function decoratePortrait(p){const img=$('lsw5Portrait');if(!img||!p||!linked())return;
 const cat=await loadCatalog();if(!cat||!linked())return;
 const needle=safeNormalize(p.selectedAvatarAsset);if(!needle||needle.length<4)return;
 const matches=[...(cat.avatars||[]),...(cat.styles||[])];
 const exact=matches.find(x=>safeNormalize(x.id)===needle);
 const fuzzy=matches.find(x=>safeNormalize(x.id).startsWith(needle)&&needle.length>=7);
 const chosen=exact||fuzzy;if(chosen?.thumb){img.src='lsw2_assets/'+chosen.thumb;img.alt='Current PC avatar';}
}
function buildProfile(){if($('lsw5Identity')||!$('tab-profile'))return;
 const hero=node('section','lsw5-identity');hero.id='lsw5Identity';
 const left=node('div','lsw5-hero-left');const img=node('img','lsw5-portrait');img.id='lsw5Portrait';img.src='assets/icons/webapp-icon-180.png';img.alt='PC profile';
 const title=node('div','');title.append(node('small','lsw5-kicker','✦ LEGACY ACCOUNT · WINDOWS + WEBAPP'),node('h3','lsw5-name','PC profile'),node('p','lsw5-sub','One level · One XP balance · One collection'));
 left.append(img,title);
 const numbers=node('div','lsw5-numbers');numbers.id='lsw5Numbers';
 const footer=node('div','lsw5-foot');footer.append(node('span','','Your existing phone save is kept as a backup and is not mixed into PC progress.'));
 const signIn=node('button','lsw5-soft','Online account / leaderboard');signIn.type='button';signIn.onclick=()=>{$('profileSeg')?.querySelector('[data-pview="board"]')?.click()};footer.append(signIn);
 hero.append(left,numbers,footer);
 $('profileCardView')?.prepend(hero);
 const css=document.createElement('link');css.rel='stylesheet';css.href='lsw5_assets/single_account.css?v=5';document.head.append(css);
}
function buildBoard(){if($('lsw5VerifiedBoard')||!$('profileBoardView'))return;
 const panel=node('section','lsw5-verified-panel');panel.id='lsw5VerifiedBoard';
 const head=node('h3','','Legacy Leaderboard');
 const intro=node('p','lsw5-notice','One Firebase account across PC and WebApp. The classic phone-only leaderboard is disabled when linked to Windows.');
 const auth=node('div','lsw5-auth');auth.id='lsw5Auth';
 const state=node('p','lsw5-status','Sign in with a verified email to link your Windows profile.');state.id='lsw5AuthStatus';
 const email=node('input','lsw5-input');email.id='lsw5Email';email.type='email';email.autocomplete='email';email.placeholder='Email';email.setAttribute('aria-label','Email');
 const pw=node('input','lsw5-input');pw.id='lsw5Password';pw.type='password';pw.autocomplete='current-password';pw.placeholder='Password';pw.setAttribute('aria-label','Password');
 const buttons=node('div','lsw5-auth-buttons');
 for(const [id,name] of [['lsw5Login','Log in'],['lsw5Register','Register'],['lsw5Resend','Send verification'],['lsw5Check','Check verification'],['lsw5SignOut','Log out'],['lsw5UnlinkOnline','Unlink online account']]){
  const b=node('button','lsw5-action',name);b.id=id;b.type='button';buttons.append(b)
 }
 auth.append(state,email,pw,buttons);
 const boardStatus=node('p','lsw5-board-status','Global leaderboard is available after verified Firebase login and deployment of server-side ranking.');boardStatus.id='lsw5BoardStatus';
 const board=node('div','lsw5-leaderboard');board.id='lsw5Leaderboard';
 const refresh=node('button','lsw5-soft','Refresh ranking');refresh.id='lsw5Reload';refresh.type='button';refresh.onclick=()=>readBoard();
 const safety=node('p','lsw5-small','PC scores are not uploaded by the phone. Rank publishing is disabled until a trusted server is configured, so phone-only XP cannot become PC XP.');
 panel.append(head,intro,auth,refresh,boardStatus,board,safety);
 $('profileBoardView').prepend(panel);
 $('lsw5Login').onclick=()=>doAuth('login');$('lsw5Register').onclick=()=>doAuth('register');
 $('lsw5Resend').onclick=resendVerification;$('lsw5Check').onclick=checkVerification;$('lsw5SignOut').onclick=signOut;$('lsw5UnlinkOnline').onclick=unlinkOnline;
}
function addModeNotes(){
 for(const [tab,id,msg] of [
  ['tab-gift','lsw5GiftNote','Your PC Gift Machine is the source of coins and rewards. Spins on the phone are paused while using the Windows profile, to prevent duplicate spending.'],
  ['tab-home','lsw5HomeNote','PC challenges and XP are the source of progress. Phone-only rewards are paused while linked. Your old phone save is safe.']]){
   const e=$(tab);if(!e||$(id))continue;const note=node('section','lsw5-hold-note',msg);note.id=id;e.querySelector('.top')?.after(note);
  }
}
function refreshView(){const active=linked();const p=current();
 document.body.classList.toggle('lsw5-pc-linked',active);
 if(active&&p){
  const id=$('lsw5Identity');if(id)id.hidden=false;
  const name=id?.querySelector('.lsw5-name');if(name)name.textContent=p.nickname||'Dancer';
  const grid=$('lsw5Numbers');if(grid){const signature=[p.level,p.xp,p.legacyCoins,p.sessions,p.nickname].join('|');if(signature!==lastSignature){grid.replaceChildren(badge('PC LEVEL',fmt(p.level)),badge('PC XP',fmt(p.xp)),badge('LEGACY COINS',fmt(p.legacyCoins)),badge('SESSIONS',fmt(p.sessions)));lastSignature=signature;decoratePortrait(p)}}
  message('lsw4BoardNote','');
  // Prevent the user from interpreting the phone's *local* coin counters as PC money.
  if($('coinBalance'))$('coinBalance').textContent=fmt(p.legacyCoins);
  if($('coinBalanceHome'))$('coinBalanceHome').textContent=fmt(p.legacyCoins);
 }
 if(active!==wasLinked){
  wasLinked=active;if(!active)lastSignature='';
  if(!active){const id=$('lsw5Identity');if(id)id.hidden=true;}
  if(active && !$('profileBoardView')?.hidden)showBoard();
 }
}
function showBoard(){if(!linked())return;
 const oldJoin=$('lbJoin'),oldBoard=$('lbBoard');if(oldJoin)oldJoin.hidden=true;if(oldBoard)oldBoard.hidden=true;
 const n=$('lsw5VerifiedBoard');if(n)n.hidden=false;
 refreshView();
 if(authUser?.emailVerified)readBoard();
}

async function firebase(){if(fbPromise)return fbPromise;
 fbPromise=(async()=>{
  const base='https://www.gstatic.com/firebasejs/10.14.1/';
  const [appMod,authMod,fsMod]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
  const app=appMod.getApps().length?appMod.getApp():appMod.initializeApp(FIREBASE);
  const auth=authMod.getAuth(app);firebaseAuth=auth;
  authMod.onAuthStateChanged(auth,(u)=>{authUser=u;authStatus();if(u?.emailVerified&&linked())linkPC().catch(()=>{})});
  return {auth,authMod,fsMod,app};
 })();fbPromise.catch(()=>{fbPromise=null});return fbPromise;
}
function authStatus(){
 const valid=!!authUser?.emailVerified;
 message('lsw5AuthStatus',!authUser?'Sign in to your Legacy Account. Your phone-only save will not be deleted.'
   :!valid?'Email not verified. Open the confirmation message, then tap Check verification.'
   :'✓ Signed in with verified email · '+String(authUser.email||''));
 const logged=!!authUser;
 for(const id of ['lsw5Email','lsw5Password','lsw5Login','lsw5Register'])if($(id))$(id).hidden=logged;
 for(const id of ['lsw5SignOut','lsw5Check','lsw5Resend','lsw5UnlinkOnline'])if($(id))$(id).hidden=!logged;
 if($('lsw5Resend'))$('lsw5Resend').hidden=!logged||valid;
 if($('lsw5Check'))$('lsw5Check').hidden=!logged||valid;
}
async function doAuth(mode){
 const email=String($('lsw5Email')?.value||'').trim();const password=String($('lsw5Password')?.value||'');
 if(!email.includes('@')||password.length<6){message('lsw5AuthStatus','Enter an email and a password of at least 6 characters.');return}
 message('lsw5AuthStatus','Connecting securely to Firebase…');
 try{const f=await firebase();
  const credential=mode==='register'?await f.authMod.createUserWithEmailAndPassword(f.auth,email,password):await f.authMod.signInWithEmailAndPassword(f.auth,email,password);
  // Don't keep a copy of the password in a JS variable or localStorage.
  if(mode==='register')await f.authMod.sendEmailVerification(credential.user);
  await f.authMod.reload(credential.user);
  authUser=f.auth.currentUser;authStatus();
  if(authUser?.emailVerified)await linkPC();
 }catch(e){message('lsw5AuthStatus',String(e?.code||'Firebase login failed')+' · Check Firebase Email/Password settings or your connection.');}
 finally{if($('lsw5Password'))$('lsw5Password').value=''}
}
async function resendVerification(){try{const f=await firebase();if(f.auth.currentUser)await f.authMod.sendEmailVerification(f.auth.currentUser);message('lsw5AuthStatus','Verification email sent. Check your inbox.')}catch(e){message('lsw5AuthStatus','Could not send email: '+(e?.code||'network error'))}}
async function checkVerification(){try{const f=await firebase();if(!f.auth.currentUser)return;await f.authMod.reload(f.auth.currentUser);await f.auth.currentUser.getIdToken(true);authUser=f.auth.currentUser;authStatus();if(authUser.emailVerified)await linkPC()}catch(e){message('lsw5AuthStatus','Could not check verification: '+(e?.code||'network error'))}}
async function linkPC(){if(!authUser?.emailVerified||!linked())return;
 const k=key();if(!k){message('lsw5AuthStatus','Scan a fresh QR from Legacy Sensor before linking your PC.');return}
 try{
  const token=await authUser.getIdToken(true);
  const resp=await fetch('/ls-profile/v3/link?lsSyncKey='+encodeURIComponent(k),{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer',body:JSON.stringify({idToken:token})});
  const out=await resp.json();if(!resp.ok||!out.ok)throw Error(out.error||'Could not link Windows');
  message('lsw5AuthStatus','✓ Verified account linked to Windows: '+out.email+' · cloud XP sync not enabled yet.');
 }catch(e){message('lsw5AuthStatus','Firebase signed in, but PC link failed: '+String(e?.message||e))}
}
async function unlinkOnline(){
 if(!linked()||!key())return;
 if(!confirm('Unlink this Firebase identity from the Windows PC? Your XP, coins and phone backup will remain untouched.'))return;
 try{const r=await fetch('/ls-profile/v3/unlink?lsSyncKey='+encodeURIComponent(key()),{
    method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:'{}',referrerPolicy:'no-referrer'});
   if(!r.ok)throw Error('PC refused unlink');
   message('lsw5AuthStatus','Online account disconnected from Windows. PC profile and XP are safe.');
 }catch(e){message('lsw5AuthStatus','Could not unlink: '+String(e.message||e))}
}
async function signOut(){try{const f=await firebase();await f.authMod.signOut(f.auth);authUser=null;authStatus()}catch(e){message('lsw5AuthStatus','Log out failed: '+(e?.code||'network error'))}}
async function mirrorBoardToPC(rows){
 if(!linked()||!authUser?.emailVerified||!key())return;
 try{
  const r=await fetch('/ls-profile/v3/board-preview?lsSyncKey='+encodeURIComponent(key()),{
   method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
   cache:'no-store',referrerPolicy:'no-referrer',body:JSON.stringify({uid:authUser.uid,rows:rows.slice(0,50)})});
  if(!r.ok){console.info('[W5] Windows ranking preview not updated: '+r.status)}
 }catch(_){/* no impact on WebApp leaderboard or sensor */}
}
async function readBoard(){if(!linked()||loadingBoard)return;loadingBoard=true;message('lsw5BoardStatus','Loading verified leaderboard…');
 try{const f=await firebase();if(!f.auth.currentUser){message('lsw5BoardStatus','Sign in to see the leaderboard.');return}
  await f.authMod.reload(f.auth.currentUser);if(!f.auth.currentUser.emailVerified){message('lsw5BoardStatus','Verify your email to view the leaderboard.');return}
  // READ ONLY. Firestore rules must deny all client writes to leaderboardVerified.
  const db=f.fsMod.getFirestore(f.app);
  const q=f.fsMod.query(f.fsMod.collection(db,'leaderboardVerified'),f.fsMod.orderBy('xp','desc'),f.fsMod.limit(50));
  const snap=await f.fsMod.getDocs(q);const host=$('lsw5Leaderboard');if(host)host.replaceChildren();let rank=0;
  const rows=[];snap.forEach(doc=>{const x=doc.data();if(!x||typeof x.nickname!=='string')return;rank++;
   rows.push({nickname:x.nickname.slice(0,30),xp:toNum(x.xp),level:Math.max(1,toNum(x.level))});
   const row=node('div','lsw5-board-row');row.append(node('b','',String(rank)),node('span','',x.nickname.slice(0,30)),node('em','',fmt(x.xp)+' XP · LVL '+fmt(x.level)));
   host?.append(row);
  });
  await mirrorBoardToPC(rows);
  message('lsw5BoardStatus',rank?rank+' published verified accounts · read-only in W5 · mirrored to PC preview':'No verified scores published yet. PC XP is not uploaded until the trusted server is deployed.');
 }catch(e){message('lsw5BoardStatus','Verified ranking unavailable: '+(e?.code||'Check Firestore rules and network'));}
 finally{loadingBoard=false}
}
function interceptOfflineRewards(e){if(!linked())return;
 const target=e.target?.closest?.('#gmKnob,[data-claim],#profileAvatarEdit,#lswSave');if(!target)return;
 e.preventDefault();e.stopImmediatePropagation();
 const note='PC profile is active. Use Windows for spending rewards; the phone-only wallet is paused.';
 if(target.id==='lswSave')message('lswMessage','PC linked — phone look is preview-only until shared cosmetics sync is enabled.');
 else if(typeof window.lsToast==='function')window.lsToast({title:'PC profile active',msg:note,icon:'✦',ms:3600});
}
function init(){buildProfile();buildBoard();addModeNotes();document.addEventListener('click',interceptOfflineRewards,true);refreshView();
 // UI-only reconciliation; does not touch the video/pose/tracking frame loop.
 setInterval(()=>{if(!document.hidden)refreshView()},2600);
 document.querySelectorAll('.nav-btn[data-tab="tab-profile"]').forEach(e=>e.addEventListener('click',()=>setTimeout(refreshView,110)));
 $('lsw5VerifiedBoard').hidden=true;
 authStatus();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
