import type {IdleGesture} from './emmaRigMotion';
import EmmaFullBodyAvatar from './EmmaFullBodyAvatar';
type Props={moving:boolean;reduced:boolean;greeting:boolean;gesture:IdleGesture|null;onReady:()=>void;onWaveComplete:()=>void;onIdleComplete:()=>void};
/** Compatibility entry: the retired atlas is never rendered. */
export default function EmmaRigCanvas(_props:Props){return <EmmaFullBodyAvatar/>;}
