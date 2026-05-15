import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getInvoice,
  deleteInvoice,
  updateInvoiceStatus,
  downloadInvoicePdf,
  createCheckoutSession,
  verifyPayment,
  sendInvoiceEmail,
  shareInvoice,
} from "../api/invoices";
import type { Invoice, InvoiceStatus } from "../types";
import StatusBadge from "../components/StatusBadge";
import { format } from "date-fns";

const ALL_STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailBanner, setEmailBanner] = useState<"sent" | "error" | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentBanner, setPaymentBanner] = useState<"success" | "failed" | "cancelled" | null>(null);
  const [paymentError, setPaymentError] = useState("");

  // Load invoice
  useEffect(() => {
    getInvoice(Number(id))
      .then(setInvoice)
      .finally(() => setLoading(false));
  }, [id]);

  // Auto-verify when Paystack redirects back with ?reference=
  useEffect(() => {
    const reference = searchParams.get("reference");
    if (!reference || !id) return;

    setVerifying(true);
    setSearchParams({}, { replace: true }); // strip the query param immediately

    verifyPayment(Number(id), reference)
      .then((result) => {
        if (result.paid && result.invoice) {
          setInvoice(result.invoice as Invoice);
          setPaymentBanner("success");
        } else {
          setPaymentBanner("failed");
        }
      })
      .catch(() => setPaymentBanner("failed"))
      .finally(() => setVerifying(false));
  }, []); // run once on mount

  // Auto-dismiss banner after 6 seconds
  useEffect(() => {
    if (!paymentBanner) return;
    const timer = setTimeout(() => setPaymentBanner(null), 6000);
    return () => clearTimeout(timer);
  }, [paymentBanner]);

  const handleStatusChange = async (status: InvoiceStatus) => {
    if (!invoice) return;
    const updated = await updateInvoiceStatus(invoice.id, status);
    setInvoice((prev) => (prev ? { ...prev, ...updated } : null));
  };

  const handleDelete = async () => {
    if (!invoice || !confirm("Delete this invoice?")) return;
    await deleteInvoice(invoice.id);
    navigate("/invoices");
  };

  const handleShare = async () => {
    if (!invoice) return;
    setShareLoading(true);
    try {
      const { url } = await shareInvoice(invoice.id);
      setPortalUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
    } finally {
      setShareLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!invoice) return;
    setEmailLoading(true);
    setEmailBanner(null);
    try {
      await sendInvoiceEmail(invoice.id);
      setEmailBanner("sent");
      if (invoice.status === "draft") {
        setInvoice((prev) => (prev ? { ...prev, status: "sent" } : null));
      }
    } catch {
      setEmailBanner("error");
    } finally {
      setEmailLoading(false);
      setTimeout(() => setEmailBanner(null), 5000);
    }
  };

  const handleCollectPayment = async () => {
    if (!invoice) return;
    setPaymentLoading(true);
    setPaymentError("");
    try {
      const { url } = await createCheckoutSession(invoice.id);
      window.open(url, "_blank", "noopener,noreferrer");
      if (invoice.status === "draft") {
        setInvoice((prev) => (prev ? { ...prev, status: "sent" } : null));
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Could not create payment session. Check your Paystack key.";
      setPaymentError(msg);
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!invoice) return <div className="p-8 text-gray-400">Invoice not found.</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">

      {/* Verification in progress */}
      {verifying && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-5 py-3.5 flex items-center gap-3">
          <span className="animate-spin inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          <p className="text-sm font-medium">Verifying payment with Paystack…</p>
        </div>
      )}

      {/* Payment result banners */}
      {paymentBanner === "success" && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-5 py-3.5 flex items-center gap-3">
          <span className="text-xl">✓</span>
          <div>
            <p className="font-semibold text-sm">Payment confirmed!</p>
            <p className="text-xs text-emerald-600">
              This invoice has been marked as paid.
            </p>
          </div>
        </div>
      )}
      {paymentBanner === "failed" && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3.5 text-sm">
          Payment could not be verified. Please check your Paystack dashboard.
        </div>
      )}
      {paymentBanner === "cancelled" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-3.5 text-sm">
          Payment was cancelled. You can try again anytime.
        </div>
      )}
      {portalUrl && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl px-5 py-4 space-y-3">
          <p className="text-sm font-semibold text-brand-700">🔗 Client Portal Link</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={portalUrl}
              className="flex-1 text-xs bg-white border border-brand-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(portalUrl).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 3000);
                });
              }}
              className={`text-xs px-3 py-2 rounded-lg transition-colors font-medium ${
                copied
                  ? "bg-emerald-500 text-white"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          {copied && (
            <p className="text-xs text-emerald-600 font-medium">
              Link copied — paste it into an email or message to your client.
            </p>
          )}
          {!copied && (
            <p className="text-xs text-brand-500">
              Share this link with your client — they can view the invoice and pay directly without logging in.
            </p>
          )}
        </div>
      )}
      {emailBanner === "sent" && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-5 py-3.5 text-sm font-medium">
          ✉️ Invoice emailed to {invoice.client?.email}
        </div>
      )}
      {emailBanner === "error" && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3.5 text-sm">
          Could not send email. Check your MAIL_USERNAME and MAIL_PASSWORD in backend/.env.
        </div>
      )}
      {paymentError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3.5 text-sm">
          {paymentError}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/invoices" className="text-sm text-gray-400 hover:text-gray-600">
            ← Back to Invoices
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{invoice.invoice_number}</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
              onClick={handleShare}
              disabled={shareLoading}
              className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {shareLoading ? "Generating…" : "🔗 Share Link"}
            </button>
          <button
              onClick={handleSendEmail}
              disabled={emailLoading}
              className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {emailLoading ? (
                <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full" />Sending…</>
              ) : <>✉️ Send Email</>}
            </button>
          {invoice.status !== "paid" && (
            <button
              onClick={handleCollectPayment}
              disabled={paymentLoading || verifying}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {paymentLoading ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  Opening…
                </>
              ) : (
                <>💳 Collect Payment</>
              )}
            </button>
          )}
          <button
            onClick={async () => {
              setPdfLoading(true);
              try {
                await downloadInvoicePdf(invoice.id, `${invoice.invoice_number}.pdf`);
              } finally {
                setPdfLoading(false);
              }
            }}
            disabled={pdfLoading}
            className="flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 text-sm font-medium text-gray-700 px-4 py-2 rounded-lg transition-colors"
          >
            {pdfLoading ? "Generating…" : "⬇ Download PDF"}
          </button>
          <Link
            to={`/invoices/${invoice.id}/edit`}
            className="border border-brand-600 text-brand-600 hover:bg-brand-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Info cards */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 grid grid-cols-3 gap-6">
        <div>
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Client</p>
          <p className="font-semibold text-gray-900">{invoice.client?.name}</p>
          {invoice.client?.company && (
            <p className="text-sm text-gray-500">{invoice.client.company}</p>
          )}
          <p className="text-sm text-gray-500">{invoice.client?.email}</p>
          {invoice.client?.phone && (
            <p className="text-sm text-gray-500">{invoice.client.phone}</p>
          )}
          {invoice.client?.address && (
            <p className="text-sm text-gray-500 whitespace-pre-line">{invoice.client.address}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Dates</p>
          <p className="text-sm text-gray-700">
            <span className="text-gray-400">Issued:</span>{" "}
            {format(new Date(invoice.issue_date), "MMM d, yyyy")}
          </p>
          <p className="text-sm text-gray-700 mt-1">
            <span className="text-gray-400">Due:</span>{" "}
            {format(new Date(invoice.due_date), "MMM d, yyyy")}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase font-medium mb-2">Status</p>
          <StatusBadge status={invoice.status} />
          <div className="mt-3">
            <label className="text-xs text-gray-500 block mb-1">Update status</label>
            <select
              value={invoice.status}
              onChange={(e) => handleStatusChange(e.target.value as InvoiceStatus)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-white uppercase bg-brand-600">
              <th className="px-6 py-3 font-medium">Description</th>
              <th className="px-6 py-3 font-medium text-right">Qty</th>
              <th className="px-6 py-3 font-medium text-right">Unit Price</th>
              <th className="px-6 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(invoice.items ?? []).map((item, i) => (
              <tr key={item.id ?? i} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-gray-700">{item.description}</td>
                <td className="px-6 py-3 text-right text-gray-600">{item.quantity}</td>
                <td className="px-6 py-3 text-right text-gray-600">{fmt(item.unit_price)}</td>
                <td className="px-6 py-3 text-right font-medium text-gray-900">
                  {fmt(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{fmt(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Tax ({invoice.tax_rate}%)</span>
              <span>{fmt(invoice.tax_amount)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg text-brand-600 border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>{fmt(invoice.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs text-gray-500 uppercase font-medium mb-2">Notes</p>
          <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}

    </div>
  );
}
