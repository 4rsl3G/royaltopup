import { getSetting } from '../services/settings.js';

export async function requireAdmin(req,res,next){
  if (!req.session?.adminId) return res.redirect(`/${req.params.adminPath}?tab=login`);
  // enforce single admin by allowed_admin_id in DB
  const allowed = await getSetting('allowed_admin_id', null);
  if (allowed && String(req.session.adminId) !== String(allowed)){
    req.session.destroy(()=>{});
    return res.status(403).send('Forbidden');
  }
  next();
}
