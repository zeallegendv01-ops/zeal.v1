(function(){
  const isIOS = /iP(hone|od|ad)/.test(navigator.platform) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
  const video = document.getElementById('heroVideo');
  const overlay = document.getElementById('heroPlayOverlay');
  const btn = document.getElementById('heroPlayBtn');
  if (!video) return;

  function ensureInlineAndMuted(){
    try{
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline','');
      video.setAttribute('webkit-playsinline','');
      video.setAttribute('muted','');
      video.setAttribute('preload','auto');
      video.loop = true;
      video.autoplay = true;
    } catch(e){}
  }

  function tryPlay(){
    ensureInlineAndMuted();
    const playPromise = video.play();
    if (playPromise !== undefined){
      playPromise.then(()=> {
        if (overlay) overlay.style.display='none';
      }).catch((err)=>{
        if (overlay) overlay.style.display='flex';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureInlineAndMuted();
    setTimeout(tryPlay, 300);
    video.addEventListener('loadedmetadata', tryPlay);
    video.addEventListener('play', ()=> { if (overlay) overlay.style.display='none'; });
    video.addEventListener('pause', ()=> { if (overlay) overlay.style.display='flex'; });

    if (overlay && btn){
      overlay.style.display='none';
      btn.addEventListener('click', function(){
        ensureInlineAndMuted();
        video.play().catch(()=>{});
        overlay.style.display='none';
      });
    }

    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'visible') tryPlay();
      else video.pause();
    });

    if (isIOS) {
      setTimeout(()=>{ if (video.paused && overlay) overlay.style.display='flex'; }, 800);
    }
  });
})();
