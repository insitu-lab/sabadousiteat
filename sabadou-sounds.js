/* Efeitos sonoros curtos, sintetizados no navegador. */
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
  const sounds={
    click(){tone(620,0,.055,'triangle',.025,470)},
    frog(){tone(470,0,.075,'square',.035,720);tone(720,.055,.09,'triangle',.035,930)},
    buy(){tone(520,0,.09,'triangle',.04,780);tone(780,.085,.12,'triangle',.045,1040)},
    jump(){tone(300,0,.11,'square',.045,560)},
    lose(){tone(300,0,.18,'triangle',.055,220);tone(220,.15,.3,'sawtooth',.035,95)},
    win(){tone(523,0,.14,'triangle',.05,523);tone(659,.12,.14,'triangle',.05,659);tone(784,.24,.2,'triangle',.055,784);tone(1047,.42,.36,'triangle',.06,1047)}
  };
  window.SabadouSounds={play(name){sounds[name]?.()}};
  addEventListener('pointerdown',context,{once:true,passive:true});
  addEventListener('keydown',context,{once:true});
  function buttonSound(e){
    const el=e.target.closest('button,a.cta,[role="button"]');
    if(!el||el.disabled)return;
    if(el.id==='btn')sounds.frog();
    else if(el.closest('#shl'))sounds.buy();
    else sounds.click();
  }
  document.addEventListener('pointerdown',buttonSound,true);
  document.addEventListener('click',e=>{if(e.detail===0)buttonSound(e)},true);
})();
