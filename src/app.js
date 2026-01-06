import express from 'express';
import session from 'express-session';
import SequelizeStoreInit from 'connect-session-sequelize';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

import { sequelize } from './models/index.js';
import { applySecurity } from './middleware/security.js';
import { logger } from './services/realtime/logger.js';

import spaPublic from './routes/spa.public.js';
import spaAdmin from './routes/spa.admin.js';
import apiPublic from './routes/api.public.js';
import apiAdmin from './routes/api.admin.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export let sessionMiddleware = null;

export async function buildApp(){
  const app = express();

  applySecurity(app);
  app.use(cors({ origin:false }));
  app.use(express.urlencoded({ extended:true }));
  app.use(express.json({ limit:'1mb' }));

  app.use(morgan('tiny'));

  // request log to live logs (non-static only)
  app.use((req,res,next)=>{
    const start = Date.now();
    res.on('finish', ()=>{
      if (req.path.startsWith('/public/')) return;
      logger.info('http', { method:req.method, path:req.path, status:res.statusCode, ms: Date.now()-start });
    });
    next();
  });

  // session
  const SequelizeStore = SequelizeStoreInit(session.Store);
  const store = new SequelizeStore({ db: sequelize, tableName:'sessions' });

  sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:false,
    store,
    cookie:{ httpOnly:true, sameSite:'lax' }
  });
  app.use(sessionMiddleware);

  app.set('view engine','ejs');
  app.set('views', path.join(__dirname,'views'));

  // static
  app.use('/public', express.static(path.join(__dirname,'..','public')));

  // routes
  app.use('/', spaPublic);
  app.use('/', apiPublic);
  app.use('/', spaAdmin);
  app.use('/', apiAdmin);

  // fallback 404 SPA
  app.use((req,res)=> res.status(404).render('shell/public.shell', { title:'Not Found', bodyPartial:'public/notfound.partial', data:{} }));

  await store.sync();
  return app;
}
