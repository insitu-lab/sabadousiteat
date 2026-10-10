/* Prazo de manutenção compartilhado pelo painel e pela página de espera. */
(()=>{
  'use strict';
  const cfg=typeof SITE_CONFIG!=='undefined'?SITE_CONFIG:(window.SITE_CONFIG||{});
  const api={state:undefined},fetchLimit=8000;
  let guard=null,client=null,channel=null,authSubscription=null,confirmedAdmin=false;
  api.deadline=settings=>settings&&Object.prototype.hasOwnProperty.call(settings,'maintenance_until')?settings.maintenance_until:(cfg.maintenanceUntil||null);
  api.isActive=settings=>!!settings?.maintenance&&(!Number.isFinite(Date.parse(api.deadline(settings)))||Date.now()<Date.parse(api.deadline(settings)));
  api.read=async()=>{
    if(!cfg.supabaseUrl||!cfg.supabaseKey)throw new Error('Configuração indisponível.');
    const response=await request(cfg.supabaseUrl.replace(/\/$/,'')+'/rest/v1/site_settings?id=eq.1&select=*',{headers:{apikey:cfg.supabaseKey},cache:'no-store'});
    if(!response.ok)throw new Error('Não foi possível carregar a manutenção.');
    const settings=(await response.json())[0];if(!settings)throw new Error('Configuração de manutenção não encontrada.');
    api.state=settings;window.dispatchEvent(new Event('sabadou:maintenance'));return settings;
  };
  async function request(url,options){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),fetchLimit);
    try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}
  }
  async function isAdmin(){
    if(client){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),fetchLimit);
      try{
        const {data,error}=await client.rpc('is_admin').abortSignal(controller.signal);
        if(error)throw error;
        return data===true;
      }finally{clearTimeout(timer)}
    }
    const base=cfg.supabaseUrl.replace(/\/$/,''),ref=new URL(base).hostname.split('.')[0];
    let session;try{session=JSON.parse(localStorage.getItem('sb-'+ref+'-auth-token')||'null')}catch{return false}
    if(!session?.access_token||!session?.user?.id)return false;
    // A confirmação vem do banco; metadados locais não concedem acesso admin.
    const response=await request(base+'/rest/v1/admins?user_id=eq.'+encodeURIComponent(session.user.id)+'&select=user_id',{
      headers:{apikey:cfg.supabaseKey,Authorization:'Bearer '+session.access_token},cache:'no-store'
    });
    if(!response.ok)return false;
    return (await response.json()).some(row=>row.user_id===session.user.id);
  }
  function conceal(){document.documentElement.dataset.maintenanceCheck='pending'}
  function reveal(){delete document.documentElement.dataset.maintenanceCheck}
  function redirect(){
    if(!guard||guard.redirecting)return;
    guard.redirecting=true;conceal();
    document.querySelectorAll('audio,video').forEach(media=>media.pause());
    location.replace(guard.url);
  }
  async function check(){
    if(!guard||guard.redirecting)return;
    if(guard.checking){guard.again=true;return}
    guard.checking=true;
    try{
      const settings=await api.read();
      if(api.isActive(settings)){
        if(!confirmedAdmin)conceal();
        confirmedAdmin=await isAdmin();
        if(!confirmedAdmin){redirect();return}
      }
      reveal();
    }catch(error){console.warn('Não foi possível confirmar o acesso durante a manutenção.',error);redirect()}
    finally{
      guard.checking=false;
      if(guard.again){guard.again=false;check()}
    }
  }
  api.guard=({url})=>{
    if(guard)return check();
    guard={url:new URL(url,document.baseURI).href,checking:false,again:false,redirecting:false};
    conceal();check();
    // Reserva para quando o Realtime cair ou ainda não estiver configurado.
    setInterval(()=>{if(!document.hidden)check()},5000);
    const resume=()=>{if(!document.hidden){if(!confirmedAdmin)conceal();check()}};
    addEventListener('focus',resume);addEventListener('pageshow',resume);addEventListener('online',resume);
    document.addEventListener('visibilitychange',resume);
    addEventListener('storage',event=>{if(event.key?.endsWith('-auth-token')){confirmedAdmin=false;resume()}});
    // Nenhuma interação passa enquanto o acesso está sendo conferido.
    for(const name of ['pointerdown','click','keydown','submit'])document.addEventListener(name,event=>{
      if(document.documentElement.dataset.maintenanceCheck==='pending'){
        event.preventDefault();event.stopImmediatePropagation();
      }
    },true);
  };
  api.attachClient=value=>{
    if(client===value)return;
    if(channel&&client)client.removeChannel(channel);
    authSubscription?.unsubscribe();client=value;confirmedAdmin=false;
    channel=client.channel('sabadou-maintenance-live')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'site_settings',filter:'id=eq.1'},()=>check())
      .subscribe(status=>{if(status==='SUBSCRIBED')check()});
    authSubscription=client.auth.onAuthStateChange(()=>{
      confirmedAdmin=false;setTimeout(()=>check(),0);
    }).data.subscription;
    check();
  };
  // Páginas sem login próprio, como os vídeos, também recebem o Realtime.
  api.connectRealtime=async()=>{
    if(client||!cfg.supabaseUrl||!cfg.supabaseKey)return;
    if(!window.supabase)await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload=resolve;script.onerror=reject;document.head.append(script);
    });
    if(!client)api.attachClient(window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey));
  };
  api.refresh=check;
  const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  function inputDate(value){
    if(!Number.isFinite(Date.parse(value)))return '';
    const p=Object.fromEntries(dateFormat.formatToParts(new Date(value)).map(part=>[part.type,part.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  }
  function parseInput(value){
    if(!value)return null;
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Escolha uma data e hora válidas.');
    const date=new Date(value+':00-03:00');
    if(!Number.isFinite(date.getTime())||inputDate(date.toISOString())!==value)throw new Error('Escolha uma data e hora válidas.');
    if(date.getTime()<=Date.now())throw new Error('Escolha uma data de volta no futuro.');
    return date.toISOString();
  }
  api.mountAdmin=(client,panel)=>{
    panel.innerHTML='<h3>manutenção do site</h3><p class="mut" style="margin:0">Durante a manutenção, só administradores podem acessar o site. O retorno usa o horário de Brasília.</p><button class="cta ghost" type="button" data-toggle disabled>carregando...</button><form data-return-form style="display:grid;gap:.7rem"><label>Data e hora da volta (Brasília)<input class="fld" type="datetime-local" data-return disabled style="display:block;margin-top:.4rem;min-width:0"></label><p class="mut" style="margin:0">Deixe o campo vazio para manter a manutenção sem prazo. O site abre para todos quando o prazo chegar.</p><div class="edb"><button class="cta" type="submit" data-save disabled>salvar volta</button><button class="cta ghost" type="button" data-clear disabled>sem prazo</button></div></form><p class="mut" data-status role="status" aria-live="polite"></p>';
    const toggle=panel.querySelector('[data-toggle]'),input=panel.querySelector('[data-return]'),save=panel.querySelector('[data-save]'),clear=panel.querySelector('[data-clear]'),status=panel.querySelector('[data-status]');
    let settings=null,hasDeadline=false,busy=false;
    function lock(value){busy=value;toggle.disabled=value||!settings;input.disabled=save.disabled=clear.disabled=value||!hasDeadline}
    function apply(row){
      settings=row;hasDeadline=Object.prototype.hasOwnProperty.call(row,'maintenance_until');
      input.value=inputDate(api.deadline(row));toggle.textContent=row.maintenance?'desativar manutenção':'ativar manutenção';lock(false);
    }
    function describe(){
      const deadline=api.deadline(settings),stamp=Date.parse(deadline);
      if(settings.maintenance&&Number.isFinite(stamp)&&stamp<=Date.now())return 'O prazo de volta terminou: o site já está aberto. Defina uma nova data ou retire o prazo antes de ativar novamente.';
      const mode=settings.maintenance?'Manutenção ativa.':'Manutenção desativada.';
      return mode+(Number.isFinite(stamp)?' Volta: '+new Date(stamp).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})+' (Brasília).':' Sem prazo de volta.');
    }
    (async()=>{try{
      const r=await client.from('site_settings').select('*').eq('id',1).single();if(r.error)throw r.error;apply(r.data);
      status.textContent=hasDeadline?describe():'Para definir a volta pelo painel, execute supabase-manutencao.sql no SQL Editor do Supabase.';
    }catch(error){status.textContent='Não foi possível carregar a manutenção. '+(error.message||'Tente novamente.');lock(false)}})();
    toggle.onclick=async()=>{
      if(busy||!settings)return;
      const next=!settings.maintenance,stamp=Date.parse(api.deadline(settings));
      if(next&&Number.isFinite(stamp)&&stamp<=Date.now()){status.textContent='Antes de ativar, salve uma data de volta futura ou escolha “sem prazo”.';return}
      if(!confirm(next?'Ativar a manutenção e direcionar os visitantes para a página de espera?':'Desativar a manutenção e abrir o site para todos?'))return;
      lock(true);status.textContent='Salvando...';
      try{const r=await client.rpc('set_site_maintenance',{p_enabled:next});if(r.error)throw r.error;settings.maintenance=next;apply(settings);status.textContent=describe();api.refresh()}
      catch(error){status.textContent='Não foi possível alterar a manutenção. '+(error.message||'Tente novamente.')}
      finally{lock(false)}
    };
    panel.querySelector('[data-return-form]').onsubmit=async event=>{
      event.preventDefault();if(busy||!hasDeadline)return;
      let deadline;try{deadline=parseInput(input.value)}catch(error){status.textContent=error.message;return}
      lock(true);status.textContent='Salvando a volta...';
      try{
        const r=await client.rpc('set_site_maintenance_until',{p_until:deadline});if(r.error)throw r.error;
        settings.maintenance_until=deadline;apply(settings);status.textContent='Prazo salvo. '+describe();api.refresh();
      }catch(error){status.textContent='Não foi possível salvar a volta. Confira se executou supabase-manutencao.sql. '+(error.message||'')}
      finally{lock(false)}
    };
    clear.onclick=()=>{if(busy||!hasDeadline)return;input.value='';panel.querySelector('[data-return-form]').requestSubmit()};
  };
  window.SabadouMaintenance=api;
})();
