import { useEffect, useState, useId } from 'react';
import type { AvatarExpression } from '../../lib/supabase';
import './EmmaArticulatedAvatar.css';
const ATLAS='/assets/emma/rig/emma-unified-v2.png';
function Part({viewBox,x,y,width,height}: {viewBox:string;x:number;y:number;width:number;height:number}) {
 return <svg x={x} y={y} width={width} height={height} viewBox={viewBox} overflow="hidden"><image href={ATLAS} width="1254" height="1254" /></svg>;
}
export default function EmmaArticulatedAvatar({expression='happy'}:{expression?:AvatarExpression}) {
 const clipId=useId();
 const [blink,setBlink]=useState(false);
 const [gesture,setGesture]=useState(0);
 const [failed,setFailed]=useState(false);
 const [loaded,setLoaded]=useState(false);
 useEffect(()=>{const image=new Image();image.onload=()=>setLoaded(true);image.onerror=()=>setFailed(true);image.src=ATLAS;return()=>{image.onload=null;image.onerror=null;};},[]);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');let timer:ReturnType<typeof setTimeout>;
  let stopped=false;
  const schedule=()=>{clearTimeout(timer);setBlink(false);if(stopped||media.matches||document.hidden||!loaded)return;timer=setTimeout(()=>{setBlink(true);timer=setTimeout(()=>{setBlink(false);schedule();},145);},3300+Math.random()*2400);};
  const visibility=()=>schedule();schedule();media.addEventListener('change',visibility);document.addEventListener('visibilitychange',visibility);
  return()=>{stopped=true;clearTimeout(timer);media.removeEventListener('change',visibility);document.removeEventListener('visibilitychange',visibility);};
 },[loaded]);
 if(failed)return <img src="/assets/emma/expressions/emma-happy-v3.png" alt="Emma" style={{width:'100%',height:'100%',objectFit:'contain'}}/>;
 return <button type="button" className={`emma-rig ${expression==='thinking'||expression==='focused'?'emma-rig--thinking':''}`} aria-label="Say hi to Emma" onClick={()=>setGesture(n=>n+1)}>
 <svg viewBox="0 0 600 650" role="img" aria-label="Emma, your animated bestie">
 <defs><clipPath id={clipId}><rect x="217" y="170" width="190" height="78"/></clipPath></defs>
 <g className="emma-rig__left"><Part viewBox="0 785 627 469" x={-25} y={344} width={400} height={299}/></g>
 <g className="emma-rig__right"><g key={gesture} className="emma-rig__wave"><Part viewBox="627 785 627 469" x={330} y={197} width={376} height={281}/></g></g>
 <Part viewBox="0 0 627 785" x={60} y={0} width={480} height={600}/>
 <g opacity={blink?1:0} clipPath={`url(#${clipId})`}><Part viewBox="627 0 627 785" x={93} y={0} width={480} height={600}/></g>
 </svg></button>;
}
