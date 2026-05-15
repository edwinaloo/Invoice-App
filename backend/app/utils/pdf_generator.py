from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, Image,
)
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
import requests as http
import io

BRAND_COLOR = colors.HexColor("#4F46E5")
GRAY = colors.HexColor("#6B7280")
LIGHT_GRAY = colors.HexColor("#F3F4F6")
DARK = colors.HexColor("#111827")

STATUS_COLORS = {
    "paid": colors.HexColor("#10B981"),
    "sent": colors.HexColor("#3B82F6"),
    "draft": colors.HexColor("#6B7280"),
    "overdue": colors.HexColor("#EF4444"),
}


def _fetch_logo(logo_url: str):
    try:
        resp = http.get(logo_url, timeout=5)
        resp.raise_for_status()
        img = Image(io.BytesIO(resp.content), width=40 * mm, height=14 * mm)
        img.hAlign = "LEFT"
        return img
    except Exception:
        return None


def generate_invoice_pdf(invoice, business_profile: dict | None = None) -> bytes:
    profile = business_profile or {}
    biz_name = profile.get("business_name") or "My Business"
    biz_email = profile.get("business_email") or ""
    biz_phone = profile.get("business_phone") or ""
    biz_address = profile.get("business_address") or ""
    logo_url = profile.get("logo_url") or ""
    currency = profile.get("currency") or "USD"

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=15 * mm, leftMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
    )
    story = []

    # --- Business header (left) + Invoice meta (right) ---
    logo = _fetch_logo(logo_url) if logo_url else None
    biz_lines = biz_name
    if biz_email:
        biz_lines += f"<br/><font size='9' color='gray'>{biz_email}</font>"
    if biz_phone:
        biz_lines += f"<br/><font size='9' color='gray'>{biz_phone}</font>"
    if biz_address:
        biz_lines += f"<br/><font size='9' color='gray'>{biz_address}</font>"

    left_cell = logo if logo else Paragraph(
        f"<b><font size='16' color='#4F46E5'>{biz_name}</font></b>"
        + (f"<br/><font size='9' color='gray'>{biz_email}</font>" if biz_email else "")
        + (f"<br/><font size='9' color='gray'>{biz_phone}</font>" if biz_phone else "")
        + (f"<br/><font size='9' color='gray'>{biz_address}</font>" if biz_address else ""),
        ParagraphStyle("biz", fontSize=16, textColor=BRAND_COLOR),
    )

    right_cell = Paragraph(
        f"<b><font size='20'>INVOICE</font></b><br/>"
        f"<font size='10' color='gray'>{invoice.invoice_number}</font><br/>"
        f"<font size='9' color='gray'>Issued: {invoice.issue_date.strftime('%B %d, %Y')}</font><br/>"
        f"<font size='9' color='gray'>Due: {invoice.due_date.strftime('%B %d, %Y')}</font>",
        ParagraphStyle("inv", fontSize=20, textColor=BRAND_COLOR, alignment=TA_RIGHT),
    )

    header_table = Table([[left_cell, right_cell]], colWidths=[90 * mm, 90 * mm])
    header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(header_table)
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=2, color=BRAND_COLOR))
    story.append(Spacer(1, 6 * mm))

    # --- Bill To + Status badge ---
    client = invoice.client
    bill_to = (
        f"<b>Bill To</b><br/>"
        f"{client.name}<br/>"
        + (f"{client.company}<br/>" if client.company else "")
        + f"{client.email}<br/>"
        + (f"{client.phone}<br/>" if client.phone else "")
        + (client.address or "")
    )
    status_color = STATUS_COLORS.get(invoice.status, GRAY)
    status_badge = Paragraph(
        f"<b>{invoice.status.upper()}</b>",
        ParagraphStyle(
            "badge", fontSize=11, textColor=colors.white, backColor=status_color,
            alignment=TA_CENTER, borderPadding=(4, 10, 4, 10),
        ),
    )
    bill_table = Table([[Paragraph(bill_to, ParagraphStyle("bt", fontSize=10, leading=16)), status_badge]],
                       colWidths=[120 * mm, 60 * mm])
    bill_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(bill_table)
    story.append(Spacer(1, 10 * mm))

    # --- Line items ---
    item_rows = [["Description", "Qty", "Unit Price", "Amount"]]
    for item in invoice.items:
        item_rows.append([
            item.description,
            str(float(item.quantity)),
            f"{currency} {float(item.unit_price):,.2f}",
            f"{currency} {float(item.amount):,.2f}",
        ])

    item_table = Table(item_rows, colWidths=[95 * mm, 20 * mm, 30 * mm, 35 * mm])
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("LINEBELOW", (0, -1), (-1, -1), 1, BRAND_COLOR),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 6 * mm))

    # --- Totals ---
    totals_data = [
        ["Subtotal", f"{currency} {float(invoice.subtotal):,.2f}"],
        [f"Tax ({float(invoice.tax_rate):.1f}%)", f"{currency} {float(invoice.tax_amount):,.2f}"],
        ["", ""],
        ["TOTAL DUE", f"{currency} {float(invoice.total):,.2f}"],
    ]
    totals_table = Table(totals_data, colWidths=[130 * mm, 50 * mm])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, 2), GRAY),
        ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold"),
        ("FONTSIZE", (0, 3), (-1, 3), 13),
        ("TEXTCOLOR", (0, 3), (-1, 3), BRAND_COLOR),
        ("LINEABOVE", (0, 3), (-1, 3), 1, BRAND_COLOR),
        ("TOPPADDING", (0, 3), (-1, 3), 6),
    ]))
    story.append(totals_table)

    # --- Notes ---
    if invoice.notes:
        story.append(Spacer(1, 10 * mm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_GRAY))
        story.append(Spacer(1, 4 * mm))
        story.append(Paragraph("<b>Notes</b>", ParagraphStyle("nb", fontSize=10, textColor=DARK)))
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(invoice.notes, ParagraphStyle("n", fontSize=9, textColor=GRAY, leading=14)))

    # --- Footer ---
    story.append(Spacer(1, 15 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_GRAY))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        f"Thank you for your business. — {biz_name}",
        ParagraphStyle("footer", fontSize=9, textColor=GRAY, alignment=TA_CENTER),
    ))

    doc.build(story)
    return buffer.getvalue()
