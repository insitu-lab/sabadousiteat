/* Um painel por vez; mantém os formulários e seus eventos no DOM. */
(()=>{
  const root=document.getElementById('admin'),dashboard=root?.querySelector('.admin-dashboard');
  if(!dashboard)return;
  const links=[...root.querySelectorAll('.admin-shortcuts a')],loading=root.querySelector('.admin-loading');
  const views=new Set(links.map(link=>link.hash.slice(1)));
  let selected='edf',frame=0;
  function refresh(){
    frame=0;
    // O histórico é criado pelo módulo comum, também usado no site oficial.
    const migrations=dashboard.querySelector('.click-migrations');
    if(migrations)migrations.id='admin-click-migrations';
    let found=false;
    dashboard.querySelectorAll('.admin-card,.ed,.podium-editor,.fanart-audit').forEach(card=>{
      const active=card.id===selected;
      card.hidden=!active;
      card.toggleAttribute('data-admin-active',active);
      if(active)found=true;
    });
    links.forEach(link=>{
      const active=link.hash.slice(1)===selected;
      link.classList.toggle('on',active);
      if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
    if(loading)loading.hidden=found;
  }
  function select(id){if(views.has(id))selected=id;refresh()}
  // Atualizações do Supabase recriam alguns cartões; a escolha permanece ativa.
  new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(refresh)})
    .observe(dashboard,{childList:true,subtree:true});
  root.querySelector('.admin-shortcuts').addEventListener('click',event=>{
    const link=event.target.closest('a');if(!link||!links.includes(link))return;
    if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();select(link.hash.slice(1));
    if(location.hash!==link.hash)location.hash=link.hash;
  });
  window.SabadouAdmin={select,handles:id=>views.has(id)};
  select(location.hash.slice(1));
})();
