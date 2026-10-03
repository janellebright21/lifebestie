import { useEffect, useState, useId, useRef, useCallback } from 'react';
import type { AvatarExpression } from '../../lib/supabase';
import './EmmaArticulatedAvatar.css';
const ATLAS='/assets/emma/rig/emma-unified-v2.png';
function Part({viewBox,x,y,width,height}: {viewBox:string;x:number;y:number;width:number;height:number}) {
 return <svg x={x} y={y} width={width} height={height} viewBox={viewBox} overflow="hidden" preserveAspectRatio="none"><image href={ATLAS} width="1254" height="1254" /></svg>;
}
export default function EmmaArticulatedAvatar({expression='happy'}:{expression?:AvatarExpression}) {
 const clipId=useId();
 const waveTimer=useRef<ReturnType<typeof setTimeout>>();
 const [waving,setWaving]=useState(false);
 const lastWave=useRef(-Infinity);
 const wave=useCallback(()=>{
  const now=performance.now();
  if(document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches||now-lastWave.current<2700)return;
  lastWave.current=now;clearTimeout(waveTimer.current);setWaving(true);setGesture(n=>n+1);
  waveTimer.current=setTimeout(()=>setWaving(false),2400);
 },[]);
 const [blink,setBlink]=useState(false);
 const [gesture,setGesture]=useState(0);
 const [failed,setFailed]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [paused,setPaused]=useState(document.hidden);
 const attentive=expression==='thinking'||expression==='focused';
 useEffect(()=>{const image=new Image();image.onload=()=>setLoaded(true);image.onerror=()=>setFailed(true);image.src=ATLAS;return()=>{image.onload=null;image.onerror=null;};},[]);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');let timer:ReturnType<typeof setTimeout>;
  let stopped=false;
  const schedule=()=>{clearTimeout(timer);setBlink(false);if(stopped||media.matches||document.hidden||!loaded)return;timer=setTimeout(()=>{setBlink(true);timer=setTimeout(()=>{setBlink(false);schedule();},145);},(attentive?4600:3300)+Math.random()*2400);};
  const visibility=()=>schedule();schedule();media.addEventListener('change',visibility);document.addEventListener('visibilitychange',visibility);
  return()=>{stopped=true;clearTimeout(timer);media.removeEventListener('change',visibility);document.removeEventListener('visibilitychange',visibility);};
 },[loaded,attentive]);
 useEffect(()=>{
  if(!loaded)return;
  const greeting=setTimeout(wave,250);
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const visibility=()=>{
   setPaused(document.hidden);
   if(document.hidden||media.matches){clearTimeout(waveTimer.current);setWaving(false);}
  };
  document.addEventListener('visibilitychange',visibility);media.addEventListener('change',visibility);
  return()=>{clearTimeout(greeting);clearTimeout(waveTimer.current);document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',visibility);};
 },[loaded,wave]);
 if(failed)return <img src="/assets/emma/expressions/emma-happy-v3.png" alt="Emma" style={{width:'100%',height:'100%',objectFit:'contain'}}/>;
 return <button type="button" className={`emma-rig ${paused?'emma-rig--paused':''}`} aria-label="Say hi to Emma" title="Tap Emma for a wave" onClick={wave}>
 <svg viewBox="60 0 650 710" role="img" aria-label="Emma, your animated bestie">
 <defs><filter id={`${clipId}-soft`}><feGaussianBlur stdDeviation="1.8"/></filter><mask id={clipId} maskUnits="userSpaceOnUse" x="210" y="170" width="205" height="85"><rect x="220" y="180" width="180" height="60" rx="18" fill="white" filter={`url(#${clipId}-soft)`}/></mask></defs>
 <g className="emma-rig__left"><Part viewBox="0 785 627 469" x={-25} y={344} width={400} height={350}/></g>
 <g className="emma-rig__pose" opacity={waving?0:1}><g transform="translate(650 0) scale(-1 1)"><g className="emma-rig__left"><Part viewBox="0 785 627 469" x={-25} y={344} width={400} height={350}/></g></g></g>
 <g className="emma-rig__pose" opacity={waving?1:0}><g key={gesture} className={waving?'emma-rig__wave':''}><Part viewBox="627 785 627 469" x={309} y={171} width={440} height={329}/></g></g>
 <Part viewBox="0 0 627 785" x={60} y={0} width={480} height={600}/>
 <g opacity={blink?1:0} mask={`url(#${clipId})`}><Part viewBox="627 0 627 785" x={93} y={0} width={480} height={600}/></g>
 </svg></button>;
}
