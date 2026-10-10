/* Compatibilidade com pacotes anteriores; preserva os IDs da navegação. */
(()=>{
  const tabs=[...document.querySelectorAll('.tabs a[role="tab"]')];
  function refresh(){tabs.forEach(tab=>{tab.tabIndex=tab.classList.contains('on')?0:-1})}
  tabs.forEach(tab=>{
    const id=tab.hash.slice(1),panel=document.getElementById(id);if(!tab.id)tab.id='tab-'+id;tab.setAttribute('aria-controls',id);
    if(panel){panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id)}
    tab.addEventListener('keydown',event=>{
      if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
      event.preventDefault();const available=tabs.filter(item=>!item.hidden),index=available.indexOf(tab);
      const next=event.key==='Home'?0:event.key==='End'?available.length-1:(index+(event.key==='ArrowRight'?1:-1)+available.length)%available.length;
      available[next].click();available[next].focus({preventScroll:true});
    });
  });
  refresh();addEventListener('hashchange',refresh);document.addEventListener('DOMContentLoaded',refresh,{once:true});
})();
