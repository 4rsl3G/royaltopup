export function normalizeIDPhoneToE16462(raw){
  let s = String(raw||'').trim();
  s = s.replace(/[^\d+]/g,'');
  if (s.startsWith('+')) s = s.slice(1);

  if (s.startsWith('0')) s = '62' + s.slice(1);
  if (s.startsWith('62')) return s;
  // fallback: assume already number
  return s;
}

export function normalizeE164ToWAJid(e164){
  const p = String(e164||'');
  return `${p}@s.whatsapp.net`;
}
