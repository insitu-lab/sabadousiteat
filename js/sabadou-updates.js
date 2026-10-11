/* Avisos por período, sem guardar texto administrativo como HTML. */
(()=>{
  'use strict';
  const SECTIONS=['inicio','avisos','musica','galeria','jogos','fanarts','calabresos'];
  function destination(value){
    if(SECTIONS.some(id=>value==='#'+id))return new URL(document.querySelector('.panel')?value:'index.html'+value,document.baseURI);
    const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Use uma aba (#avisos, por exemplo) ou um endereço HTTPS válido.');return url;
  }
  function active(settings,site,now=Date.now()){
    const start=Date.parse(settings?.update_started_at),end=Date.parse(settings?.update_until);
    return !!settings?.update_enabled&&!!settings?.update_message?.trim()&&Array.isArray(settings.update_targets)
      &&settings.update_targets.includes(site)&&Number.isFinite(start)&&Number.isFinite(end)&&now>=start&&now<end;
  }
  function confetti(dialog){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const layer=document.createElement('div');layer.className='update-confetti';layer.setAttribute('aria-hidden','true');
    for(let i=0;i<55;i++){const piece=document.createElement('i');piece.style.setProperty('--left',Math.random()*100+'%');piece.style.setProperty('--drift',(Math.random()-.5)*200+'px');piece.style.setProperty('--delay',Math.random()*.5+'s');piece.style.setProperty('--color',['#f2b8ff','#ff4fd8','#a64dff','#ffe28b'][i%4]);layer.append(piece)}
    dialog.append(layer);setTimeout(()=>layer.remove(),3500);
  }
  async function show(){
    const site=document.body.dataset.site;if(!site)return;
    // O aviso só aparece depois da verificação de manutenção e de outros diálogos.
    const until=Date.now()+12000;
    while(document.documentElement.dataset.maintenanceCheck==='pending'&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,100));
    if(document.documentElement.dataset.maintenanceCheck==='pending')return;
    let settings;
    try{settings=window.SabadouMaintenance.state||await window.SabadouMaintenance.read()}catch(error){console.warn('Não foi possível carregar o aviso de atualização.',error);return}
    if(window.SabadouMaintenance.isActive(settings))return;
    if(!active(settings,site))return;
    let waitTimer;
    function open(){
      if(!active(settings,site)){clearInterval(waitTimer);return}
      if(document.hidden||document.querySelector('dialog[open]'))return;
      clearInterval(waitTimer);
      const dialog=document.createElement('dialog');dialog.className='update-notice';dialog.setAttribute('aria-labelledby','update-title');
      const close=document.createElement('button');close.type='button';close.className='update-close';close.setAttribute('aria-label','Fechar aviso de atualização');close.textContent='×';
      const title=document.createElement('h2');title.id='update-title';title.textContent='Novidades do Sabadou!';
      const message=document.createElement('p');message.textContent=settings.update_message;
      const more=document.createElement('a');more.className='cta';more.textContent='Ler mais';
      try{more.href=destination(settings.update_link||'#avisos').href}catch{more.href='#avisos'}
      more.addEventListener('click',()=>dialog.close());close.onclick=()=>dialog.close();
      const expiry=setInterval(()=>{if(!active(settings,site))dialog.close()},1000);
      dialog.addEventListener('close',()=>{clearInterval(expiry);dialog.remove()},{once:true});
      dialog.append(close,title,message,more);document.body.append(dialog);dialog.showModal();close.focus();confetti(dialog);
    }
    waitTimer=setInterval(open,250);open();
  }
  let activeAdmin=null;
  function mountActiveAdmin(client,parent){
    activeAdmin?.dispose();
    const panel=document.createElement('section');panel.id='admin-active-updates';panel.className='ed active-updates-admin';
    panel.innerHTML='<h3>avisos de atualização ativos</h3><p class="hint" style="margin:0">O título é a primeira linha da mensagem. O tempo restante atualiza automaticamente.</p><ul class="active-updates-list"></ul><p class="mut" data-list-status role="status">Carregando avisos...</p>';
    parent.append(panel);
    const list=panel.querySelector('ul'),status=panel.querySelector('[data-list-status]'),controller=new AbortController();
    let row=null,signature='',clock=null,disposed=false,loading=false,lastRead=0,generation=0;
    function dispose(){disposed=true;clearInterval(timer);controller.abort();if(activeAdmin?.panel===panel)activeAdmin=null}
    function render(){
      if(!panel.isConnected){dispose();return}
      const now=Date.now(),visible=['oficial','atualizacao'].some(site=>active(row,site,now));
      if(!visible){if(list.childElementCount)list.replaceChildren();signature='';clock=null;
        if(row)status.textContent='Nenhum aviso de atualização ativo.';return}
      const firstLine=row.update_message.split(/\r?\n/).find(line=>line.trim())?.trim()||'Novidades do Sabadou!';
      const title=firstLine.length>100?firstLine.slice(0,97).trimEnd()+'…':firstLine;
      const nextSignature=JSON.stringify([title,row.update_until]);
      if(signature!==nextSignature){
        const item=document.createElement('li'),name=document.createElement('strong');name.textContent=title;
        clock=document.createElement('time');clock.dateTime=new Date(row.update_until).toISOString();
        clock.title='Expira em '+new Date(row.update_until).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' (Brasília)';
        item.append(name,clock);list.replaceChildren(item);signature=nextSignature;
      }
      const remaining=Math.max(1,Math.ceil((Date.parse(row.update_until)-now)/1000));
      const days=Math.floor(remaining/86400),hours=Math.floor(remaining%86400/3600),minutes=Math.floor(remaining%3600/60),seconds=remaining%60;
      const time=(days?days+'d ':'')+(days||hours?hours+'h ':'')+String(minutes).padStart(2,'0')+'min '+String(seconds).padStart(2,'0')+'s restantes';
      if(clock.textContent!==time)clock.textContent=time;
      status.textContent='';
    }
    function setRow(value){
      if(disposed||!panel.isConnected)return;
      if(!Object.prototype.hasOwnProperty.call(value||{},'update_enabled')){
        status.textContent='Ative este recurso com supabase/sql/supabase-avisos-atualizacao.sql.';return;
      }
      generation++;row=value;render();
    }
    async function read(){
      if(disposed||loading)return;
      loading=true;lastRead=Date.now();const currentGeneration=generation;
      try{
        const result=await client.from('site_settings').select('*').eq('id',1).single();if(result.error)throw result.error;
        if(currentGeneration===generation)setRow(result.data);
      }catch(error){if(!disposed&&panel.isConnected&&currentGeneration===generation)status.textContent='Não foi possível atualizar a lista. Tentarei novamente automaticamente.'}
      finally{loading=false}
    }
    const timer=setInterval(()=>{
      if(disposed)return;
      if(!panel.isConnected){dispose();return}
      if(document.hidden)return;
      render();if(Date.now()-lastRead>=30000)read();
    },1000);
    window.addEventListener('sabadou:maintenance',()=>{if(window.SabadouMaintenance?.state)setRow(window.SabadouMaintenance.state)},{signal:controller.signal});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();read()}},{signal:controller.signal});
    activeAdmin={panel,dispose,setRow};
    if(window.SabadouMaintenance?.state)setRow(window.SabadouMaintenance.state);
    read();
  }
  function mountAdmin(client,parent){
    mountActiveAdmin(client,parent);
    const panel=document.createElement('section');panel.className='ed update-admin';parent.append(panel);
    panel.innerHTML='<h3>aviso de atualização</h3><p class="mut" style="margin:0">Enquanto estiver ativo, cada visita recebe confetes e um aviso com “Ler mais”.</p><form><label class="chk"><input type="checkbox" data-enabled> ativar aviso</label><label>Mensagem<textarea class="fld" data-message maxlength="1000" rows="4" placeholder="O que mudou no Sabadou?"></textarea></label><label>Destino de Ler mais<input class="fld" data-link maxlength="1000" value="#avisos" placeholder="#avisos ou https://..."></label><div class="duration-fields"><label>Duração<input class="fld" data-duration type="number" min="1" max="43200" step="1" value="24" required></label><label>Unidade<select class="fld" data-unit><option value="1">minutos</option><option value="60" selected>horas</option><option value="1440">dias</option></select></label></div><fieldset class="update-targets"><legend>Mostrar em</legend><label class="chk"><input type="checkbox" value="oficial" data-target checked> site oficial</label><label class="chk"><input type="checkbox" value="atualizacao" data-target checked> atualização</label></fieldset><p class="hint" style="margin:0">Salvar um aviso ativo começa um novo período agora. Duração máxima: 30 dias.</p><div class="edb"><button class="cta" type="submit" data-save>salvar aviso</button><button class="cta ghost" type="button" data-stop>encerrar aviso</button></div></form><p class="mut" data-status role="status" aria-live="polite"></p>';
    const form=panel.querySelector('form'),status=panel.querySelector('[data-status]'),enabled=panel.querySelector('[data-enabled]'),message=panel.querySelector('[data-message]'),link=panel.querySelector('[data-link]'),duration=panel.querySelector('[data-duration]'),unit=panel.querySelector('[data-unit]');
    const fields=[...form.elements];let ready=false,busy=false;
    function lock(value){busy=value;fields.forEach(field=>field.disabled=value||!ready)}
    function describe(row){const end=Date.parse(row.update_until);return row.update_enabled&&end>Date.now()?'Aviso ativo até '+new Date(end).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' (Brasília).':'Aviso encerrado ou desativado.'}
    lock(true);
    (async()=>{try{
      const r=await client.from('site_settings').select('*').eq('id',1).single();if(r.error)throw r.error;
      if(!Object.prototype.hasOwnProperty.call(r.data,'update_enabled'))throw new Error('Execute supabase/sql/supabase-avisos-atualizacao.sql no SQL Editor do Supabase.');
      const row=r.data;ready=true;enabled.checked=!!row.update_enabled;message.value=row.update_message||'';link.value=row.update_link||'#avisos';
      const minutes=Math.round((Date.parse(row.update_until)-Date.parse(row.update_started_at))/60000);
      if(minutes>0&&minutes<=43200){unit.value=minutes%1440===0?'1440':minutes%60===0?'60':'1';duration.value=minutes/Number(unit.value)}
      panel.querySelectorAll('[data-target]').forEach(input=>input.checked=(row.update_targets||[]).includes(input.value));status.textContent=describe(row);activeAdmin?.setRow(row);
    }catch(error){status.textContent='Não foi possível carregar o aviso. '+(error.message||'Tente novamente.')}
    finally{lock(false)}})();
    async function save(stop=false){
      if(busy||!ready)return;
      const minutes=stop?1:Number(duration.value)*Number(unit.value),targets=[...panel.querySelectorAll('[data-target]:checked')].map(input=>input.value),on=stop?false:enabled.checked;
      if(!stop&&(!Number.isSafeInteger(minutes)||minutes<1||minutes>43200)){status.textContent='Escolha uma duração entre 1 minuto e 30 dias.';return}
      if(!stop&&!targets.length){status.textContent='Escolha pelo menos um site.';return}
      if(on&&!message.value.trim()){status.textContent='Escreva a mensagem do aviso.';return}
      try{destination(link.value.trim()||'#avisos')}catch(error){if(!stop){status.textContent=error.message;return}}
      lock(true);status.textContent='Salvando...';
      try{
        const r=await client.rpc('set_site_update_notice',{p_enabled:on,p_message:stop?'':message.value.trim(),p_duration_minutes:minutes,p_link:stop?'#avisos':link.value.trim()||'#avisos',p_targets:stop?['oficial','atualizacao']:targets});if(r.error)throw r.error;
        enabled.checked=on;const current=await client.from('site_settings').select('*').eq('id',1).single();if(current.error)throw current.error;
        status.textContent='Salvo. '+describe(current.data);activeAdmin?.setRow(current.data);
      }catch(error){status.textContent='Não foi possível salvar o aviso. '+(error.message||'Tente novamente.')}
      finally{lock(false)}
    }
    form.onsubmit=event=>{event.preventDefault();save()};panel.querySelector('[data-stop]').onclick=()=>save(true);
  }
  window.SabadouUpdates={mountAdmin,isActive:active,destination};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
})();
