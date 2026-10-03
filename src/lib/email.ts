import nodemailer from 'nodemailer'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReceiptEmailData {
  to: string
  order: {
    orderNumber: string
    createdAt: string | Date
    items: { productName: string; quantity: number; price: number; subtotal: number }[]
    subtotal: number
    discount: number
    discountType?: string
    tax: number
    taxPercentage: number
    total: number
    paymentMethod: string
    paymentStatus: string
    cashAmount?: number
    changeAmount?: number
    customerName?: string
    tableName?: string
    notes?: string
  }
  store: {
    name: string
    address?: string
    phone?: string
    email?: string
    logo?: string
    receiptFooter?: string
    currency?: string
    currencySymbol?: string
  }
  smtp: {
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
    fromName: string
    fromEmail: string
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrencyPlain(amount: number, symbol = 'Rp'): string {
  return `${symbol} ${amount.toLocaleString('id-ID')}`
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function paymentMethodLabel(method: string): string {
  if (method === 'CASH') return 'Tunai'
  if (method === 'MIDTRANS') return 'Midtrans (QRIS/Transfer)'
  return method
}

// ── HTML Template ─────────────────────────────────────────────────────────────

function buildReceiptHtml(data: ReceiptEmailData): string {
  const { order, store } = data
  const sym = store.currencySymbol || 'Rp'
  const fmt = (n: number) => formatCurrencyPlain(n, sym)

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top;">
          <span style="font-weight:600;color:#1a1a2e;">${item.productName}</span>
          <span style="display:block;font-size:12px;color:#888;margin-top:2px;">× ${item.quantity} @ ${fmt(item.price)}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;vertical-align:top;font-weight:600;color:#1a1a2e;">
          ${fmt(item.subtotal)}
        </td>
      </tr>`
    )
    .join('')

  const discountRow =
    order.discount > 0
      ? `<tr>
          <td style="padding:6px 0;color:#22c55e;font-size:13px;">Diskon</td>
          <td style="padding:6px 0;text-align:right;color:#22c55e;font-size:13px;font-weight:600;">− ${fmt(order.discount)}</td>
        </tr>`
      : ''

  const taxRow =
    order.tax > 0
      ? `<tr>
          <td style="padding:6px 0;color:#888;font-size:13px;">Pajak (${order.taxPercentage}%)</td>
          <td style="padding:6px 0;text-align:right;color:#888;font-size:13px;">+ ${fmt(order.tax)}</td>
        </tr>`
      : ''

  const cashRow =
    order.paymentMethod === 'CASH' && order.cashAmount
      ? `<tr>
          <td colspan="2" style="padding-top:16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:4px 0;color:#888;font-size:13px;">Uang Diterima</td>
                <td style="padding:4px 0;text-align:right;color:#888;font-size:13px;">${fmt(order.cashAmount)}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;color:#888;font-size:13px;">Kembalian</td>
                <td style="padding:4px 0;text-align:right;color:#888;font-size:13px;">${fmt(order.changeAmount ?? 0)}</td>
              </tr>
            </table>
          </td>
        </tr>`
      : ''

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Struk Pembayaran — ${store.name}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

        <!-- Header gradient -->
        <tr>
          <td style="background:linear-gradient(135deg,#6c3de8 0%,#4f8ef7 100%);padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">${store.name}</h1>
            ${store.address ? `<p style="margin:6px 0 0;color:rgba(255,255,255,.75);font-size:13px;">${store.address}</p>` : ''}
            ${store.phone ? `<p style="margin:4px 0 0;color:rgba(255,255,255,.75);font-size:13px;">☎ ${store.phone}</p>` : ''}
          </td>
        </tr>

        <!-- Receipt badge -->
        <tr>
          <td style="background:#f8f5ff;padding:20px 40px;text-align:center;border-bottom:2px dashed #e8e0ff;">
            <span style="display:inline-block;background:#6c3de8;color:#fff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:6px 20px;border-radius:999px;">Struk Pembayaran</span>
            <p style="margin:10px 0 0;font-size:22px;font-weight:800;color:#1a1a2e;letter-spacing:1px;">#${order.orderNumber}</p>
            <p style="margin:6px 0 0;font-size:13px;color:#888;">${formatDate(order.createdAt)}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">

            ${order.customerName || order.tableName ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#f8f5ff;border-radius:12px;padding:16px;">
              <tr><td>
                ${order.customerName ? `<p style="margin:0;font-size:13px;color:#888;">Pelanggan: <strong style="color:#1a1a2e;">${order.customerName}</strong></p>` : ''}
                ${order.tableName ? `<p style="margin:${order.customerName ? '4px' : '0'} 0 0;font-size:13px;color:#888;">Meja: <strong style="color:#1a1a2e;">${order.tableName}</strong></p>` : ''}
              </td></tr>
            </table>` : ''}

            <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#aaa;">Pesanan</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${itemsHtml}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
              <tr>
                <td style="padding:6px 0;color:#888;font-size:13px;">Subtotal</td>
                <td style="padding:6px 0;text-align:right;color:#555;font-size:13px;">${fmt(order.subtotal)}</td>
              </tr>
              ${discountRow}
              ${taxRow}
              <tr>
                <td colspan="2" style="padding-top:4px;"><div style="border-top:2px solid #f0f0f0;"></div></td>
              </tr>
              <tr>
                <td style="padding:14px 0 0;font-size:17px;font-weight:800;color:#1a1a2e;">TOTAL</td>
                <td style="padding:14px 0 0;text-align:right;font-size:22px;font-weight:800;color:#6c3de8;">${fmt(order.total)}</td>
              </tr>
              ${cashRow}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#f8f5ff;border-radius:12px;padding:16px;">
              <tr>
                <td style="font-size:13px;color:#888;">Metode Pembayaran</td>
                <td style="text-align:right;font-size:13px;font-weight:700;color:#6c3de8;">${paymentMethodLabel(order.paymentMethod)}</td>
              </tr>
            </table>

            ${order.notes ? `<p style="margin:12px 0 0;font-size:13px;color:#888;font-style:italic;">Catatan: ${order.notes}</p>` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f5ff;padding:24px 40px;text-align:center;border-top:2px dashed #e8e0ff;">
            <p style="margin:0;font-size:15px;font-weight:700;color:#6c3de8;">
              ${store.receiptFooter || 'Terima kasih atas kunjungan Anda! 🙏'}
            </p>
            ${store.email ? `<p style="margin:8px 0 0;font-size:12px;color:#aaa;">${store.email}</p>` : ''}
            <p style="margin:12px 0 0;font-size:11px;color:#ccc;">Email ini dikirim otomatis. Simpan sebagai bukti pembayaran Anda.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Send receipt email to customer using SMTP config from DB.
 */
export async function sendReceiptEmail(data: ReceiptEmailData): Promise<boolean> {
  const { smtp } = data

  if (!smtp.host || !smtp.user || !smtp.pass) {
    console.log('[email] SMTP not configured in settings — skipping receipt email')
    return false
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  })

  const fromName = smtp.fromName || data.store.name
  const fromEmail = smtp.fromEmail || smtp.user

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: data.to,
      subject: `Struk Pembayaran #${data.order.orderNumber} — ${data.store.name}`,
      html: buildReceiptHtml(data),
    })
    console.log(`[email] Receipt sent to ${data.to} for order ${data.order.orderNumber}`)
    return true
  } catch (err) {
    console.error('[email] Failed to send receipt:', err)
    return false
  }
}

/**
 * Build SMTP config from settings document.
 */
export function buildSmtpFromSettings(settings: Record<string, unknown>) {
  return {
    host: (settings.smtpHost as string) || '',
    port: (settings.smtpPort as number) || 587,
    secure: (settings.smtpSecure as boolean) || false,
    user: (settings.smtpUser as string) || '',
    pass: (settings.smtpPass as string) || '',
    fromName: (settings.smtpFromName as string) || (settings.storeName as string) || 'POS Kasir',
    fromEmail: (settings.smtpFromEmail as string) || '',
  }
}
