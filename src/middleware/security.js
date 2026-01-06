import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

export function applySecurity(app){
  app.use(helmet({
    contentSecurityPolicy:false // karena pakai CDN assets
  }));

  app.use(rateLimit({
    windowMs: 60*1000,
    limit: 180
  }));
}
