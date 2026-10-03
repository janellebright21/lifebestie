import { useCallback, useEffect, useRef, useState } from 'react';
const SHEET='/assets/emma/design/emma-full-body-motion-v1.png';
const CENTERS=[293,245,197,293,245,197];
export default function EmmaFullBodyIllustration(){
 const [pose,setPose]=useState(0),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false);
 const timers=useRef<ReturnType<typeof setTimeout>[]>([]);const active=useRef(false);const blinkTimer=useRef<ReturnType<typeof setTimeout>>();
 const stop=useCallback(()=>{timers.current.forEach(clearTimeout);timers.current=[];active.current=false;setPose(0);},[]);
 const greet=useCallback(()=>{
  if(!loaded||active.current||document.hidden||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  active.current=true;
  const frames=[2,3,4,3,4,3,5,0],durations=[180,350,250,250,250,350,200];let time=0;
  frames.forEach((frame,index)=>{timers.current.push(setTimeout(()=>{setPose(frame);if(index===frames.length-1){active.current=false;timers.current=[];}},time));time+=durations[index]??0;});
 },[loaded]);
 useEffect(()=>{const image=new Image();image.onload=()=>setLoaded(true);image.onerror=()=>setFailed(true);image.src=SHEET;return()=>{image.onload=null;image.onerror=null;};},[]);
 useEffect(()=>{
  if(!loaded)return;const media=matchMedia('(prefers-reduced-motion:reduce)');let cancelled=false;
  const schedule=()=>{clearTimeout(blinkTimer.current);if(cancelled||media.matches||document.hidden)return;blinkTimer.current=setTimeout(()=>{if(active.current){schedule();return;}setPose(1);blinkTimer.current=setTimeout(()=>{if(!active.current)setPose(0);schedule();},140);},3500+Math.random()*2400);};
  const greeting=setTimeout(greet,300);
  const visibility=()=>{stop();schedule();};schedule();document.addEventListener('visibilitychange',visibility);media.addEventListener('change',visibility);
  return()=>{cancelled=true;clearTimeout(greeting);clearTimeout(blinkTimer.current);timers.current.forEach(clearTimeout);timers.current=[];active.current=false;document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',visibility);};
 },[loaded,greet,stop]);
 if(failed)return <img className="emma-full-body__reference" src="/assets/emma/design/emma-full-body-approved.png" alt="Emma in her lavender sweatshirt, jeans and sneakers"/>;
 const column=pose%3,row=Math.floor(pose/3);
 return <button type="button" className="emma-full-body__sprite" aria-label="Say hi to Emma" title="Tap Emma for a greeting wave" onClick={greet} data-pose={pose}>
 <svg viewBox={`${column*512+CENTERS[pose]-130} ${row*512} 260 512`} role="img" aria-label="Emma in her lavender sweatshirt, jeans and sneakers" preserveAspectRatio="xMidYMax meet"><image href={SHEET} width="1536" height="1024"/></svg>
 </button>;
}

