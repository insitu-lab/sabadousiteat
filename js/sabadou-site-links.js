/* Mantém os links das páginas comuns na versão de site que as abriu. */
(()=>{
  const requested=new URLSearchParams(location.search).get('site');
  const version=(requested||document.documentElement.dataset.packageSite)==='atualizacao'?'atualizacao':'oficial';
  const entries={oficial:'index.html',atualizacao:'index.html'};
  const homeUrl=new URL(entries[version],document.baseURI);
  // A volta da manutenção deve buscar o HTML publicado, mesmo em aparelhos
  // que mantinham o index antigo em cache antes de receber o monitor de versão.
  if(/^https?:$/.test(location.protocol))homeUrl.searchParams.set('__sabadou_return',Date.now());
  const home=homeUrl.href;
  window.SabadouSiteLinks={home,version};
  function links(){
    document.querySelectorAll('a[href]').forEach(link=>{
      const raw=link.getAttribute('href');
      if(/^index\.html(?:[?#]|$)/.test(raw)){const destination=new URL(home);destination.hash=new URL(raw,document.baseURI).hash;link.href=destination.href;return}
      if(/^(?:privacy|termos|manutencao)\.html(?:[?#]|$)/.test(raw)){const destination=new URL(raw,document.baseURI);destination.searchParams.set('site',version);link.href=destination.href}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',links,{once:true});else links();
})();
