const $=id=>document.getElementById(id);
const cl=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const p=(t,a,d)=>cl((t-a)/d);
const eo=x=>1-Math.pow(1-x,3);
const eo5=x=>1-Math.pow(1-x,5);
const eio=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const back=x=>{const c1=1.6,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)};
const lerp=(a,b,x)=>a+(b-a)*x;
function io(t,a,b,din=.42,dout=.26,rise=34,lift=46){const i=eo(p(t,a,din)),o=eio(p(t,b-dout,dout));return{o:i*(1-o),y:(1-i)*rise-o*lift,bl:(1-i)*14+o*16,s:lerp(.96,1,i)};}
function put(el,s,extra=''){el.style.opacity=s.o.toFixed(3);el.style.transform=`translate3d(${(s.x||0).toFixed(2)}px,${s.y.toFixed(2)}px,0) scale(${(s.s??1).toFixed(4)}) ${extra}`;el.style.filter=s.bl>.08?`blur(${s.bl.toFixed(2)}px)`:'none';}
function show(id,on){const e=$(id);e.style.display=on?'block':'none';e.style.opacity=on?1:0;return on;}
function words(el,t,a,b,stagger=.07){[...el.querySelectorAll('.w')].forEach((w,i)=>put(w,io(t,a+i*stagger,b)));}
function glow(el,x,y,r,color,a){el.style.left=(x-r)+'px';el.style.top=(y-r)+'px';el.style.width=el.style.height=(2*r)+'px';el.style.background=color;el.style.opacity=cl(a).toFixed(3);}
function lastBeat(B,t){let l=-9;for(const b of B)if(b<=t)l=b;return l;}
function stagePulse(B,t,stopAt,hit){const l=lastBeat(B,t);const pulse=t<stopAt?0.012*Math.exp(-(t-l)*9):0;const kick=hit!=null&&t>=hit?0.05*Math.exp(-(t-hit)*6):0;$('stage').style.transform=`scale(${(1+pulse+kick+0.004*Math.sin(t*.7)).toFixed(4)})`;}
function flash(t,at,k=.9){$('flash').style.opacity=(t>=at?Math.exp(-(t-at)*7)*k:0).toFixed(3);}

// shared PrepX end card
const LOGO_HTML=`<div id="lockup" style="position:absolute;left:0;right:0;top:370px;display:flex;align-items:center;justify-content:center;gap:18px">
  <svg id="mark" width="104" height="104" viewBox="0 0 32 32" style="overflow:visible">
    <rect width="32" height="32" rx="10" fill="#f2f2ec"/>
    <path id="mx1" d="M10 10 L14 14 M18 18 L22 22" stroke="#09090a" stroke-width="3" stroke-linecap="round" pathLength="1" stroke-dasharray="1"/>
    <path id="mx2" d="M10 22 L22 10" stroke="#09090a" stroke-width="3" stroke-linecap="round" pathLength="1" stroke-dasharray="1"/>
    <path id="mx3" d="M16.2 10 H22 V15.8" fill="none" stroke="#7fa312" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1"/>
  </svg>
  <div id="word" style="font-size:76px;font-weight:600;letter-spacing:-.055em;line-height:1.1;overflow:hidden;white-space:nowrap">Prep<span class="serif" style="font-size:1.15em;letter-spacing:0;color:var(--accent)">X</span></div>
</div>
<div id="tag" style="position:absolute;left:0;right:0;top:520px;text-align:center;font-size:24px;letter-spacing:-.03em">Free to start.</div>
<div id="orgs" style="position:absolute;left:0;right:0;top:572px;display:flex;justify-content:center"><div class="chip mono" style="font-size:11px;letter-spacing:.12em;gap:10px;color:var(--muted);height:32px;padding:0 16px">
  <span class="dot" style="background:var(--deca)"></span>DECA<span class="dot" style="background:var(--fbla)"></span>FBLA<span class="dot" style="background:var(--hosa)"></span>HOSA<span class="dot" style="background:var(--tsa)"></span>TSA</div></div>`;
function renderLogo(t,H,END){
  const m=back(p(t,H,.5)),me=eo(p(t,H,.35));const mark=$('mark');
  $('mx1').style.strokeDashoffset=1-eio(p(t,H+.1,.28));$('mx2').style.strokeDashoffset=1-eio(p(t,H+.22,.28));$('mx3').style.strokeDashoffset=1-eo(p(t,H+.42,.32));
  const wv=eo5(p(t,H+.55,.5));const word=$('word');word.style.maxWidth=(wv*260).toFixed(1)+'px';word.style.opacity=wv.toFixed(3);word.style.filter=wv<.98?`blur(${((1-wv)*10).toFixed(2)}px)`:'none';
  mark.style.opacity=me.toFixed(3);mark.style.filter=me<.98?`blur(${((1-me)*14).toFixed(2)}px)`:'none';mark.style.transform=`scale(${lerp(.4,1,m).toFixed(4)}) rotate(${((1-m)*-12).toFixed(2)}deg)`;
  $('lockup').style.transform=`scale(${(1+.025*eio(p(t,H+1,Math.max(.1,END-H-1)))).toFixed(4)})`;
  put($('tag'),io(t,H+.85,99,.5));put($('orgs'),io(t,H+1.15,99,.5,.1,18));
}
function frameHTML(inner){return `<div id="stage"><div class="glow" id="g0"></div><div class="glow" id="g1"></div><div class="glow" id="g2"></div><div class="glow" id="g3"></div><div id="content">${inner}</div><div id="flash"></div><div id="grain"></div><div id="vignette"></div></div>`;}
function hideGlows(){['g0','g1','g2','g3'].forEach(g=>$(g).style.opacity=0);}
