/* Limite de toques e contagem confirmada pelo servidor. */
(()=>{
  let lastTap=-Infinity;
  function acceptTap(){
    const now=performance.now();
    if(now-lastTap<500)return false;
    lastTap=now;return true;
  }
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function migrateLegacy(client,userId){
    const owner=read('sab_legacy_owner',null);
    if(owner&&owner!==userId)return null;
    const backup=read('sab_before_server_'+userId,null),snapshotKey='sab_legacy_snapshot_'+userId;
    const snapshot=read(snapshotKey,null);
    const total=Math.max(Number(read('sab_n',0))||0,Number(backup?.clicks)||0,Number(snapshot?.clicks)||0);
    if(!Number.isSafeInteger(total)||total<=0)return null;
    let device=read('sab_legacy_device',null);
    if(!device){device=crypto.randomUUID();write('sab_legacy_device',device)}
    // Reserva o saldo para a primeira conta usada neste navegador.
    // As chaves antigas e a cópia de segurança continuam guardadas.
    write('sab_legacy_owner',userId);write(snapshotKey,{clicks:total,device});
    const {data,error}=await client.rpc('importar_cliques_antigos',{p_user_id:userId,p_aparelho:device,p_total:total});
    if(error)throw error;
    write('sab_legacy_migration_'+userId,data);return data;
  }
  function connect({client,userId,legacy,onState,onMessage}){
    let disposed=false,busy=false,ready=false,lastReply=0,revision=null,total=null,retryAfter=0,migration=null,migrationCheck=0;
    const requestId=()=>crypto.randomUUID();
    const message=text=>{if(!disposed)onMessage(text)};
    async function action(name='sync',item=null){
      if(disposed||busy)return false;
      busy=true;
      try{
        if(!ready||(migration?.state==='revisao'&&performance.now()-migrationCheck>=30000)){
          migration=await migrateLegacy(client,userId);migrationCheck=performance.now();if(disposed)return false;
        }
        const args={p_acao:name,p_item:item,p_pedido:name==='sync'?null:requestId()};
        if(!ready&&legacy){args.p_niveis=legacy.lv;args.p_moedas=legacy.coin}
        const {data,error}=await client.rpc('sabadometro_acao',args);
        if(disposed)return false;
        if(error){
          retryAfter=performance.now()+30000;
          console.warn('Sabadômetro: contagem não confirmada.',error);
          if(error.message?.includes('progresso_antigo_precisa_revisao')){
            message('Seu progresso antigo ficou guardado neste aparelho. Peça ao admin para conferir o placar antes de continuar.');
          }else if(error.code==='PGRST202'||error.code==='42883'){
            message('O Sabadômetro está aguardando uma atualização. Seu progresso continua guardado.');
          }else message('Não consegui confirmar os cliques. Seu progresso salvo foi mantido; tente novamente.');
          return false;
        }
        const next=Number(data?.clicks),nextRevision=Number(data?.revision);
        if(!Number.isSafeInteger(next)||next<0||!Number.isSafeInteger(nextRevision)||
           !Array.isArray(data?.lv)||data.lv.length!==4||!Number.isFinite(Number(data.coin))){
          message('O servidor não confirmou o progresso. Tente novamente.');return false;
        }
        // Respostas nunca reduzem o contador sem uma correção do admin.
        if(total!==null&&(nextRevision<revision||(next<total&&nextRevision===revision))){
          message('O placar retornou um valor antigo. Mantive os cliques já confirmados.');return false;
        }
        ready=true;total=next;revision=nextRevision;lastReply=performance.now();retryAfter=0;
        message('');
        onState({clicks:next,coin:Number(data.coin),lv:data.lv,revision:nextRevision,migration});
        return data.accepted===true;
      }catch(error){
        retryAfter=performance.now()+30000;
        console.warn('Sabadômetro: falha de conexão.',error);
        if(error.code==='PGRST202'||error.code==='42883')message('O Sabadômetro está aguardando uma atualização. Seu progresso continua guardado.');
        else if(error.message?.includes('saldo_antigo_ja_vinculado'))message('Os cliques antigos deste navegador já estão ligados a outra conta. Entre com ela para continuar.');
        else message('Não consegui transferir ou confirmar os cliques. Seu saldo antigo continua guardado; tente novamente.');
        return false;
      }finally{busy=false}
    }
    action();
    const timer=setInterval(()=>{
      if(!disposed&&performance.now()>=retryAfter&&performance.now()-lastReply>=950)action();
    },1000);
    return {
      userId,
      async tap(){if(!ready){message('Aguarde a conexão com o placar para jogar.');return false}return action('tap')},
      async buy(item){if(!ready){message('Aguarde a conexão com a lojinha.');return false}return action('buy',item)},
      sync:()=>action(),
      close(){disposed=true;clearInterval(timer)}
    };
  }
  async function mountMigrations(client,parent){
    parent.querySelector('.click-migrations')?.remove();
    const section=document.createElement('section');section.className='ed click-migrations';
    section.innerHTML='<h3>cliques antigos transferidos</h3><p class="hint">O saldo informado pelo navegador antigo não tinha validação no servidor. Confira este histórico antes de entregar premiações. Transferências com remoção administrativa anterior aguardam sua aprovação.</p><p role="status">Carregando…</p>';
    parent.append(section);const status=section.querySelector('[role="status"]');
    try{
      const {data,error}=await client.rpc('listar_migracoes_cliques');if(!section.isConnected)return;if(error)throw error;
      status.textContent='';section.insertAdjacentHTML('beforeend','<div class="click-migrations-table"><table><thead><tr><th>Conta</th><th>Saldo antigo</th><th>Placar atual</th><th>Acrescentados</th><th>Transferência</th></tr></thead><tbody>'+data.map(row=>`<tr><td>@${esc(row.handle)}</td><td>${Number(row.total_antigo).toLocaleString('pt-BR')}</td><td>${Number(row.clicks).toLocaleString('pt-BR')}</td><td>${Number(row.adicionados).toLocaleString('pt-BR')}</td><td>${row.estado==='revisao'?`<button class="cta sm" type="button" data-approve-migration="${esc(row.user_id)}" data-handle="${esc(row.handle)}">aprovar transferência</button>`:'transferido'}</td></tr>`).join('')+'</tbody></table></div>');
      if(!data.length)status.textContent='Nenhuma transferência recebida ainda.';
      section.addEventListener('click',async event=>{
        const button=event.target.closest('[data-approve-migration]');if(!button||button.disabled)return;
        if(!confirm('Aprovar o saldo antigo de @'+button.dataset.handle+'? O placar passará a usar o maior saldo, sem descontar pontos.'))return;
        button.disabled=true;
        try{const result=await client.rpc('aprovar_migracao_cliques',{p_user_id:button.dataset.approveMigration});if(result.error)throw result.error;await mountMigrations(client,parent)}
        catch(error){status.textContent='Não foi possível aprovar. '+(error.message||'Tente novamente.');button.disabled=false}
      });
    }catch(error){if(section.isConnected)status.textContent='Para ativar o histórico, execute supabase-login-cliques-antigos.sql no Supabase.'}
  }
  window.SabadouClicks={acceptTap,connect,migrateLegacy,mountMigrations};
})();
