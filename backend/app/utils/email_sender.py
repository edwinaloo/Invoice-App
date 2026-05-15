from flask_mail import Message
from app import mail
from app.utils.pdf_generator import generate_invoice_pdf


def send_invoice_email(invoice, business_profile):
    profile = business_profile.to_dict()
    sender_name = profile["business_name"] or "InvoiceApp"
    subject = f"Invoice {invoice.invoice_number} from {sender_name}"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Inter, Arial, sans-serif; background:#f9fafb; padding: 32px;">
      <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px;
                  border:1px solid #e5e7eb; overflow:hidden;">
        <div style="background:#4F46E5; padding:24px 32px;">
          <h1 style="color:#fff; margin:0; font-size:20px;">{sender_name}</h1>
        </div>
        <div style="padding:32px;">
          <p style="color:#374151; font-size:15px; margin-top:0;">
            Hi {invoice.client.name},
          </p>
          <p style="color:#6b7280; font-size:14px; line-height:1.6;">
            Please find your invoice attached to this email.
            Your payment of <strong style="color:#111827;">
              {profile['currency']} {float(invoice.total):,.2f}
            </strong> is due by <strong style="color:#111827;">
              {invoice.due_date.strftime('%B %d, %Y')}
            </strong>.
          </p>
          <table style="width:100%; border-collapse:collapse; margin:24px 0;
                        font-size:14px; color:#374151;">
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:8px 0; color:#6b7280;">Invoice #</td>
              <td style="padding:8px 0; text-align:right; font-weight:600;">
                {invoice.invoice_number}
              </td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:8px 0; color:#6b7280;">Issue Date</td>
              <td style="padding:8px 0; text-align:right;">
                {invoice.issue_date.strftime('%B %d, %Y')}
              </td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:8px 0; color:#6b7280;">Due Date</td>
              <td style="padding:8px 0; text-align:right;">
                {invoice.due_date.strftime('%B %d, %Y')}
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0; font-weight:700; font-size:16px;">Total Due</td>
              <td style="padding:12px 0; text-align:right; font-weight:700;
                         font-size:16px; color:#4F46E5;">
                {profile['currency']} {float(invoice.total):,.2f}
              </td>
            </tr>
          </table>
          {f'<p style="color:#6b7280; font-size:13px; border-top:1px solid #f3f4f6; padding-top:16px;">{invoice.notes}</p>' if invoice.notes else ''}
          <p style="color:#9ca3af; font-size:12px; margin-bottom:0; margin-top:24px;">
            If you have any questions, reply to this email or contact us at
            {profile.get('business_email', '') or 'our office'}.
          </p>
        </div>
      </div>
    </body>
    </html>
    """

    pdf_bytes = generate_invoice_pdf(invoice, profile)

    msg = Message(
        subject=subject,
        recipients=[invoice.client.email],
        html=html_body,
    )
    msg.attach(
        filename=f"{invoice.invoice_number}.pdf",
        content_type="application/pdf",
        data=pdf_bytes,
    )
    mail.send(msg)
