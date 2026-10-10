/* A mesma conta com @ e senha é usada nas duas versões do site. */
(()=>{
  function mount({getClient,onSignedIn,copy={}}){
    const dialog=document.getElementById('ul'),find=id=>dialog.querySelector('#'+id);
    const form=find('ulf'),submit=find('usubmit'),toggle=find('uswitch'),message=find('um');
    let creating=false,busy=false;
    function mode(create){
      creating=create;find('ut').textContent=create?'criar conta':'entrar';
      submit.textContent=create?'criar conta':'entrar';toggle.textContent=create?'já tenho conta':'criar conta';
      find('upw').autocomplete=create?'new-password':'current-password';
      find('upw').placeholder=create?'senha nova, diferente da senha do Instagram':'senha';
      message.textContent=create?(copy.createHint||'Use seu @ do Instagram e crie uma senha nova, diferente da senha do Instagram.'):(copy.signInHint||'Use a mesma conta nos dois sites para continuar com seus cliques.');
    }
    toggle.onclick=()=>{if(!busy)mode(!creating)};
    form.onsubmit=async event=>{
      event.preventDefault();if(busy)return;
      const client=getClient();if(!client){message.textContent='Login indisponível no momento. Tente novamente.';return}
      const handle=find('uh').value.trim().replace(/^@/,'').toLowerCase(),password=find('upw').value;
      if(!/^[a-z0-9._]{1,30}$/.test(handle)){message.textContent='Use um @ válido: letras, números, ponto ou _.';return}
      if(creating&&password.length<8){message.textContent='A senha precisa ter pelo menos 8 caracteres.';return}
      busy=true;submit.disabled=true;toggle.disabled=true;message.textContent=creating?'Criando conta…':'Entrando…';
      try{
        const email=handle+'@login.sabadou.invalid';
        const result=creating?await client.auth.signUp({email,password,options:{data:{handle}}}):await client.auth.signInWithPassword({email,password});
        if(result.error){
          const messages={user_already_exists:'Já existe uma conta com esse @. Escolha “já tenho conta”.',signup_disabled:'O cadastro está indisponível no momento.',weak_password:'Escolha uma senha mais forte.',over_email_send_rate_limit:'Não foi possível criar a conta agora. Tente novamente mais tarde.'};
          message.textContent=messages[result.error.code]||(creating?'Não foi possível criar a conta. Tente novamente.':'@ ou senha incorretos.');
          console.warn('Falha no login de fã:',result.error);return;
        }
        if(!result.data.session){message.textContent='Sua conta ainda não pôde entrar. Peça ao Sabadou para conferir o cadastro.';return}
        find('upw').value='';await onSignedIn();dialog.close();
      }catch(error){message.textContent='Não foi possível concluir a entrada. Confira a conexão e tente novamente.';console.warn('Login de fã:',error)}
      finally{busy=false;submit.disabled=false;toggle.disabled=false}
    };
    return {open(){dialog.showModal();find('uh').focus()},mode};
  }
  window.SabadouFanAuth={mount};
})();
