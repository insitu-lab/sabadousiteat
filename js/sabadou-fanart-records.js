/* Comprovante de recebimento; não atribui autoria artística ao primeiro envio. */
(()=>{
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function date(value){
    const stamp=new Date(value);if(!value||!Number.isFinite(stamp.getTime()))return 'sem data registrada';
    const fractional=String(value).match(/\.(\d+)(?:Z|[+-]\d{2}(?::?\d{2})?)$/)?.[1]||'0';
    return stamp.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})+'.'+fractional.padEnd(6,'0')+' (Brasília)';
  }
  function time(art){
    const verified=!!art.recebido_em,value=art.recebido_em||art.criado_em;
    return `<time class="fanart-time" datetime="${esc(value)}">${verified?'Recebida':'Registro antigo'}: ${esc(date(value))}${verified&&art.envio_seq?' · envio #'+esc(art.envio_seq):''}</time>`;
  }
  function csvCell(value){const text=String(value??'');return '"'+(/^[=+\-@\t\r]/.test(text)?"'":'')+text.replace(/"/g,'""')+'"'}
  async function mount(client,parent){
    parent.querySelector('.fanart-audit')?.remove();
    const section=document.createElement('section');section.className='fanart-audit';section.id='fanart-records';
    section.innerHTML='<h3>registro dos envios</h3><p class="hint">Últimos 200 envios, incluindo pendentes e recusados. Os novos registros usam o relógio do servidor; registros antigos não têm essa confirmação.</p>';
    parent.append(section);
    const result=await client.from('fanarts').select('*').order('criado_em',{ascending:false}).limit(200);
    if(!section.isConnected)return;
    if(result.error){const message=document.createElement('p');message.textContent='Não foi possível carregar os registros.';section.append(message);return}
    const rows=result.data||[];
    section.insertAdjacentHTML('beforeend','<div class="fanart-audit-table"><table><thead><tr><th>Artista</th><th>Recebimento</th><th>Status</th><th>ID do envio</th></tr></thead><tbody>'+rows.map(art=>`<tr><td>@${esc(art.handle)}</td><td>${time(art)}</td><td>${esc(art.status)}</td><td>${esc(art.id)}</td></tr>`).join('')+'</tbody></table></div>');
    const download=document.createElement('button');download.className='mini';download.type='button';download.textContent='baixar histórico completo (CSV)';download.style.marginTop='1rem';section.append(download);parent.append(section);
    download.onclick=async()=>{
      download.disabled=true;
      try{
        const all=[];
        for(let offset=0;;offset+=1000){
          const batch=await client.from('fanarts').select('*').order('criado_em').order('id').range(offset,offset+999);if(batch.error)throw batch.error;
          all.push(...batch.data);if(batch.data.length<1000)break;
        }
        all.sort((a,b)=>Date.parse(a.recebido_em||a.criado_em)-Date.parse(b.recebido_em||b.criado_em)||Number(a.envio_seq||0)-Number(b.envio_seq||0));
        const keys=['id','user_id','handle','recebido_em','envio_seq','criado_em','status'];
        const content='\ufeff'+[keys.join(','),...all.map(art=>keys.map(key=>csvCell(art[key])).join(','))].join('\r\n');
        const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download='sabadou-registro-fanarts.csv';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }catch(error){alert('Não foi possível exportar os envios. '+(error.message||'Tente novamente.'))}
      finally{download.disabled=false}
    };
  }
  window.SabadouFanartRecords={time,mount};
})();
