/* Last videos on my channel
   Wklej ID filmow z YouTube (to, co po v= w linku) - najnowszy na gorze.
   Np. https://www.youtube.com/watch?v=dQw4w9WgXcQ  ->  id: "dQw4w9WgXcQ" */
(function(){
  const CHANNEL_URL = "https://www.youtube.com/@TheJDVexor";
  const VIDEOS = [
    { id: "lmDUQa-YM3g", title: "Latest video from ItsVexor" },
    // { id: "WKLEJ_ID_FILMU", title: "Legacy Sensor 1.6.0 Beta Is Out!" },
    // { id: "WKLEJ_ID_FILMU_2", title: "Dance Without Kinect" },
  ];

  const player = document.getElementById("videoPlayer");
  const list = document.getElementById("videoList");
  if (!player || !list) return;
  const thumb = id => "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";

  function showPoster(v){
    player.innerHTML = "";
    const b = document.createElement("button");
    b.className = "video-poster"; b.type = "button";
    b.setAttribute("aria-label", "Play: " + (v.title || "video"));
    b.style.backgroundImage = "url(" + thumb(v.id) + ")";
    b.innerHTML = '<span class="video-play" aria-hidden="true">&#9654;</span>';
    b.addEventListener("click", () => play(v));
    player.appendChild(b);
  }
  function play(v){
    player.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.id) +
      '?autoplay=1&rel=0" title="' + (v.title || "YouTube video").replace(/"/g, "&quot;") +
      '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>';
  }
  function setLink(v){
    let f = document.getElementById("videoFallback");
    if (!f){ f = document.createElement("p"); f.id = "videoFallback"; f.className = "video-fallback"; list.closest(".videos-layout").after(f); }
    f.innerHTML = 'Video not loading? <a href="https://www.youtube.com/watch?v=' + encodeURIComponent(v.id) + '" target="_blank" rel="noopener noreferrer">Watch it on YouTube</a>.';
  }
  function setActive(i){
    [...list.children].forEach((el, k) => el.classList.toggle("active", k === i));
  }

  if (!VIDEOS.length){
    player.innerHTML = '<div class="video-empty"><strong>Videos coming soon</strong><p>Check out the newest uploads on my channel.</p>' +
      '<a class="button button-primary" href="' + CHANNEL_URL + '" target="_blank" rel="noopener noreferrer">Visit YouTube channel</a></div>';
    return;
  }

  VIDEOS.forEach((v, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "video-item";
    const img = document.createElement("img");
    img.src = thumb(v.id); img.alt = ""; img.loading = "lazy";
    const t = document.createElement("span");
    t.textContent = v.title || "Watch on YouTube";
    b.append(img, t);
    b.addEventListener("click", () => { setActive(i); play(v); setLink(v); });
    list.appendChild(b);
  });
  setActive(0);
  showPoster(VIDEOS[0]);
  setLink(VIDEOS[0]);
})();
