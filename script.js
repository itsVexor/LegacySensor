const shots = [
  {src:'assets/screenshots/settings-v1.4.0.webp', title:'Settings & player controls', text:'Choose camera FPS, camera orientation, audio levels and one-player or experimental two-player tracking.'},
  {src:'assets/screenshots/camera-v1.4.0.webp', title:'Camera Test', text:'Check your framing and camera source before starting Legacy Sensor.'},
  {src:'assets/screenshots/tracking-v1.4.0.webp', title:'Tracking Diagnostics', text:'Review setup tips, active tracking options and live sensor status.'},
  {src:'assets/screenshots/photo-booth-v1.4.0.webp', title:'Photo Booth', text:'Use your camera, add Coach and avatar stickers, then save your finished photo.'},
  {src:'assets/screenshots/player-card-v1.4.0.webp', title:'Player Card', text:'See your level, XP, sessions, dance time, confidence, background and equipped stickers.'},
  {src:'assets/screenshots/customize-avatars-v1.4.0.webp', title:'Avatar customization', text:'Choose from unlocked avatars and build your Legacy Sensor Player Card look.'},
  {src:'assets/screenshots/customize-backgrounds-v1.4.0.webp', title:'Background customization', text:'Unlock and equip Player Card backgrounds, including exclusive Gift Machine rewards.'},
  {src:'assets/screenshots/customize-titles-stickers-v1.4.0.webp', title:'Titles & Player Card stickers', text:'Equip unlockable titles and choose separate Top Right and Bottom Left sticker slots.'},
  {src:'assets/screenshots/challenges-v1.4.0.webp', title:'Daily Coin Challenges', text:'Complete refreshed daily tasks to earn Legacy Coins and keep progressing.'},
  {src:'assets/screenshots/gift-machine-v1.4.0.webp', title:'Legacy Gift Machine', text:'Spend Legacy Coins, open capsules and unlock new Player Card rewards.'},
  {src:'assets/screenshots/collection-book-v1.4.0.webp', title:'Collection Book', text:'Track avatars, backgrounds, titles and stickers, see locked rewards and complete your collection.'},
  {src:'assets/screenshots/results-v1.4.0.webp', title:'Session Results', text:'Review tracking time, confidence, tracking losses, frames tracked, XP and Legacy Coins earned.'},
  {src:'assets/screenshots/about-guide-v1.4.0.webp', title:'Built-in setup guide', text:'Follow the in-app steps to install the matching DLL, open the sensor and start dancing.'},
  {src:'assets/screenshots/about-performance-v1.4.0.webp', title:'Performance & important notes', text:'See the recommended Windows process priority and the most important setup notes inside the app.'}
];
let index = 0;
const image = document.querySelector('#mainShot');
const title = document.querySelector('#shotTitle');
const text = document.querySelector('#shotText');
const counter = document.querySelector('#shotIndex');
const thumbs = document.querySelector('#thumbs');
function renderThumbs(){
  thumbs.innerHTML='';
  shots.forEach((s,i)=>{
    const b=document.createElement('button'); b.className='thumb'+(i===index?' active':''); b.setAttribute('aria-label',`Show ${s.title}`);
    b.innerHTML=`<img src="${s.src}" alt="" loading="lazy" decoding="async">`; b.onclick=()=>{index=i;renderShot()}; thumbs.appendChild(b);
  });
}
function renderShot(){
  const s=shots[index]; image.src=s.src; title.textContent=s.title; text.textContent=s.text; counter.textContent=String(index+1).padStart(2,'0')+' / '+String(shots.length).padStart(2,'0'); renderThumbs();
}
document.querySelector('#prevShot').onclick=()=>{index=(index-1+shots.length)%shots.length;renderShot()};
document.querySelector('#nextShot').onclick=()=>{index=(index+1)%shots.length;renderShot()};
renderShot();

const navLinks=[...document.querySelectorAll('.nav a')];
const sections=[...document.querySelectorAll('main section[id]')];
if ('IntersectionObserver' in window) {
  const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){navLinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id));}})},{rootMargin:'-35% 0px -55% 0px'});
  sections.forEach(s=>observer.observe(s));
}


// Gentle reveal-on-scroll polish. Disabled automatically for reduced-motion users.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduceMotion && 'IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -7% 0px' });
  document.querySelectorAll('.reveal-section').forEach(el => revealObserver.observe(el));

  // Cards inside grids cascade in one-by-one instead of all fading together.
  const staggerObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const cards = [...entry.target.children];
        cards.forEach((card, i) => {
          card.style.transitionDelay = (i * 70) + 'ms';
          card.classList.add('is-visible');
        });
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -7% 0px' });
  document.querySelectorAll('.feature-grid, .how-grid, .gameplay-grid, .community-grid').forEach(grid => {
    [...grid.children].forEach(card => card.classList.add('stagger-card'));
    staggerObserver.observe(grid);
  });
} else {
  document.querySelectorAll('.reveal-section, .feature-grid, .how-grid, .gameplay-grid, .community-grid').forEach(el => el.classList.add('is-visible'));
}

// Keep the page lightweight on mobile Safari. The startup video only begins
// when it is close to the viewport instead of competing with the first render.
const startupVideo = document.querySelector('.startup-video');
if (startupVideo) {
  const canAutoPlay = window.matchMedia('(min-width: 721px)').matches && !reduceMotion;
  if (canAutoPlay && 'IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          startupVideo.preload = 'metadata';
          startupVideo.play().catch(() => {});
        } else {
          startupVideo.pause();
        }
      });
    }, { rootMargin: '200px 0px' });
    videoObserver.observe(startupVideo);
  }
}
