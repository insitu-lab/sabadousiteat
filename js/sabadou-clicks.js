/* Limite de toques e contagem confirmada pelo servidor. */
(()=>{
  let lastTap=-Infinity;
  function acceptTap(){
    const now=performance.now();
    if(now-lastTap<500)return false;
    lastTap=now;return true;
  }
  function connect({client,userId,legacy,onState,onMessage}){
    let disposed=false,busy=false,ready=false,lastReply=0,revision=null,total=null,retryAfter=0;
    const requestId=()=>crypto.randomUUID();
    const message=text=>{if(!disposed)onMessage(text)};
    async function action(name='sync',item=null){
      if(disposed||busy)return false;
      busy=true;
      try{
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
        onState({clicks:next,coin:Number(data.coin),lv:data.lv,revision:nextRevision});
        return data.accepted===true;
      }catch(error){
        retryAfter=performance.now()+5000;
        console.warn('Sabadômetro: falha de conexão.',error);
        message('Sem conexão para confirmar os cliques. Seu progresso salvo foi mantido.');return false;
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
  window.SabadouClicks={acceptTap,connect};
})();
