import { useCallback, useEffect, useRef, useState, useId } from 'react';
const SHEET='/assets/emma/design/emma-full-body-motion-v1.png';
const CENTERS=[293,245,197,293,245,197];
function Frame({pose}:{pose:number}){const col=pose%3,row=Math.floor(pose/3);return <svg width="260" height="512" viewBox={`${col*512+CENTERS[pose]-130} ${row*512} 260 512`} overflow="hidden"><image href={SHEET} width="1536" height="1024"/></svg>;}
export default function EmmaFullBodyIllustration(){
 const [pose,setPose]=useState(0),[blink,setBlink]=useState(false),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false),[paused,setPaused]=useState(document.hidden);
 const id=useId();const timers=useRef<ReturnType<typeof setTimeout>[]>([]);const active=useRef(false);
 const stop=useCallback(()=>{timers.current.forEach(clearTimeout);timers.current=[];active.current=false;setPose(0);setBlink(false);},[]);
 const greet=useCallback(()=>{
  if(!loaded||active.current||document.hidden||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  active.current=true;setBlink(false);
  const frames=[2,3,4,3,4,3,5,0],durations=[180,350,250,250,250,350,200];let time=0;
  frames.forEach((frame,index)=>{timers.current.push(setTimeout(()=>{setPose(frame);if(index===frames.length-1){active.current=false;timers.current=[];}},time));time+=durations[index]??0;});
 },[loaded]);
 useEffect(()=>{const image=new Image();image.onload=()=>setLoaded(true);image.onerror=()=>setFailed(true);image.src=SHEET;return()=>{image.onload=null;image.onerror=null;};},[]);
 useEffect(()=>{
  if(!loaded)return;const media=matchMedia('(prefers-reduced-motion:reduce)');let next=performance.now()+3000,closedUntil=0;
  const tick=()=>{if(document.hidden||media.matches||active.current)return;const now=performance.now();if(closedUntil){if(now>=closedUntil){setBlink(false);closedUntil=0;next=now+2600+Math.random()*1600;}}else if(now>=next){setBlink(true);closedUntil=now+160;}};
  const interval=setInterval(tick,40);const greeting=setTimeout(greet,300);
  const visibility=()=>{stop();setPaused(document.hidden||media.matches);closedUntil=0;next=performance.now()+3000;};
  document.addEventListener('visibilitychange',visibility);media.addEventListener('change',visibility);
  return()=>{clearInterval(interval);clearTimeout(greeting);timers.current.forEach(clearTimeout);timers.current=[];active.current=false;document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',visibility);};
 },[loaded,greet,stop]);
 if(failed)return <img className="emma-full-body__reference" src="/assets/emma/design/emma-full-body-approved.png" alt="Emma in her lavender sweatshirt, jeans and sneakers"/>;
 return <button type="button" className={`emma-full-body__sprite ${paused?'emma-full-body__sprite--paused':''} ${pose>1?'emma-full-body__sprite--greeting':''}`} aria-label="Say hi to Emma" title="Tap Emma for a greeting wave" onClick={greet} data-pose={pose} data-blink={blink?'closed':'open'}>
 <svg viewBox="0 0 260 512" role="img" aria-label="Emma in her lavender sweatshirt, jeans and sneakers" preserveAspectRatio="xMidYMax meet">
 <defs><clipPath id={`${id}-lower`}><rect x="0" y="242" width="260" height="270"/></clipPath><clipPath id={`${id}-upper`}><rect x="0" y="0" width="260" height="250"/></clipPath><clipPath id={`${id}-eyes`}><rect x="105" y="65" width="72" height="30" rx="9"/></clipPath></defs>
 <g clipPath={`url(#${id}-lower)`}><Frame pose={pose}/></g>
 <g clipPath={`url(#${id}-upper)`}><g className="emma-full-body__breathing"><Frame pose={pose}/>{blink&&pose===0&&<g clipPath={`url(#${id}-eyes)`}><Frame pose={1}/></g>}</g></g>
 </svg></button>;
}

