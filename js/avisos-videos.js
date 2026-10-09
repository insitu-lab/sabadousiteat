(()=>{
  'use strict';
  // Aceita somente as duas versões locais conhecidas para os links de retorno.
  const official=new URLSearchParams(location.search).get('origem')==='oficial';
  const home=official?'index siteoficial.html':'index.html';
  document.querySelectorAll('[data-home],[data-back]').forEach(a=>a.href=home+'#avisos');
  document.querySelectorAll('[data-fanarts]').forEach(a=>a.href=home+'#fanarts');
  const video=document.getElementById('notice-video'),play=document.getElementById('watch-video');
  play.addEventListener('click',async()=>{
    if(!video.paused){video.pause();return}
    if(video.ended)video.currentTime=0;
    try{await video.play();video.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'})}
    catch(error){document.getElementById('video-error').hidden=false}
  });
  const label=(symbol,value)=>{play.replaceChildren();const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.textContent=symbol;play.append(icon,' '+value)};
  video.addEventListener('play',()=>{label('Ⅱ','pausar vídeo');document.getElementById('video-error').hidden=true});
  video.addEventListener('pause',()=>label('▶',video.ended?'assistir de novo':'assistir ao aviso'));
  video.addEventListener('ended',()=>label('↺','assistir de novo'));
  video.addEventListener('error',()=>document.getElementById('video-error').hidden=false);
  video.querySelector('source').addEventListener('error',()=>document.getElementById('video-error').hidden=false);
})();
