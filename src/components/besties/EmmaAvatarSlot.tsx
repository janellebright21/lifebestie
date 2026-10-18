import {useEffect,useRef,useState} from 'react';
import type {AvatarExpression} from '../../lib/supabase';
import EmmaFullBodyAvatar from './EmmaFullBodyAvatar';
import EmmaStaticPortrait from './EmmaStaticPortrait';
/** Shared current-master slot, mounted only while visible. */
export default function EmmaAvatarSlot({expression='happy',framing='portrait'}:{expression?:AvatarExpression;framing?:'full'|'portrait'}) {
 const host=useRef<HTMLDivElement>(null);const [visible,setVisible]=useState(false);const [tiny,setTiny]=useState(true);
 useEffect(()=>{const el=host.current;if(!el)return;const observer=new IntersectionObserver(entries=>setVisible(entries.some(e=>e.isIntersecting)),{rootMargin:'48px'});const resize=new ResizeObserver(()=>setTiny(el.clientWidth<=56));setTiny(el.clientWidth<=56);resize.observe(el);observer.observe(el);return()=>{observer.disconnect();resize.disconnect();};},[]);
 return <div ref={host} role="img" aria-label="Emma" style={{width:'100%',height:'100%',position:'relative',overflow:'hidden'}}>{visible?(tiny&&framing==='portrait'?<EmmaStaticPortrait/>:<EmmaFullBodyAvatar expression={expression} framing={framing}/>):<div aria-hidden="true" style={{width:'100%',height:'100%',borderRadius:'inherit',background:'var(--theme-primary-light,#f5f0fa)'}}/>}</div>;
}
