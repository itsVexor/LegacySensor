(()=>{
'use strict';
const nav=document.getElementById('topNav');
const menu=document.getElementById('menuToggle');
const links=document.querySelectorAll('.site-nav .nav-item[data-section]');
const video=document.getElementById('heroVideo');
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const updateNav=()=>nav.classList.toggle('is-scrolled',window.scrollY>36);
window.addEventListener('scroll',updateNav,{passive:true});updateNav();
const closeMenu=()=>{menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open menu');document.getElementById('siteNavigation').classList.remove('is-open')};
menu.addEventListener('click',()=>{const expanded=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!expanded));menu.setAttribute('aria-label',expanded?'Open menu':'Close menu');document.getElementById('siteNavigation').classList.toggle('is-open',!expanded)});
document.querySelectorAll('.site-nav a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){closeMenu();const archive=document.getElementById('versionDropdown');if(archive)archive.open=false}});
if('IntersectionObserver' in window){
 const revealObserver=new IntersectionObserver(items=>{items.forEach(item=>{if(item.isIntersecting){item.target.classList.add('is-visible');revealObserver.unobserve(item.target)}})},{threshold:.06,rootMargin:'0px 0px -24px 0px'});
 document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));
 const sectionObserver=new IntersectionObserver(items=>{items.forEach(item=>{if(item.isIntersecting){links.forEach(a=>a.classList.toggle('current',a.dataset.section===item.target.id))}})},{rootMargin:'-30% 0px -60% 0px'});
 document.querySelectorAll('main section[id]').forEach(section=>sectionObserver.observe(section));
}else{document.querySelectorAll('.reveal').forEach(el=>el.classList.add('is-visible'))}
// Ambient movie is visual-only: it never has sound, controls or a click-to-play action.
if(video){
 video.muted=true;video.defaultMuted=true;video.volume=0;video.loop=true;
 const playSilent=()=>{if(document.hidden||reduceMotion.matches)return;video.muted=true;const p=video.play();if(p&&p.catch)p.catch(()=>{});};
 video.addEventListener('loadeddata',playSilent,{once:true});
 window.addEventListener('pageshow',playSilent);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();else playSilent()});
 reduceMotion.addEventListener?.('change',()=>{if(reduceMotion.matches)video.pause();else playSilent()});
 playSilent();
}
const archive=document.getElementById('versionDropdown');
if(archive){document.addEventListener('click',ev=>{if(archive.open&&!archive.contains(ev.target))archive.open=false});}
const year=document.getElementById('currentYear');if(year)year.textContent=String(new Date().getFullYear());

// Enlargable original in-app screenshots (no extra image generation).
const shotDlg=document.getElementById('shotDialog');const shotImg=document.getElementById('shotLarge');const shotLabel=document.getElementById('shotLabel');
if(shotDlg){
 document.querySelectorAll('.shot-expand').forEach(button=>button.addEventListener('click',()=>{
  shotImg.src=button.dataset.full;shotImg.alt=button.querySelector('img')?.alt||'App screenshot';shotLabel.textContent=button.dataset.title||'Legacy Sensor';shotDlg.showModal();
 }));
 document.getElementById('shotClose').addEventListener('click',()=>shotDlg.close());
 shotDlg.addEventListener('click',event=>{if(event.target===shotDlg)shotDlg.close()});
 shotDlg.addEventListener('close',()=>shotImg.removeAttribute('src'));
}
})();
