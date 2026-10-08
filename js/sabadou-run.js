/* Sabadou Run — jogo do sapinho (pula, agacha, fases = dias da semana até o sábado) */
(()=>{
const cv=document.getElementById('dg');if(!cv)return;
const c=cv.getContext('2d'),$=s=>document.querySelector(s);let W=800,H=260,G=214,mob=false,ready=false;
const dpr=Math.min(devicePixelRatio||1,2);
// [nome da fase, cor do topo, cor do fundo]
const PH=[['segunda','#1a0a33','#3b1f6e'],['terça','#1e0c3a','#4a2486'],['quarta','#240e44','#5c2a9a'],['quinta','#2c1050','#7a31b0'],['sexta','#38125a','#a53cc0'],['sábado','#4a1264','#e04fc4']];
const PL=300; // seis fases mais longas para tornar a chegada mais difícil
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
let st='idle',score=0,hi=0,phase=0,v=5.2,y=G,vy=0,down=false,ducking=false,obs=[],gap=300,t=0,banner=0,off=0,last=0,shake=0;
let ct=hex(PH[0][1]),cb=hex(PH[0][2]);
try{hi=+localStorage.getItem('sab_hi')||0}catch(e){}
let stars=[];
const active=()=>cv.offsetParent!==null;

// celular: palco mais alto e estreito, assim o sapo e os obstáculos ficam maiores
function size(){const m=innerWidth<700;if(ready&&m===mob)return;ready=true;mob=m;W=m?420:800;H=m?330:260;G=H-46;
  cv.width=W*dpr;cv.height=H*dpr;c.setTransform(dpr,0,0,dpr,0,0);
  stars=Array.from({length:36},()=>({x:Math.random()*W,y:Math.random()*H*.58,s:Math.random()*1.6+.4}));
  if(st==='run')st='idle';obs=[];y=G;vy=0}
const sp=()=>mob?.92:1;size();addEventListener('resize',size);
function reset(){score=0;phase=0;v=6.4;y=G;vy=0;obs=[];gap=250;banner=100;st='run';shake=0}
function jump(){if(st!=='run'){reset();return}if(y>=G-.5)vy=-12.8}
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
  v=Math.min(16,6.4+phase*1.35+(score%PL)/PL*.9)*sp();
  vy+=(down&&y<G?1.5:.65)*dt;y+=vy*dt;if(y>=G){y=G;vy=0}
  ducking=down&&y>=G;off=(off+v*dt)%40;
  gap-=v*dt;if(gap<=0){spawn();gap=Math.max(155,205+Math.random()*125+v*7)}
  for(const o of obs)o.x-=v*dt;obs=obs.filter(o=>o.x>-120);
  const fh=ducking?26:46,fw=ducking?54:40,fx=76,fy=y-fh+5,fW=fw-12,fH=fh-8;
  for(const o of obs)if(fx<o.x+o.w-4&&fx+fW>o.x+4&&fy<o.y+o.h-3&&fy+fH>o.y+3){
    st='dead';shake=14;if(score>hi){hi=Math.floor(score);try{localStorage.setItem('sab_hi',hi)}catch(e){}}}
  if(score>=PL*6){score=PL*6;phase=5;st='won'}
}

const el=(x,y,rx,ry,col)=>{c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,0,0,6.3);c.fill()};
function rr(x,y,w,h,r,col){c.fillStyle=col;c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();c.fill()}
function bg(){
  const T=hex(PH[phase][1]),B=hex(PH[phase][2]);
  for(let i=0;i<3;i++){ct[i]+=(T[i]-ct[i])*.04;cb[i]+=(B[i]-cb[i])*.04}
  const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,`rgb(${ct.map(Math.round)})`);g.addColorStop(1,`rgb(${cb.map(Math.round)})`);
  c.fillStyle=g;c.fillRect(0,0,W,H);
  for(const s of stars){s.x-=st==='run'?v*.15:.1;if(s.x<0)s.x=W;c.globalAlpha=.4+.5*Math.abs(Math.sin(t*.03+s.x));c.fillStyle='#fff';c.fillRect(s.x,s.y,s.s,s.s)}
  c.globalAlpha=1;c.fillStyle='#ff4fd8';c.fillRect(0,G+2,W,3);
  c.fillStyle='rgba(255,255,255,.35)';for(let x=-off;x<W;x+=40)c.fillRect(x,G+12,14,2);
}
function frog(){
  const d=ducking,w=d?54:40,h=d?26:46,air=y<G-1,ph=Math.sin(t*.35)*5;
  c.save();c.translate(70,y);
  if(!d){el(10+(air?-3:ph),-3,9,5,'#8f4fe0');el(30+(air?5:-ph),-3,9,5,'#8f4fe0')}
  el(w/2,-h/2-2,w/2,h/2,'#b57cff');el(w/2+3,-h/2+4,w/3,h/3,'#e6d0ff');
  for(const ex of [w*.28,w*.7]){
    const ey=-h+3;el(ex,ey,8,8,'#b57cff');
    if(st==='dead'){c.strokeStyle='#0b0314';c.lineWidth=2.5;c.beginPath();c.moveTo(ex-4,ey-4);c.lineTo(ex+4,ey+4);c.moveTo(ex+4,ey-4);c.lineTo(ex-4,ey+4);c.stroke()}
    else{el(ex+1,ey,5.5,5.5,'#0b0314');el(ex+3,ey-2,1.8,1.8,'#fff')}
  }
  c.strokeStyle='#5a2a9a';c.lineWidth=2;c.beginPath();c.moveTo(w*.5,-h*.5);c.lineTo(w*.9,-h*.5);c.stroke();
  c.restore();
}
function obstacle(o){
  if(o.T==='bird'){
    const f=Math.sin(t*.4)*9;el(o.x+24,o.y+14,22,10,'#f2b8ff');
    c.fillStyle='#ff4fd8';c.beginPath();c.moveTo(o.x+14,o.y+10);c.lineTo(o.x+26,o.y+10);c.lineTo(o.x+20,o.y-8+f);c.fill();
    el(o.x+38,o.y+11,3,3,'#0b0314');return;
  }
  const lab=phase===5?'DOM':PH[phase][0].slice(0,3).toUpperCase();
  for(let i=0;i<o.n;i++){
    const x=o.x+i*34;rr(x,o.y,32,44,5,'#ff4fd8');c.fillStyle='#fff';c.fillRect(x+3,o.y+12,26,29);
    c.fillStyle='#7b2cbf';c.font='800 10px Nunito,sans-serif';c.textAlign='center';c.fillText(lab,x+16,o.y+30);
  }
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
  if(st==='dead'){txt(phase===5?'quase! o sábado é seu':'não é sábado :(',W/2,mob?120:100,'400 '+(mob?32:46)+'px "Bagel Fat One",Impact,sans-serif');txt(mob?'toque pra tentar de novo':'espaço ou toque pra tentar de novo',W/2,mob?154:134,'800 '+(mob?18:20)+'px Nunito,sans-serif')}
  if(st==='won'){txt('VOCÊ CHEGOU AO SÁBADO!',W/2,mob?112:98,'400 '+(mob?30:44)+'px "Bagel Fat One",Impact,sans-serif');txt('Tire um print e mande no Direct do Sabadou para ganhar um salve!',W/2,mob?153:140,'800 '+(mob?13:18)+'px Nunito,sans-serif');txt(mob?'toque pra jogar de novo':'espaço ou toque pra jogar de novo',W/2,mob?188:176,'800 '+(mob?14:17)+'px Nunito,sans-serif')}
}
function loop(now){
  requestAnimationFrame(loop);
  if(!active()){last=now;return}
  const dt=Math.min(2.5,(now-(last||now))/16.667);last=now;t+=dt;
  step(dt);if(banner>0)banner-=dt;if(shake>0)shake-=dt;draw();
}
requestAnimationFrame(loop);

addEventListener('keydown',e=>{
  if(!active()||/INPUT|TEXTAREA/.test(e.target.tagName))return;
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
