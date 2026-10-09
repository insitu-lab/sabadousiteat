/* Sabadou Run — jogo do sapinho (pula, agacha, fases = dias da semana até o sábado) */
(()=>{
const cv=document.getElementById('dg');if(!cv)return;
const c=cv.getContext('2d',{alpha:false}),$=s=>document.querySelector(s);let W=800,H=260,G=214,mob=false,ready=false;
const dpr=Math.min(devicePixelRatio||1,2);
// [nome da fase, cor do topo, cor do fundo]
const PH=[['segunda','#1a0a33','#3b1f6e'],['terça','#1e0c3a','#4a2486'],['quarta','#240e44','#5c2a9a'],['quinta','#2c1050','#7a31b0'],['sexta','#38125a','#a53cc0'],['sábado','#4a1264','#e04fc4']];
const PL=300; // seis fases mais longas para tornar a chegada mais difícil
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
let st='idle',score=0,hi=0,phase=0,v=5.2,y=G,vy=0,down=false,ducking=false,obs=[],gap=300,t=0,banner=0,off=0,last=0,shake=0;
let ct=hex(PH[0][1]),cb=hex(PH[0][2]);
try{hi=+localStorage.getItem('sab_hi')||0}catch(e){}
let stars=[];
const active=()=>cv.offsetParent!==null&&!document.hidden&&!document.querySelector('dialog[open]');

// celular: palco mais alto e estreito, assim o sapo e os obstáculos ficam maiores
function size(){const m=innerWidth<700;if(ready&&m===mob)return;ready=true;mob=m;W=m?420:800;H=m?330:260;G=H-46;
  cv.width=W*dpr;cv.height=H*dpr;c.setTransform(dpr,0,0,dpr,0,0);
  stars=Array.from({length:36},()=>({x:Math.random()*W,y:Math.random()*H*.58,s:Math.random()*1.6+.4}));
  if(st==='run')st='idle';obs=[];y=G;vy=0}
const sp=()=>mob?.92:1;size();addEventListener('resize',size);
function reset(){score=0;phase=0;v=6.4;y=G;vy=0;down=false;ducking=false;obs=[];gap=560;banner=100;st='run';shake=0}
function jump(){
  if(st==='idle')reset();
  if(st==='dead'||st==='won'){if(!endDialog.open)endDialog.showModal();return}
  if(st==='run'&&y>=G-.5){vy=-12.8;window.SabadouSounds?.play('jump')}
}
const endDialog=document.createElement('dialog');
endDialog.style.cssText='width:min(92vw,420px);padding:1.5rem;border:2px solid #a64dff;border-radius:24px;background:#12061f;color:#f6ecff;text-align:center;font:700 1.05rem/1.5 Nunito,system-ui,sans-serif';
endDialog.innerHTML='<h2 style="font:400 2rem/1.1 &quot;Bagel Fat One&quot;,Impact,sans-serif;margin:0 0 .8rem"></h2><p style="margin:0 0 1.2rem">Quer jogar de novo? Você também pode fechar esta janela e tirar seu print.</p><div style="display:flex;justify-content:center;gap:.7rem;flex-wrap:wrap"><button type="button" data-restart style="font:inherit;font-weight:800;border:0;border-radius:99px;padding:.75rem 1.1rem;background:#f2b8ff;color:#2a0f3d;cursor:pointer">jogar de novo</button><button type="button" data-dismiss style="font:inherit;font-weight:800;border:2px solid #a64dff;border-radius:99px;padding:.7rem 1rem;background:transparent;color:#f6ecff;cursor:pointer">fechar e tirar print</button></div>';
document.body.appendChild(endDialog);
function finish(result){if(st!=='run')return;st=result;shake=result==='dead'?14:0;endDialog.querySelector('h2').textContent=result==='won'?'Você chegou ao sábado!':'Fim de jogo';endDialog.showModal();window.SabadouSounds?.play(result==='won'?'win':'lose')}
endDialog.querySelector('[data-restart]').addEventListener('click',()=>{endDialog.close();reset()});
endDialog.querySelector('[data-dismiss]').addEventListener('click',()=>endDialog.close());
endDialog.addEventListener('cancel',e=>e.preventDefault());
function spawn(){
  const k=['cal'];if(phase>=1)k.push('cal2');if(phase>=2)k.push('bird','bird');if(phase>=4)k.push('cal3');
  const T=k[Math.floor(Math.random()*k.length)],x=W+40;
  if(T==='bird')obs.push({T,x,w:48,h:26,y:G-58});
  else{const n=T==='cal'?1:T==='cal2'?2:3;obs.push({T,x,w:n*34-2,h:44,y:G-44,n})}
}
function step(dt){
  if(st!=='run')return;
  score+=v*dt*.06/sp();
  const p=Math.min(5,Math.floor(score/PL));if(p!==phase){phase=p;banner=120}
  v=Math.min(14.5,6.4+phase*1.1+(score%PL)/PL*.7)*sp();
  vy+=(down&&y<G?1.5:.65)*dt;y+=vy*dt;if(y>=G){y=G;vy=0}
  ducking=down&&y>=G;off=(off+v*dt)%40;
  gap-=v*dt;if(gap<=0){spawn();gap=Math.max(520,560+Math.random()*220+v*12)}
  for(const o of obs)o.x-=v*dt;obs=obs.filter(o=>o.x>-120);
  const fh=ducking?26:46,fw=ducking?54:40,fx=76,fy=y-fh+5,fW=fw-12,fH=fh-8;
  for(const o of obs)if(fx<o.x+o.w-4&&fx+fW>o.x+4&&fy<o.y+o.h-3&&fy+fH>o.y+3){
    finish('dead');if(score>hi){hi=Math.floor(score);try{localStorage.setItem('sab_hi',hi)}catch(e){}}break}
  if(st==='run'&&score>=PL*6){score=PL*6;phase=5;finish('won')}
}

const px=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x/4)*4,Math.round(y/4)*4,Math.ceil(w/4)*4,Math.ceil(h/4)*4)};
function rr(x,y,w,h,r,col){px(x,y,w,h,col)}
function bg(){
  const T=hex(PH[phase][1]),B=hex(PH[phase][2]);
  for(let i=0;i<3;i++){ct[i]+=(T[i]-ct[i])*.04;cb[i]+=(B[i]-cb[i])*.04}
  c.fillStyle=`rgb(${ct.map(Math.round)})`;c.fillRect(0,0,W,H);
  // Camadas de morros em blocos dão profundidade sem perder o visual pixel art.
  for(let x=0;x<W;x+=32){const h=22+((x*17)%35);px(x,H-46-h,36,h+46,'rgba(12,4,28,.28)');px(x+8,H-46-h-8,16,8,'rgba(255,255,255,.06)')}
  for(const s of stars){s.x-=st==='run'?v*.15:.1;if(s.x<0)s.x=W;c.globalAlpha=.45+.45*Math.abs(Math.sin(t*.03+s.x));px(s.x,s.y,4,4,'#fff')}
  c.globalAlpha=1;px(0,G+2,W,4,'#f2b8ff');px(0,G+6,W,H-G-6,'#32134f');
  for(let x=-off;x<W;x+=40){px(x,G+14,20,4,'#a64dff');px(x+24,G+26,8,4,'#60268a')}
}
function frog(){
  const d=ducking,air=y<G-1,run=Math.floor(t/5)%2,base=Math.round(y/4)*4,x=68;
  const bodyLilac='#b87af5',highlight='#e3c6ff',shadow='#8146bd';
  // Silhueta do sapo em blocos, com dois quadros de corrida e olhos grandes.
  const body=d?[[8,-24,44,16], [0,-16,12,12]]:[[8,-32,32,24],[0,-24,12,16],[32,-24,12,16],[4,-8,12,8],[28,-8,12,8]];
  body.forEach(([dx,dy,w,h])=>px(x+dx,base+dy,w,h,bodyLilac));
  px(x+12,base-(d?20:32),24,8,highlight);px(x+8,base-(d?8:12),32,4,shadow);
  if(!d){px(x+4,base-40,12,12,bodyLilac);px(x+28,base-40,12,12,bodyLilac);px(x+8,base-36,4,8,'#fff');px(x+32,base-36,4,8,'#fff');px(x+12,base-32,4,8,'#20122d');px(x+36,base-32,4,8,'#20122d');px(x+20,base-20,12,4,'#60328e')}
  px(x+(air?0:run?0:8),base-4,12,4,shadow);px(x+(air?28:run?28:20),base-4,12,4,shadow);
  if(st==='dead'){px(x+12,base-36,8,4,'#20122d');px(x+32,base-36,8,4,'#20122d')}
}
function obstacle(o){
  if(o.T==='bird'){
    const flap=Math.floor(t/5)%2;px(o.x+8,o.y+8,32,16,'#ffd166');px(o.x+32,o.y+12,12,8,'#ffd166');px(o.x+40,o.y+14,8,4,'#ff8a3d');px(o.x+34,o.y+8,4,4,'#20122d');
    px(o.x+12,o.y+(flap?0:20),20,8,'#fff0a6');px(o.x+8,o.y+24,8,4,'#ffb84d');return;
  }
  // Cactos substituem os blocos genéricos, como nos obstáculos do Dino.
  for(let i=0;i<o.n;i++){const x=o.x+i*34,y=o.y;px(x+12,y,12,44,'#54d66b');px(x+4,y+14,12,8,'#54d66b');px(x+4,y+14,8,18,'#54d66b');px(x+20,y+24,12,8,'#54d66b');px(x+24,y+24,8,16,'#54d66b');px(x+16,y+4,4,28,'#a5ff91')}
}
function txt(s,x,y,font,a=1){c.globalAlpha=a;c.fillStyle='#fff';c.font=font;c.textAlign='center';c.fillText(s,x,y);c.globalAlpha=1}
function draw(){
  c.save();if(shake>0)c.translate((Math.random()-.5)*7,0);
  bg();obs.forEach(obstacle);frog();c.restore();
  c.fillStyle='#fff';c.font='800 '+(mob?15:18)+'px Nunito,sans-serif';
  c.textAlign='right';c.fillText('HI '+String(hi).padStart(5,'0')+'   '+String(Math.floor(score)).padStart(5,'0'),W-16,28);
  c.textAlign='left';c.fillText(PH[phase][0]+' · fase '+(phase+1)+'/6',16,28);
  if(banner>0&&st==='run')txt(phase===5?'É SÁBADO!!!':PH[phase][0].toUpperCase(),W/2,mob?130:110,'400 '+(mob?46:58)+'px "Bagel Fat One",Impact,sans-serif',Math.min(1,banner/30));
  if(st==='idle')txt(mob?'toque aqui pra começar':'aperta espaço ou toca aqui pra começar',W/2,mob?130:110,'800 '+(mob?20:22)+'px Nunito,sans-serif');
  if(st==='dead')txt(phase===5?'quase! o sábado é seu':'não é sábado :(',W/2,mob?120:100,'400 '+(mob?32:46)+'px "Bagel Fat One",Impact,sans-serif');
  if(st==='won'){txt('VOCÊ CHEGOU AO SÁBADO!',W/2,mob?112:98,'400 '+(mob?30:44)+'px "Bagel Fat One",Impact,sans-serif');txt('Tire um print e mande no Direct do Sabadou para ganhar um salve!',W/2,mob?153:140,'800 '+(mob?13:18)+'px Nunito,sans-serif')}
}
function loop(now){
  requestAnimationFrame(loop);
  if(!active()){last=now;return}
  const dt=Math.min(2.5,(now-(last||now))/16.667);last=now;t+=dt;
  step(dt);if(banner>0)banner-=dt;if(shake>0)shake-=dt;draw();
}
requestAnimationFrame(loop);

addEventListener('keydown',e=>{
  if(!active()||endDialog.open||e.target.isContentEditable||e.target.closest('input,textarea,select,nav,a')||(e.target.closest('button')&&!e.target.closest('#gj,#gd')))return;
  if(['Space','ArrowUp','KeyW'].includes(e.code)){e.preventDefault();if(!e.repeat)jump()}
  if(['ArrowDown','KeyS'].includes(e.code)){e.preventDefault();down=true}
});
addEventListener('keyup',e=>{if(['ArrowDown','KeyS'].includes(e.code))down=false});
cv.addEventListener('pointerdown',jump);
const bj=$('#gj'),bd=$('#gd');
bj.addEventListener('pointerdown',e=>{e.preventDefault();jump()});
bd.addEventListener('pointerdown',e=>{e.preventDefault();down=true});
['pointerup','pointerleave','pointercancel'].forEach(n=>bd.addEventListener(n,()=>down=false));
})();
