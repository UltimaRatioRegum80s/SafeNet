import { useLocation } from "wouter";
import { Home, Plus, MapPin, MessageSquare, Building2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
const items = [
 {key:"home",label:"Home",to:"/",icon:Home},
 {key:"map",label:"Map",to:"/community/map",icon:MapPin},
 {key:"report",label:"Report",to:"/community/report",icon:Plus},
 {key:"feed",label:"Feed",to:"/community/feed",icon:MessageSquare},
 {key:"services",label:"Services",to:"/community/services",icon:Building2},
];
function hrefFor(to:string) {
 const shared=["/community/map","/community/feed"];
 if (!shared.includes(window.location.pathname) || !shared.includes(to)) return to;
 const source=new URLSearchParams(window.location.search), query=new URLSearchParams();
 ["radiusKm","sinceHours","group"].forEach(k=>{const v=source.get(k);if(v)query.set(k,v)});
 return to+(query.size?"?"+query.toString():"");
}
export default function MobileFloatingTopMenu({hiddenBySheet=false}:{hiddenBySheet?:boolean}) {
 const [location,navigate]=useLocation(); const reduce=useReducedMotion();
 if(hiddenBySheet) return null;
 return <nav className="nn-dock" aria-label="Mobile navigation">{items.map(({key,label,to,icon:Icon})=>{
 const active=key==="home"?["/","/community","/community/dashboard"].includes(location):location.startsWith(to);
 return <a key={key} href={hrefFor(to)} data-testid={"nav-"+key} aria-label={"Open "+label+" page"} aria-current={active?"page":undefined} className={"nn-dock-item "+(key==="report"?"nn-dock-report":"")+(active?" is-active":"")} onClick={e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate(hrefFor(to))}}>
 {active&&key!=="report"&&<motion.span className="nn-dock-indicator" layoutId="nn-dock-active" transition={reduce?{duration:0}:{type:"spring",stiffness:420,damping:34}}/>}
 <span className="nn-dock-icon"><Icon size={21} strokeWidth={active?2.3:1.8}/></span><span>{label}</span></a>})}</nav>;
}
