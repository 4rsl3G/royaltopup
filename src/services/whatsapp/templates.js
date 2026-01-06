export const tpl = {
  paid: ({order_id, product, qty, total}) =>
`✅ *Pembayaran diterima*
Order: *${order_id}*
Produk: ${product} (x${qty})
Total: Rp ${Number(total).toLocaleString('id-ID')}

⏳ Pesanan kamu akan segera diproses admin.`,

  processing: ({order_id}) =>
`⏳ *Pesanan diproses*
Order: *${order_id}*
Admin sedang mengirim item game. Mohon tunggu ya.`,

  done: ({order_id, note}) =>
`✅ *Pesanan selesai*
Order: *${order_id}*
${note ? `Catatan: ${note}` : ''}

Terima kasih!`,

  rejected: ({order_id, note}) =>
`❌ *Pesanan ditolak*
Order: *${order_id}*
${note ? `Alasan: ${note}` : 'Silakan hubungi admin.'}`,

  otp: ({code}) =>
`🔐 *OTP Reset Password Admin*
Kode OTP: *${code}*
Berlaku 5 menit.`
};
