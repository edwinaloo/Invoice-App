import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { format } from "date-fns";
import type { Invoice, BusinessProfile } from "../types";

const publicApi = axios.create({ baseURL: "/api/public" });

function fmt(n: number, currency = "KES") {
  return `${currency} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

type PaymentState = "idle" | "loading" | "verifying" | "success" | "failed";

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [payState, setPayState] = useState<PaymentState>("idle");
  const [payError, setPayError] = useState("");

  useEffect(() => {
    if (!token) return;
    publicApi.get(`/invoices/${token}`)
      .then((r) => {
        setInvoice(r.data.invoice);
        setBusiness(r.data.business);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  // Auto-verify when Paystack redirects back
  useEffect(() => {
    const reference = searchParams.get("reference");
    if (!reference || !token) return;
    setPayState("verifying");
    setSearchParams({}, { replace: true });

    publicApi.post(`/invoices/${token}/verify-payment`, { reference })
      .then((r) => {
        if (r.data.paid) {
          setPayState("success");
          setInvoice((prev) => (prev ? { ...prev, status: "paid" } : null));
        } else {
          setPayState("failed");
        }
      })
      .catch(() => setPayState("failed"));
  }, []);

  const handlePay = async () => {
    if (!token) return;
    setPayState("loading");
    setPayError("");
    try {
      const r = await publicApi.post(`/invoices/${token}/checkout`);
      window.location.href = r.data.url;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Could not initiate payment. Please try again.";
      setPayError(msg);
      setPayState("idle");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound || !invoice || !business) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-5xl mb-4">🔍</p>
          <h1 className="text-xl font-bold text-gray-800">Invoice not found</h1>
          <p className="text-gray-500 mt-2 text-sm">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  const currency = business.currency || "KES";
  const isPaid = invoice.status === "paid";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-brand-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Business header */}
        <div className="text-center">
          {business.logo_url ? (
            <img src={business.logo_url} alt="Logo" className="h-12 object-contain mx-auto mb-3" />
          ) : (
            <div className="text-2xl font-bold text-brand-600 mb-1">{business.business_name}</div>
          )}
          {business.business_email && (
            <p className="text-sm text-gray-500">{business.business_email}</p>
          )}
        </div>

        {/* Payment state banners */}
        {payState === "verifying" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center gap-3 text-blue-800">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
            <p className="text-sm font-medium">Verifying your payment…</p>
          </div>
        )}
        {payState === "success" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 text-emerald-800">
            <p className="font-semibold text-sm">✓ Payment confirmed — Thank you!</p>
            <p className="text-xs mt-0.5 text-emerald-600">Your payment has been received and this invoice is now marked as paid.</p>
          </div>
        )}
        {payState === "failed" && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm">
            Payment could not be verified. Please contact the sender if you believe this is an error.
          </div>
        )}
        {payError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3.5 text-red-700 text-sm">
            {payError}
          </div>
        )}

        {/* Invoice card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Invoice header */}
          <div className="bg-brand-600 px-6 py-5 flex items-center justify-between">
            <div>
              <p className="text-brand-100 text-xs font-medium uppercase tracking-wide">Invoice</p>
              <p className="text-white text-xl font-bold mt-0.5">{invoice.invoice_number}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              isPaid
                ? "bg-emerald-400 text-white"
                : invoice.status === "overdue"
                ? "bg-red-400 text-white"
                : "bg-white/20 text-white"
            }`}>
              {invoice.status.toUpperCase()}
            </span>
          </div>

          <div className="p-6 space-y-6">
            {/* From/To + Dates */}
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase mb-1">From</p>
                <p className="font-semibold text-gray-800">{business.business_name}</p>
                {business.business_address && (
                  <p className="text-gray-500 text-xs mt-0.5 whitespace-pre-line">{business.business_address}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase mb-1">Bill To</p>
                <p className="font-semibold text-gray-800">{invoice.client?.name}</p>
                {invoice.client?.company && <p className="text-gray-500 text-xs">{invoice.client.company}</p>}
                <p className="text-gray-500 text-xs">{invoice.client?.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase mb-1">Issue Date</p>
                <p className="text-gray-700">{format(new Date(invoice.issue_date), "MMM d, yyyy")}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase mb-1">Due Date</p>
                <p className={`font-medium ${invoice.status === "overdue" ? "text-red-600" : "text-gray-700"}`}>
                  {format(new Date(invoice.due_date), "MMM d, yyyy")}
                </p>
              </div>
            </div>

            {/* Line items */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-3 text-left font-medium">Description</th>
                    <th className="px-4 py-3 text-right font-medium">Qty</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(invoice.items ?? []).map((item, i) => (
                    <tr key={item.id ?? i}>
                      <td className="px-4 py-3 text-gray-700">{item.description}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        {fmt(item.amount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-60 space-y-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>{fmt(invoice.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Tax ({invoice.tax_rate}%)</span><span>{fmt(invoice.tax_amount, currency)}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-brand-600 border-t border-gray-200 pt-2">
                  <span>Total Due</span><span>{fmt(invoice.total, currency)}</span>
                </div>
              </div>
            </div>

            {invoice.notes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase font-medium mb-1">Notes</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}

            {/* Pay button */}
            {!isPaid && payState !== "success" && (
              <div className="space-y-3">
                <button
                  onClick={handlePay}
                  disabled={payState === "loading" || payState === "verifying"}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {payState === "loading" ? (
                    <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Opening payment…</>
                  ) : (
                    <>Pay {fmt(invoice.total, currency)} Now</>
                  )}
                </button>

                {/* Accepted payment methods */}
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    M-Pesa
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
                    💳 Visa
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
                    💳 Mastercard
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
                    🏦 Bank Transfer
                  </span>
                </div>
                <p className="text-center text-xs text-gray-400">Secured by Paystack · 256-bit SSL</p>
              </div>
            )}

            {(isPaid || payState === "success") && (
              <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold py-3.5 rounded-xl text-sm text-center">
                ✓ This invoice has been paid
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Powered by <span className="font-medium text-brand-500">InvoiceApp</span>
        </p>
      </div>
    </div>
  );
}
