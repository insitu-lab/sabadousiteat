/* Uma instância de autenticação para a página de manutenção. */
(()=>{
  let pending=null;
  function getClient(){
    if(pending)return pending;
    pending=(async()=>{
      const cfg=typeof SITE_CONFIG!=='undefined'?SITE_CONFIG:(window.SITE_CONFIG||{});
      if(!cfg.supabaseUrl||!cfg.supabaseKey)throw new Error('Login indisponível no momento.');
      if(!window.supabase)await new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        const timer=setTimeout(()=>reject(new Error('Não foi possível carregar o login. Tente novamente.')),15000);
        script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload=()=>{clearTimeout(timer);resolve()};
        script.onerror=()=>{clearTimeout(timer);reject(new Error('Não foi possível carregar o login. Confira sua conexão.'))};
        document.head.append(script);
      });
      return window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);
    })().catch(error=>{pending=null;throw error});
    return pending;
  }
  window.SabadouMaintenanceAuth={getClient};
  // O pacote da atualização não carrega a tela antecipada, mesmo sem ?site=.
  const packaged=document.documentElement.dataset.packageSite;
  if(packaged==='oficial'||(!packaged&&window.SabadouSiteLinks?.version==='oficial')){
    const script=document.createElement('script');
    script.src='js/sabadou-early-access.js?v=20261010-1-publicacao-20261009';
    document.head.append(script);
  }
})();
