const shots = [
  {"src": "assets/screenshots/settings-quick-preset.webp", "title": "Quick Preset", "text": "Choose Recommended, Low-End PC or Stable Scoring presets in Settings."},
  {"src": "assets/screenshots/settings-audio-players.webp", "title": "Audio & Players", "text": "New audio toggles, volume slider, player settings and motion controls."},
  {"src": "assets/screenshots/settings-scoring.webp", "title": "Scoring & Calibration", "text": "See stability, flexible calibration and sensor preview settings."},
  {"src": "assets/screenshots/settings-seasonal.webp", "title": "Appearance & Seasons", "text": "Control seasonal themes, animated decorations and music effects."},
  {"src": "assets/screenshots/camera-preview.webp", "title": "Camera Preview", "text": "Check your selected webcam and preview framing before dancing."},
  {"src": "assets/screenshots/tracking-setup.webp", "title": "Tracking Setup", "text": "Review calibration guidance and live sensor status in the refreshed UI."},
  {"src": "assets/screenshots/webapp-qr-privacy.webp", "title": "WebApp & QR Pairing", "text": "Pair iOS or Android on the same Wi-Fi. QR code and local address hidden for privacy."},
  {"src": "assets/screenshots/party-master.webp", "title": "Party Master", "text": "Host a local party and choose bot difficulty for up to five dancing rivals."},
  {"src": "assets/screenshots/photo-booth.webp", "title": "Photo Booth", "text": "Capture photos and decorate your camera image with stickers."},
  {"src": "assets/screenshots/player-card.webp", "title": "Player Card", "text": "A redesigned dancer identity with level, XP and your saved look."},
  {"src": "assets/screenshots/locker-room.webp", "title": "Locker Room", "text": "Customize your avatars, borders, backgrounds, aliases and effects."},
  {"src": "assets/screenshots/challenges.webp", "title": "Challenges", "text": "Explore your reward journey, XP and unlockable rewards."},
  {"src": "assets/screenshots/quiz-welcome.webp", "title": "Quiz Time — Welcome", "text": "The new mouse-only offline Fast Sorting mini-game."},
  {"src": "assets/screenshots/quiz-difficulty.webp", "title": "Quiz Time — Difficulty", "text": "Select Easy, Medium or Hard before the quiz begins."},
  {"src": "assets/screenshots/quiz-playing.webp", "title": "Quiz Time — Playing", "text": "Sort items into the correct decade with a colorful new game screen."},
  {"src": "assets/screenshots/gift-machine.webp", "title": "Gift Machine", "text": "Use Legacy Coins to unlock new customization rewards."},
  {"src": "assets/screenshots/collection-book.webp", "title": "Collection Book", "text": "Browse unlocked avatars, backgrounds, stickers and titles."},
  {"src": "assets/screenshots/session-results.webp", "title": "Session Results", "text": "See tracking performance, XP and your current dancer look."},
  {"src": "assets/screenshots/about-guide.webp", "title": "About — Getting Started", "text": "Setup guidance and compatibility notes inside the application."},
  {"src": "assets/screenshots/about-performance.webp", "title": "About — Performance", "text": "Performance recommendations and important setup information."}
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
    const b=document.createElement('button'); b.className='thumb'+(i===index?' active':''); b.setAttribute('aria-label',`Show ${s.title}`); b.setAttribute('aria-pressed',String(i===index)); b.title=s.title;
    b.innerHTML=`<img src="${s.src}" alt="" loading="lazy" decoding="async">`; b.onclick=()=>{index=i;renderShot()}; thumbs.appendChild(b);
  });
}
function renderShot(){
  const s=shots[index]; image.src=s.src; title.textContent=s.title; text.textContent=s.text; image.alt=s.title+" — Legacy Sensor v1.7.0 Beta"; counter.textContent=String(index+1).padStart(2,'0')+' / '+String(shots.length).padStart(2,'0'); renderThumbs();
}
document.querySelector('#prevShot').onclick=()=>{index=(index-1+shots.length)%shots.length;renderShot()};
document.querySelector('#nextShot').onclick=()=>{index=(index+1)%shots.length;renderShot()};
renderShot();

const navLinks=[...document.querySelectorAll('.nav a, .mobile-dock a')];
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
