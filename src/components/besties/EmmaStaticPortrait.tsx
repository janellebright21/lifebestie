import {useEffect,useState,useSyncExternalStore} from 'react';
import EmmaFullBodyAvatar from './EmmaFullBodyAvatar';
import {getEmmaPortrait,subscribeEmmaPortrait,acquireEmmaPortrait,releaseEmmaPortrait} from './emmaPortraitCache';
/** Tiny repeated icons share one render of the exact current master. */
export default function EmmaStaticPortrait(){
 const state=useSyncExternalStore(subscribeEmmaPortrait,getEmmaPortrait,getEmmaPortrait);const [owns,setOwns]=useState(false);
 useEffect(()=>{if(!owns&&!state.src&&!state.busy&&acquireEmmaPortrait())setOwns(true);},[owns,state.src,state.busy]);
 useEffect(()=>()=>{if(owns)releaseEmmaPortrait();},[owns]);
 return state.src?<img src={state.src} alt="" draggable={false} style={{display:'block',width:'100%',height:'100%',objectFit:'contain'}}/>:<div style={{width:'100%',height:'100%',background:'var(--theme-primary-light,#f5f0fa)'}}>{owns&&<div aria-hidden="true" style={{position:'absolute',width:128,height:128,opacity:0,pointerEvents:'none'}}><EmmaFullBodyAvatar framing="portrait" expression="happy"/></div>}</div>;
}
