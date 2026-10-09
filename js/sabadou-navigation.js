/* Acesso por teclado e sugestões de exploração sem trocar as abas existentes. */
(()=>{
  const tabs=[...document.querySelectorAll('.tabs a[role="tab"]')];
  function refresh(){tabs.forEach(tab=>{tab.tabIndex=tab.classList.contains('on')?0:-1})}
  tabs.forEach(tab=>{
    const id=tab.hash.slice(1),panel=document.getElementById(id);tab.id='tab-'+id;tab.setAttribute('aria-controls',id);
    if(panel){panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id)}
    tab.addEventListener('keydown',event=>{
      if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
      event.preventDefault();const available=tabs.filter(item=>!item.hidden),index=available.indexOf(tab);
      const next=event.key==='Home'?0:event.key==='End'?available.length-1:(index+(event.key==='ArrowRight'?1:-1)+available.length)%available.length;
      available[next].click();available[next].focus({preventScroll:true});
    });
  });
  const suggestions={avisos:[['jogos','jogar um pouco'],['inicio','voltar ao início']],musica:[['galeria','ver a galeria'],['inicio','voltar ao início']],galeria:[['calabresos','área dos calabresos'],['inicio','voltar ao início']],jogos:[['musica','ouvir a música'],['inicio','voltar ao início']],fanarts:[['galeria','ver a galeria'],['inicio','voltar ao início']],calabresos:[['jogos','abrir jogos'],['inicio','voltar ao início']]};
  for(const [id,links] of Object.entries(suggestions)){
    const panel=document.getElementById(id);if(!panel)continue;
    const wrap=document.createElement('div');wrap.className='wrap';const box=document.createElement('aside');box.className='section-explore';
    const label=document.createElement('b');label.textContent='Continue pelo Sabadou';const nav=document.createElement('nav');nav.setAttribute('aria-label','Explorar outras seções');
    links.forEach(([destination,text])=>{const anchor=document.createElement('a');anchor.className='cta ghost sm';anchor.href='#'+destination;anchor.textContent=text;nav.append(anchor)});
    box.append(label,nav);wrap.append(box);panel.append(wrap);
  }
  refresh();addEventListener('hashchange',refresh);document.addEventListener('DOMContentLoaded',refresh,{once:true});
})();
