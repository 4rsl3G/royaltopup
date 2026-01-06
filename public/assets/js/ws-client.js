/* global $, toastr, confetti */
(function(){
  let ws=null, retry=0;
  let want={ invoice:null, dashboard:false, whatsapp:false, logs:false };

  function toast(type,msg){
    if (!window.toastr) return alert(msg);
    toastr.options={ closeButton:true, progressBar:true, positionClass:"toast-top-right", timeOut:"2200" };
    toastr[type||'info'](msg);
  }
  function beep(freq=880, ms=110){
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      const ctx=new Ctx(); const o=ctx.createOscillator(); const g=ctx.createGain();
      o.type='sine'; o.frequency.value=freq; o.connect(g); g.connect(ctx.destination);
      g.gain.value=0.06; o.start();
      setTimeout(()=>{ o.stop(); ctx.close(); }, ms);
    }catch(_){}
  }
  function setLive(idDot,idText, ok){
    const dot=document.getElementById(idDot);
    const txt=document.getElementById(idText);
    if (!dot||!txt) return;
    dot.style.background = ok ? 'var(--success)' : 'var(--danger)';
    txt.textContent = ok ? 'LIVE • real-time' : 'OFFLINE • reconnect...';
  }

  function connect(){
    if (ws && (ws.readyState===1 || ws.readyState===0)) return;
    const proto = location.protocol==='https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);

    ws.onopen=()=>{
      retry=0;
      resub();
      setLive('liveDot','liveText', true);
      setLive('dashDot','dashLive', true);
      setLive('logDot','logLive', true);
    };
    ws.onclose=()=>{
      setLive('liveDot','liveText', false);
      setLive('dashDot','dashLive', false);
      setLive('logDot','logLive', false);
      const t=Math.min(15000, 800+retry*900);
      retry++;
      setTimeout(connect,t);
    };
    ws.onerror=()=> ws.close();

    ws.onmessage=(ev)=>{
      let msg={}; try{ msg=JSON.parse(ev.data); }catch{}
      if (!msg.type) return;
      if (msg.type==='invoice') applyInvoice(msg.data);
      if (msg.type==='dashboard') applyDashboard(msg.data);
      if (msg.type==='whatsapp') applyWhatsApp(msg.data);
      if (msg.type==='log') applyLog(msg.data);
    };
  }

  function send(obj){
    if (!ws || ws.readyState!==1) return;
    ws.send(JSON.stringify(obj));
  }

  function resub(){
    send({ type:'unsubAll' });
    if (want.invoice) send({ type:'sub', topic:'invoice', token: want.invoice });
    if (want.dashboard) send({ type:'sub', topic:'dashboard' });
    if (want.whatsapp) send({ type:'sub', topic:'whatsapp' });
    if (want.logs) send({ type:'sub', topic:'logs' });
  }

  // --- invoice ui ---
  let prevPay=null, prevFul=null;
  function applyInvoice(d){
    setLive('liveDot','liveText', true);
    if (!d) return;
    const pay=(d.pay_status||'').toLowerCase();
    const ful=(d.fulfill_status||'').toLowerCase();

    $('#payStatus').text(pay.toUpperCase());
    $('#fulfillStatus').text(ful.toUpperCase());
    $('#adminNote').text(d.admin_note || 'Belum ada catatan.');

    $('.step').removeClass('active');
    if (pay==='pending') $('#stepPay').addClass('active');
    if (pay==='paid') $('#stepPaid').addClass('active');
    if (ful==='processing') $('#stepProc').addClass('active');
    if (ful==='done'||ful==='rejected') $('#stepResult').addClass('active');

    if (d.qr_data_url && pay==='pending'){
      $('#qrImg').attr('src', d.qr_data_url).removeClass('hidden');
      $('#qrMissing').addClass('hidden');
    } else {
      $('#qrImg').addClass('hidden');
      $('#qrMissing').removeClass('hidden');
    }

    if (prevPay!==null && pay!==prevPay){
      if (pay==='paid'){ toast('success','Pembayaran diterima ✅'); beep(980,120); }
      if (['expired','failed','canceled','cancelled'].includes(pay)){
        toast('error', `Pembayaran ${pay.toUpperCase()} ❌`); beep(260,160);
      }
    }
    if (prevFul!==null && ful!==prevFul){
      if (ful==='processing'){ toast('info','Diproses admin ⏳'); beep(740,110); }
      if (ful==='done'){ toast('success','Sukses ✅'); beep(1200,140); try{ confetti?.({particleCount:120,spread:70,origin:{y:.65}});}catch{} }
      if (ful==='rejected'){ toast('error','Ditolak ❌'); beep(260,160); }
    }

    prevPay=pay; prevFul=ful;
  }

  // --- dashboard ui ---
  function applyDashboard(p){
    setLive('dashDot','dashLive', true);
    if (!p) return;
    const s=p.stats||{};
    $('#kTotal').text(s.totalOrders ?? '-');
    $('#kPaid').text(s.paidOrders ?? '-');
    $('#kWait').text(s.waitingPaid ?? '-');
    $('#kProc').text(s.processing ?? '-');
    $('#kDone').text(s.doneOrders ?? '-');
    $('#kRej').text(s.rejected ?? '-');

    const rows=(p.lastOrders||[]).map(o=>[o.order_id,o.product_name,o.qty,o.gross_amount,o.pay_status,o.fulfill_status]);
    if (typeof window.renderDashGrid==='function') window.renderDashGrid(rows);
  }

  // --- whatsapp ui ---
  function applyWhatsApp(d){
    $('#waStatus').text(d?.status||'unknown');
    if (d?.qr){
      $('#waQr').attr('src', d.qr).removeClass('hidden');
      $('#waQrMissing').addClass('hidden');
    } else {
      $('#waQr').addClass('hidden');
      $('#waQrMissing').removeClass('hidden');
    }
  }

  // --- logs ui ---
  function esc(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])); }
  function applyLog(p){
    if (!document.querySelector('[data-logs-page="1"]')) return;
    setLive('logDot','logLive', true);

    const ui = window.__logUI || { paused:false, stick:true, level:'all', q:'', shown:0 };
    if (ui.paused) return;

    const lv=String(p?.level||'info').toLowerCase();
    const msg=String(p?.message||'');
    const t=String(p?.t||'');
    const meta=p?.meta ? JSON.stringify(p.meta,null,2) : '';

    if (ui.level!=='all' && lv!==ui.level) return;
    const hay=(t+' '+lv+' '+msg+' '+meta).toLowerCase();
    if (ui.q && !hay.includes(ui.q)) return;

    const box=document.getElementById('logBox');
    if (!box) return;

    const div=document.createElement('div');
    div.className='logline fx-in';
    div.innerHTML=`
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <span class="lv ${lv}">${lv.toUpperCase()}</span>
        <span class="muted" style="font-weight:950">${esc(t)}</span>
        <span style="font-weight:950">${esc(msg)}</span>
      </div>
      ${meta?`<div class="logmeta">${esc(meta)}</div>`:''}
    `;
    box.appendChild(div);

    // cap
    while (box.children.length>250) box.removeChild(box.firstChild);

    ui.shown=(ui.shown||0)+1;
    const c=document.getElementById('logCount');
    if (c) c.innerHTML=`<i class="ri-list-check-2"></i> ${ui.shown}`;

    if (ui.stick) box.scrollTop=box.scrollHeight;
  }

  window.WSRT = {
    ensure(){ connect(); },
    clear(){ want={ invoice:null, dashboard:false, whatsapp:false, logs:false }; resub(); },
    setInvoice(t){ want={ invoice:t, dashboard:false, whatsapp:false, logs:false }; resub(); },
    setAdminDashboard(){ want={ invoice:null, dashboard:true, whatsapp:false, logs:false }; resub(); },
    setAdminWhatsApp(){ want={ invoice:null, dashboard:false, whatsapp:true, logs:false }; resub(); },
    setAdminLogs(){ want={ invoice:null, dashboard:false, whatsapp:false, logs:true }; resub(); }
  };

  connect();
})();
