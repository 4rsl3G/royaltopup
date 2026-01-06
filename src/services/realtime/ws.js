import { WebSocketServer } from 'ws';
import cookie from 'cookie';
import signature from 'cookie-signature';
import QRCode from 'qrcode';
import { bus, EVT } from './bus.js';
import { Order, Deposit } from '../../models/index.js';

function json(ws, payload){
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(payload));
}
const key = (kind,id)=> `${kind}:${id||''}`;

async function invoiceSnap(token){
  const o = await Order.findOne({ where:{ invoice_token:token } });
  if (!o) return null;
  const dep = await Deposit.findOne({ where:{ order_pk:o.id }, order:[['id','DESC']] });
  let qr=null;
  if (o.pay_status==='pending' && dep?.qr_string){
    try{ qr = await QRCode.toDataURL(dep.qr_string); }catch{ qr=null; }
  }
  return {
    order_id:o.order_id,
    invoice_token:o.invoice_token,
    pay_status:o.pay_status,
    fulfill_status:o.fulfill_status,
    admin_note:o.admin_note || null,
    qr_data_url: qr
  };
}

async function dashSnap(){
  const { Order } = await import('../../models/index.js');
  const totalOrders = await Order.count();
  const paidOrders = await Order.count({ where:{ pay_status:'paid' } });
  const waitingPaid = await Order.count({ where:{ pay_status:'paid', fulfill_status:'waiting' } });
  const processing = await Order.count({ where:{ fulfill_status:'processing' } });
  const doneOrders = await Order.count({ where:{ fulfill_status:'done' } });
  const rejected = await Order.count({ where:{ fulfill_status:'rejected' } });
  const lastOrders = await Order.findAll({ order:[['created_at','DESC']], limit:20 });
  return {
    stats:{ totalOrders, paidOrders, waitingPaid, processing, doneOrders, rejected },
    lastOrders:lastOrders.map(o=>({
      order_id:o.order_id, product_name:o.product_name || '',
      qty:o.qty, gross_amount:o.gross_amount, pay_status:o.pay_status, fulfill_status:o.fulfill_status
    }))
  };
}

function extractSid(req, secret){
  const raw = req.headers.cookie || '';
  const parsed = cookie.parse(raw);
  const sid = parsed['connect.sid'];
  if (!sid) return null;
  const decoded = decodeURIComponent(sid);
  if (!decoded.startsWith('s:')) return null;
  const signed = decoded.slice(2);
  const unsigned = signature.unsign(signed, secret);
  return unsigned || null;
}

export function attachWebSocketServer({ server, sessionMiddleware, sessionSecret }){
  const wss = new WebSocketServer({ server, path:'/ws' });

  const topics = new Map(); // topicKey => Set(ws)

  function sub(ws, kind, id){
    const k = key(kind,id);
    if (!topics.has(k)) topics.set(k, new Set());
    topics.get(k).add(ws);
    ws.__topics.add(k);
  }
  function unsubAll(ws){
    for (const k of ws.__topics){
      const set = topics.get(k);
      if (set){ set.delete(ws); if (!set.size) topics.delete(k); }
    }
    ws.__topics.clear();
  }
  function pub(kind,id,payload){
    const set = topics.get(key(kind,id));
    if (!set) return;
    for (const ws of set) json(ws, payload);
  }

  // broadcast events
  bus.on(EVT.ORDER_UPDATED, async ({ order_id, invoice_token })=>{
    if (invoice_token){
      const snap = await invoiceSnap(invoice_token);
      if (snap) pub('invoice', invoice_token, { type:'invoice', data:snap });
    } else if (order_id){
      const o = await Order.findOne({ where:{ order_id } });
      if (o?.invoice_token){
        const snap = await invoiceSnap(o.invoice_token);
        if (snap) pub('invoice', o.invoice_token, { type:'invoice', data:snap });
      }
    }
  });

  let dashTimer=null;
  bus.on(EVT.DASHBOARD_UPDATED, ()=>{
    clearTimeout(dashTimer);
    dashTimer=setTimeout(async ()=>{
      pub('dashboard','main',{ type:'dashboard', data: await dashSnap() });
    }, 200);
  });

  bus.on(EVT.WA_UPDATED, (payload)=> pub('whatsapp','main',{ type:'whatsapp', data:payload }));
  bus.on(EVT.LOG, (payload)=> pub('logs','main',{ type:'log', data:payload }));

  wss.on('connection', (ws, req)=>{
    ws.__topics = new Set();
    ws.__isAdmin = false;

    // attach session to ws
    const sid = extractSid(req, sessionSecret);
    if (sid){
      const fakeRes = { getHeader(){}, setHeader(){}, end(){} };
      sessionMiddleware(req, fakeRes, ()=>{
        ws.__isAdmin = Boolean(req.session?.adminId);
      });
    }

    json(ws, { type:'hello', data:{ admin: ws.__isAdmin, now: Date.now() } });

    ws.on('message', async (raw)=>{
      let msg=null; try{ msg=JSON.parse(raw.toString()); }catch{}
      if (!msg) return;

      if (msg.type==='unsubAll'){ unsubAll(ws); return json(ws,{type:'ok'}); }
      if (msg.type!=='sub') return;

      if (msg.topic==='invoice'){
        const token = String(msg.token||'');
        const snap = await invoiceSnap(token);
        if (!snap) return json(ws,{type:'err',error:'invoice not found'});
        sub(ws,'invoice',token);
        return json(ws,{type:'invoice',data:snap});
      }

      // admin-only
      if (!ws.__isAdmin) return json(ws,{type:'err',error:'admin required'});

      if (msg.topic==='dashboard'){
        sub(ws,'dashboard','main');
        return json(ws,{type:'dashboard',data:await dashSnap()});
      }
      if (msg.topic==='whatsapp'){
        sub(ws,'whatsapp','main');
        return json(ws,{type:'whatsapp',data:{status:'unknown',qr:null}});
      }
      if (msg.topic==='logs'){
        sub(ws,'logs','main');
        return json(ws,{type:'log',data:{t:'',level:'info',message:'logs subscribed',meta:null}});
      }
    });

    ws.on('close', ()=> unsubAll(ws));
  });

  return wss;
}
