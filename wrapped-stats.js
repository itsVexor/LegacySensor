
/* Legacy Sensor Wrapped stats — stored locally on this device */
(function(){
  const KEY='LS_WRAPPED_STATS_V1';
  const now=Date.now();
  let s;
  try{s=JSON.parse(localStorage.getItem(KEY)||'null')}catch(_){}
  if(!s||typeof s!=='object')s={visits:0,sessions:0,plays:0,activeSeconds:0,danceSeconds:0,firstSeen:now,lastSeen:0,lastSession:0,lastDay:'',days:[],bestSession:0};
  const day=new Date(now).toISOString().slice(0,10);
  s.visits=(s.visits||0)+1;
  if(!s.lastSession||now-s.lastSession>30*60*1000)s.sessions=(s.sessions||0)+1;
  s.lastSession=now;s.lastSeen=now;
  if(!s.firstSeen)s.firstSeen=now;
  if(!Array.isArray(s.days))s.days=[];
  if(!s.days.includes(day))s.days.push(day);
  s.days=s.days.slice(-366);
  function save(){try{localStorage.setItem(KEY,JSON.stringify(s))}catch(_){}}
  save();
  let last=Date.now();
  setInterval(function(){
    const t=Date.now(),dt=Math.max(0,Math.min(30,(t-last)/1000));last=t;
    if(document.visibilityState!=='visible')return;
    s.activeSeconds=(s.activeSeconds||0)+dt;
    let cameraOn=false;
    try{cameraOn=typeof stream!=='undefined'&&!!stream&&stream.getVideoTracks().some(x=>x.readyState==='live'&&x.enabled)}catch(_){}
    if(cameraOn){s.danceSeconds=(s.danceSeconds||0)+dt;s.estimatedKcalSeconds=(s.estimatedKcalSeconds||0)+(dt*5/60);s.estimatedKcal=Math.floor(s.estimatedKcalSeconds);s.bestSession=Math.max(s.bestSession||0,Math.min(3600,(s.danceSeconds||0)));}
    save();
  },10000);
  document.addEventListener('visibilitychange',save);
  window.LSWrappedStats={key:KEY,get:function(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return s}},save:save};
  /* Count an intentional camera start as a play started, without double-counting repeated taps. */
  document.addEventListener('click',function(e){
    const b=e.target&&e.target.closest&&e.target.closest('button');
    if(!b)return;
    const label=(b.innerText||b.textContent||'').trim().toLowerCase();
    if(label==='start camera'||label==='start dancing'||label==='play'){
      const stamp=Date.now();if(!s.lastPlay||stamp-s.lastPlay>60000){s.plays=(s.plays||0)+1;s.lastPlay=stamp;save();}
    }
  },true);
})();
