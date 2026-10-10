/* Classificação pública e controle de posições exclusivo do admin. */
(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let editor=null;
  async function rank(client,arts){
    let data=null,error=null;
    try{const result=await client.rpc('fanart_ranking_semanal');data=result.data;error=result.error}catch(e){error=e}
    const fallback=new Date();fallback.setHours(0,0,0,0);fallback.setDate(fallback.getDate()-fallback.getDay());
    const start=data?.start?new Date(data.start):fallback,end=data?.end?new Date(data.end):null;
    const ranked=arts.filter(a=>new Date(a.criado_em)>=start&&(!end||new Date(a.criado_em)<end))
      .sort((a,b)=>Number(b.votos||0)-Number(a.votos||0)||String(a.criado_em).localeCompare(String(b.criado_em))||String(a.id).localeCompare(String(b.id)));
    const positions=new Map((data?.order||[]).map((id,i)=>[id,i]));
    if(positions.size)ranked.sort((a,b)=>(positions.get(a.id)??Infinity)-(positions.get(b.id)??Infinity));
    return {arts:ranked,config:data,error};
  }
  function clear(parent){editor?.controller.abort();editor=null;parent.replaceChildren()}
  function mount({client,parent,ranking,image,onSaved}){
    if(editor?.parent===parent&&(editor.dirty||editor.busy)&&editor.week===ranking.config?.week)return;
    clear(parent);
    const section=document.createElement('section');section.className='podium-editor pn';parent.append(section);
    section.innerHTML='<h3>ordem do pódio</h3><p>Arraste pelo símbolo ↕ ou escolha a posição de cada fanart. Os votos são preservados. A ordem vale para esta semana.</p><p class="podium-editor-mode"></p><div class="podium-editor-list"></div><div class="edb"><button class="cta sm" type="button" data-save-order>salvar ordem</button><button class="cta ghost sm" type="button" data-auto-order>voltar à ordem por votos</button><button class="mini" type="button" data-discard-order>descartar alterações</button></div><p class="hint" role="status" aria-live="polite"></p>';
    const state={parent,week:ranking.config?.week,arts:[...ranking.arts],dirty:false,busy:false,drag:null,controller:new AbortController()};editor=state;
    const list=section.querySelector('.podium-editor-list'),notice=section.querySelector('[role="status"]'),signal=state.controller.signal;
    section.querySelector('.podium-editor-mode').textContent=ranking.config?.manual?'Ordem manual ativa':'Classificação automática por votos';
    function draw(){
      list.innerHTML=state.arts.map((art,index)=>`<div class="podium-editor-row${state.drag?.id===art.id?' dragging':''}" data-art-id="${esc(art.id)}"><button type="button" class="podium-grip mini" data-grip aria-label="Arrastar fanart de @${esc(art.handle)}" ${state.busy?'disabled':''}>↕</button><img draggable="false" src="${esc(image(art.path))}" alt="Fanart de @${esc(art.handle)}"><span><b>@${esc(art.handle)}</b><small>${Number(art.votos||0)} votos</small></span><label>posição <select data-position aria-label="Posição de @${esc(art.handle)}" ${state.busy?'disabled':''}>${state.arts.map((_,i)=>`<option value="${i}" ${i===index?'selected':''}>${i+1}º</option>`).join('')}</select></label><div class="podium-move"><button type="button" class="mini" data-up aria-label="Subir @${esc(art.handle)}" ${index===0||state.busy?'disabled':''}>↑</button><button type="button" class="mini" data-down aria-label="Descer @${esc(art.handle)}" ${index===state.arts.length-1||state.busy?'disabled':''}>↓</button></div></div>`).join('')||'<p class="mut">Nenhuma fanart aprovada nesta semana.</p>';
      section.querySelector('[data-save-order]').disabled=state.busy||!state.dirty||!state.arts.length||!!ranking.error;
      section.querySelector('[data-auto-order]').disabled=state.busy||!!ranking.error;
      section.querySelector('[data-discard-order]').disabled=state.busy||!state.dirty;
    }
    function move(id,to){
      if(state.busy||ranking.error)return;
      const from=state.arts.findIndex(art=>art.id===id);
      if(from<0||to<0||to>=state.arts.length||from===to)return;
      const [art]=state.arts.splice(from,1);state.arts.splice(to,0,art);state.dirty=true;
      draw();notice.textContent='Ordem alterada. Clique em salvar ordem para publicar.';
    }
    draw();
    if(ranking.error){notice.textContent='Para ativar este controle, execute supabase-podio.sql no Supabase.';return}
    section.addEventListener('change',event=>{
      const field=event.target.closest('[data-position]');if(!field)return;
      const id=field.closest('[data-art-id]').dataset.artId;move(id,Number(field.value));
      list.querySelector(`[data-art-id="${id}"] [data-position]`)?.focus();
    },{signal});
    section.addEventListener('click',event=>{
      const button=event.target.closest('[data-up],[data-down]');if(!button||button.disabled)return;
      const id=button.closest('[data-art-id]').dataset.artId,index=state.arts.findIndex(a=>a.id===id);
      move(id,index+(button.hasAttribute('data-up')?-1:1));
      list.querySelector(`[data-art-id="${id}"] ${button.hasAttribute('data-up')?'[data-up]':'[data-down]'}`)?.focus();
    },{signal});
    // Captura no contêiner estável: funciona também com o dedo no celular.
    parent.addEventListener('pointerdown',event=>{
      const grip=event.target.closest('[data-grip]');if(!grip||grip.disabled||event.button>0)return;
      event.preventDefault();state.drag={id:grip.closest('[data-art-id]').dataset.artId,pointer:event.pointerId,x:event.clientX,y:event.clientY};
      parent.setPointerCapture(event.pointerId);
    },{signal});
    parent.addEventListener('pointermove',event=>{
      const drag=state.drag;if(!drag||drag.pointer!==event.pointerId||Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<8)return;
      const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-art-id]');
      if(target&&list.contains(target))move(drag.id,state.arts.findIndex(a=>a.id===target.dataset.artId));
      const bounds=list.getBoundingClientRect();
      if(event.clientY<bounds.top+40)scrollBy(0,-12);else if(event.clientY>Math.min(bounds.bottom,innerHeight)-40)scrollBy(0,12);
    },{signal});
    const endDrag=event=>{if(state.drag?.pointer!==event.pointerId)return;state.drag=null;
      if(parent.hasPointerCapture(event.pointerId))parent.releasePointerCapture(event.pointerId);draw()};
    parent.addEventListener('pointerup',endDrag,{signal});parent.addEventListener('pointercancel',endDrag,{signal});
    async function save(automatic){
      if(state.busy)return;state.busy=true;draw();notice.textContent='Salvando…';
      try{
        const {error}=await client.rpc('salvar_ordem_fanarts',{p_semana:state.week,p_ordem:automatic?null:state.arts.map(a=>a.id)});
        if(error)throw error;
        state.dirty=false;state.busy=false;notice.textContent='Ordem salva.';await onSaved();
      }catch(error){state.busy=false;draw();notice.textContent='Não foi possível salvar a ordem. '+(error.message||'Tente novamente.')}
    }
    section.querySelector('[data-save-order]').onclick=()=>save(false);
    section.querySelector('[data-auto-order]').onclick=()=>save(true);
    section.querySelector('[data-discard-order]').onclick=()=>{state.dirty=false;onSaved()};
  }
  window.SabadouPodium={rank,mount,clear};
})();
