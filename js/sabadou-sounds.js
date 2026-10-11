/* Áudios locais da interface e efeitos do Sabadou Run. */
(()=>{
  let audio;
  function context(){
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return null;
    if(!audio)audio=new Audio();
    if(audio.state==='suspended')audio.resume().catch(()=>{});
    return audio;
  }
  function tone(freq,start,duration,type='sine',volume=.055,endFreq=freq){
    const a=context();if(!a)return;
    const now=a.currentTime,osc=a.createOscillator(),gain=a.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,now+start);
    if(endFreq!==freq)osc.frequency.exponentialRampToValueAtTime(Math.max(1,endFreq),now+start+duration);
    gain.gain.setValueAtTime(.0001,now+start);gain.gain.exponentialRampToValueAtTime(volume,now+start+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,now+start+duration);
    osc.connect(gain);gain.connect(a.destination);osc.start(now+start);osc.stop(now+start+duration+.02);
  }
  const clipFiles={click:'universfield-menu-click-147357.mp3',tab:'click_002.wav',frog:'click-sabadometro.mp3',buy:'compra.mp3',typing:'digitando.mp3'};
  const soundBase=new URL('assets/sfx/',document.baseURI),reported=new Set();
  const clipUrl=name=>new URL(clipFiles[name],soundBase);
  function report(name,error){
    if(reported.has(name))return;
    reported.add(name);
    console.warn('Não foi possível tocar o efeito sonoro:',clipUrl(name).href,error);
  }
  // Reutilizar os áudios pré-carregados mantém os cliques rápidos do bacano responsivos.
  const clips=Object.fromEntries(Object.entries(clipFiles).map(([name,file])=>[name,
    Array.from({length:4},()=>{
      const sound=new Audio(clipUrl(name).href);
      sound.preload='auto';sound.volume=.38;
      sound.addEventListener('error',()=>report(name,sound.error));
      sound.load();return sound;
    })
  ]));
  const nextClip={};
  function playClip(name){
    const pool=clips[name];if(!pool)return;
    const index=nextClip[name]||0,sound=pool[index];nextClip[name]=(index+1)%pool.length;
    sound.pause();sound.currentTime=0;
    const result=sound.play();if(result?.catch)result.catch(error=>report(name,error));
  }
  const sounds={
    click(){playClip('click')},
    tab(){playClip('tab')},
    frog(){playClip('frog')},
    buy(){playClip('buy')},
    typing(){playClip('typing')},
    jump(){tone(300,0,.11,'square',.045,560)},
    lose(){tone(300,0,.18,'triangle',.055,220);tone(220,.15,.3,'sawtooth',.035,95)},
    win(){tone(523,0,.14,'triangle',.05,523);tone(659,.12,.14,'triangle',.05,659);tone(784,.24,.2,'triangle',.055,784);tone(1047,.42,.36,'triangle',.06,1047)}
  };
  window.SabadouSounds={version:'20261010-2',play(name){sounds[name]?.()}};
  addEventListener('pointerdown',context,{once:true,passive:true});
  addEventListener('keydown',context,{once:true});
  function buttonSound(e){
    const el=e.target.closest('button,a.cta,.tabs a[role="tab"],[role="button"]');
    if(!el||el.disabled)return;
    if(el.id==='btn'||el.closest('#shl'))return;
    else if(el.matches('.tabs a[role="tab"]'))sounds.tab();
    else sounds.click();
  }
  document.addEventListener('pointerdown',buttonSound,true);
  document.addEventListener('click',e=>{if(e.detail===0)buttonSound(e)},true);
  // Input também recebe as letras digitadas pelo teclado do celular.
  document.addEventListener('input',e=>{
    const el=e.target;
    if(!el.matches('input,textarea')&&!el.isContentEditable)return;
    if(e.isComposing||!['insertText','insertCompositionText','insertFromComposition'].includes(e.inputType))return;
    if(e.data==='')return;
    sounds.typing();
  });
})();
