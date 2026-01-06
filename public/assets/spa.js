(function(){
  const $app = $('#app');

  function toast(type,msg){
    if (!window.toastr) return alert(msg);
    toastr.options={ closeButton:true, progressBar:true, positionClass:"toast-top-right", timeOut:"2200" };
    toastr[type || 'info'](msg);
  }

  function setLoading(on){
    $('#topLoading').toggleClass('hidden', !on);
    if (on && $app.children().length===0){
      $app.html(`
        <div class="fx-in">
          <div class="skel" style="height:18px;width:220px"></div>
          <div class="skel" style="height:14px;width:100%;margin-top:10px"></div>
          <div class="skel" style="height:14px;width:86%;margin-top:10px"></div>
          <div class="skel" style="height:140px;width:100%;margin-top:16px"></div>
        </div>
      `);
    }
  }

  async function load(url, { push=true }={}){
    setLoading(true);
    window.WSRT?.clear?.();

    try{
      const res = await $.getJSON(url);
      if (!res.ok) throw new Error(res.message || 'Gagal load');

      document.title = res.title || document.title;
      $app.html(res.html);
      bindDynamic();

      if (push) history.pushState({ url }, '', url.replace('/p/','?tab=').replace(/^\//,'/'));
    } catch(e){
      toast('error', e.message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  function isAdmin(){
    return location.pathname.split('/').filter(Boolean).length>=1 && $('[data-admin-shell="1"]').length;
  }

  function bindDynamic(){
    window.WSRT?.ensure?.();

    const inv = $('[data-invoice-token]').data('invoice-token');
    if (inv) window.WSRT?.setInvoice?.(inv);

    if ($('[data-dashboard="1"]').length) window.WSRT?.setAdminDashboard?.();
    if ($('[data-wa-page="1"]').length) window.WSRT?.setAdminWhatsApp?.();
    if ($('[data-logs-page="1"]').length) window.WSRT?.setAdminLogs?.();

    // ajax form submit
    $('[data-ajax="1"]').off('submit').on('submit', async function(e){
      e.preventDefault();
      const $f=$(this);
      const action=$f.attr('action');
      const method=($f.attr('method')||'POST').toUpperCase();

      setLoading(true);
      try{
        const resp = await $.ajax({ url:action, method, data:$f.serialize() });
        if (!resp.ok) throw new Error(resp.message||'Gagal');
        if (resp.toast) toast(resp.toast.type, resp.toast.message);
        if (resp.redirect) location.href = resp.redirect;
        if (resp.data?.invoice_url) location.href = resp.data.invoice_url;
      }catch(err){
        toast('error', err.message || 'Gagal');
      }finally{
        setLoading(false);
      }
    });

    // SPA link clicks
    $('[data-spa="1"]').off('click').on('click', function(e){
      e.preventDefault();
      const href = $(this).attr('href');
      // admin tabs use /{adminPath}/p/{tab}
      if (href.includes('/p/')) return load(href);
      location.href = href;
    });
  }

  window.addEventListener('popstate', (ev)=>{
    if (ev.state?.url) load(ev.state.url, { push:false });
  });

  // initial admin tab loader
  $(document).on('click','[data-admin-tab]', function(e){
    e.preventDefault();
    const adminPath = location.pathname.split('/')[1];
    const tab = $(this).data('admin-tab');
    load(`/${adminPath}/p/${tab}`);
  });

  // expose
  window.SPA = { load, toast };

  bindDynamic();
})();
