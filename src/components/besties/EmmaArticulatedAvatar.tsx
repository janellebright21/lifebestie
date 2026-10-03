import { useEffect, useState } from 'react';
import type { AvatarExpression } from '../../lib/supabase';
import './EmmaArticulatedAvatar.css';
const ATLAS='/assets/emma/rig/emma-atlas-v1.png';
function Part({column,row,x,y,size}: {column:number;row:number;x:number;y:number;size:number}) {
 return <svg x={x} y={y} width={size} height={size} viewBox={`${column*512} ${row*512} 512 512`} overflow="hidden"><image href={ATLAS} width="1536" height="1024" /></svg>;
}
export default function EmmaArticulatedAvatar({expression='happy'}:{expression?:AvatarExpression}) {
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
 <g className="emma-rig__left"><Part column={0} row={1} x={8} y={302} size={317}/></g>
 <g className="emma-rig__right"><g key={gesture} className="emma-rig__wave"><Part column={1} row={1} x={328} y={210} size={256}/></g></g>
 <g className="emma-rig__head">
 <g opacity={blink?0:1}><Part column={0} row={0} x={100} y={20} size={307}/></g>
 <g opacity={blink?1:0}><Part column={1} row={0} x={118} y={20} size={307}/></g>
 </g>
 <Part column={2} row={0} x={110} y={209} size={358}/>
 </svg></button>;
}
