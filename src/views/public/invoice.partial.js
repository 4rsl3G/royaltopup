<div data-invoice-token="<%= order.invoice_token %>">
  <div class="flex items-start justify-between gap-4">
    <div>
      <div class="h1">Invoice <%= order.order_id %></div>
      <div class="muted mt-1">Pantau status realtime. Tidak perlu refresh.</div>
    </div>
    <div class="status neutral">
      <span class="dot" id="liveDot"></span>
      <span id="liveText">LIVE • real-time</span>
    </div>
  </div>

  <div class="mt-4 grid md:grid-cols-3 gap-4">
    <div class="card md:col-span-2">
      <div class="hd">Status</div>
      <div class="bd">
        <div class="timeline">
          <div class="step active" id="stepPay"><div class="s">Pay</div><div class="v" id="payStatus"><%= order.pay_status.toUpperCase() %></div></div>
          <div class="step" id="stepPaid"><div class="s">Paid</div><div class="v">PAID</div></div>
          <div class="step" id="stepProc"><div class="s">Process</div><div class="v" id="fulfillStatus"><%= order.fulfill_status.toUpperCase() %></div></div>
          <div class="step" id="stepResult"><div class="s">Result</div><div class="v">DONE/REJECT</div></div>
        </div>

        <div class="mt-4">
          <div class="label">Catatan Admin</div>
          <div class="muted" id="adminNote"><%= order.admin_note || 'Belum ada catatan.' %></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="hd">QRIS</div>
      <div class="bd">
        <img id="qrImg" class="<%= qrDataUrl ? '' : 'hidden' %>" src="<%= qrDataUrl || '' %>" style="width:100%;border-radius:14px;border:1px solid var(--border)">
        <div id="qrMissing" class="<%= qrDataUrl ? 'hidden' : '' %> muted">QR hanya tampil saat status PENDING.</div>
        <div class="mt-3 muted text-sm">Jika pembayaran sukses, status akan berubah otomatis.</div>
      </div>
    </div>
  </div>
</div>
