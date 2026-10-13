/* Troca a página aberta quando uma publicação completa fica disponível. */
(()=>{
  'use strict';
  const current=document.querySelector('meta[name="sabadou-build"]')?.content;
  const site=document.body?.dataset.site;
  if(!current||!site||!/^https?:$/.test(location.protocol))return;
  const manifestUrl=new URL('release.json',document.baseURI);
  let busy=false,leaving=false;
  async function fresh(url){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
    try{
      const response=await fetch(url,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error('Publicação ainda indisponível.');
      return await response.text();
    }finally{clearTimeout(timer)}
  }
  async function check(){
    if(busy||leaving||document.hidden||!navigator.onLine)return;
    busy=true;
    try{
      const requestUrl=new URL(manifestUrl);requestUrl.searchParams.set('_',Date.now());
      const release=JSON.parse(await fresh(requestUrl));
      if(release.schema!==1||release.site!==site||typeof release.build!=='string'||
         !/^[a-zA-Z0-9_-]{1,120}$/.test(release.build)||release.build===current)return;
      const key='sab_release_retry_'+site;
      try{
        const previous=JSON.parse(sessionStorage.getItem(key)||'null');
        if(previous?.build===release.build&&Date.now()-previous.at<60000)return;
      }catch{}
      const destination=new URL('index.html',manifestUrl);
      destination.search=location.search;destination.hash=location.hash;
      destination.searchParams.set('__sabadou_build',release.build);
      // O manifesto pode chegar antes do HTML no CDN. Só troca quando ambos
      // têm o mesmo identificador, evitando ciclos durante o upload.
      const html=await fresh(destination);
      const build=html.match(/<meta\s+name=["']sabadou-build["']\s+content=["']([^"']+)/i)?.[1];
      if(build!==release.build)return;
      try{sessionStorage.setItem(key,JSON.stringify({build:release.build,at:Date.now()}))}catch{}
      leaving=true;
      // O progresso confirmado está no servidor; pagehide preserva o cache.
      location.replace(destination.href);
    }catch{
      // Rede/CDN indisponível não apaga o progresso nem trava a navegação.
    }finally{busy=false}
  }
  window.SabadouRelease={check};
  check();setInterval(check,15000);
  for(const name of ['focus','online','pageshow'])addEventListener(name,check);
  document.addEventListener('visibilitychange',check);
})();
