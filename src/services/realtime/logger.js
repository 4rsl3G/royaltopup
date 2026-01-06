import { bus, EVT } from './bus.js';

function ts(){
  const d=new Date(); const p=(n)=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function mask(obj){
  if (!obj || typeof obj!=='object') return obj;
  for (const k of Object.keys(obj)){
    if (/key|secret|token|password/i.test(k)) obj[k]='[masked]';
    else if (typeof obj[k]==='object') mask(obj[k]);
  }
  return obj;
}
export const logger = {
  info:(m,meta)=> bus.emit(EVT.LOG,{t:ts(),level:'info',message:String(m),meta: meta?mask(JSON.parse(JSON.stringify(meta))):null}),
  warn:(m,meta)=> bus.emit(EVT.LOG,{t:ts(),level:'warn',message:String(m),meta: meta?mask(JSON.parse(JSON.stringify(meta))):null}),
  error:(m,meta)=> bus.emit(EVT.LOG,{t:ts(),level:'error',message:String(m),meta: meta?mask(JSON.parse(JSON.stringify(meta))):null}),
  debug:(m,meta)=> bus.emit(EVT.LOG,{t:ts(),level:'debug',message:String(m),meta: meta?mask(JSON.parse(JSON.stringify(meta))):null})
};
