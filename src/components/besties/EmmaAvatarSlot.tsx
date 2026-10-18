import {useEffect,useRef,useState} from 'react';
import type {AvatarExpression} from '../../lib/supabase';
import EmmaFullBodyAvatar from './EmmaFullBodyAvatar';
/** Shared current-master slot. Mount only when visible; viewer pauses offscreen. */
export default function EmmaAvatarSlot({expression='happy',framing='portrait'}:{expression?:AvatarExpression;framing?:'full'|'portrait'}) {
 const host=useRef<HTMLDivElement>(null);const [visible,setVisible]=useState(false);
 useEffect(()=>{if(!host.current)return;const observer=new IntersectionObserver(entries=>setVisible(entries.some(e=>e.isIntersecting)),{rootMargin:'48px'});observer.observe(host.current);return()=>observer.disconnect();},[]);
 return <div ref={host} role="img" aria-label="Emma" style={{width:'100%',height:'100%',position:'relative',overflow:'hidden'}}>{visible?<EmmaFullBodyAvatar expression={expression} framing={framing}/>:<div aria-hidden="true" style={{width:'100%',height:'100%',borderRadius:'inherit',background:'var(--theme-primary-light,#f5f0fa)'}}/>}</div>;
}
