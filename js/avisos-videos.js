(()=>{
  'use strict';
  // A página volta aos avisos da mesma versão que a abriu.
  const home='index.html';
  document.querySelectorAll('[data-home],[data-back]').forEach(a=>a.href=home+'#avisos');
  document.querySelectorAll('[data-fanarts]').forEach(a=>a.href=home+'#fanarts');
  document.querySelectorAll('[data-game]').forEach(a=>a.href=home+'#sabadometro');
  const videos=[...document.querySelectorAll('.video-feature video')];
  document.querySelectorAll('.video-feature').forEach(card=>{
    const video=card.querySelector('video'),play=card.querySelector('[data-watch-video],#watch-video'),errorMessage=card.querySelector('.video-error');
    if(!video||!play)return;
    const showError=()=>{if(errorMessage)errorMessage.hidden=false};
    play.addEventListener('click',async()=>{
      if(!video.paused){video.pause();return}
      if(video.ended)video.currentTime=0;
      try{await video.play();video.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'})}
      catch(error){showError()}
    });
    const label=(symbol,value)=>{play.replaceChildren();const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.textContent=symbol;play.append(icon,' '+value)};
    video.addEventListener('play',()=>{
      videos.forEach(other=>{if(other!==video)other.pause()});
      label('Ⅱ','pausar vídeo');if(errorMessage)errorMessage.hidden=true;
    });
    video.addEventListener('pause',()=>label('▶',video.ended?'assistir de novo':'assistir ao aviso'));
    video.addEventListener('ended',()=>label('↺','assistir de novo'));
    video.addEventListener('error',showError);
    video.querySelector('source')?.addEventListener('error',showError);
  });
})();
