let state={src:'',busy:false};const listeners=new Set<()=>void>();
function emit(){for(const fn of listeners)fn();}
export const getEmmaPortrait=()=>state;
export function subscribeEmmaPortrait(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
export function acquireEmmaPortrait(){if(state.src||state.busy)return false;state={...state,busy:true};emit();return true;}
export function releaseEmmaPortrait(){if(!state.busy)return;state={...state,busy:false};emit();}
export function publishEmmaPortrait(src:string){if(state.src)return;state={src,busy:false};emit();}
