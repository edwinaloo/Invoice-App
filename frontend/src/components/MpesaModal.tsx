import { useState, useEffect, useRef } from "react";
import type { Invoice } from "../types";

interface Props {
  invoiceId?: number;          // used for authenticated (InvoiceDetail) flow
  publicToken?: string;        // used for client portal flow
  invoiceNumber: string;
  total: number;
  currency: string;
  clientPhone?: string;
  onSuccess: (invoice?: Invoice) => void;
  onClose: () => void;
}

type State = "input" | "waiting" | "success" | "failed" | "cancelled" | "timeout";

function fmt(n: number, currency: string) {
  return `${currency} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default function MpesaModal({
  invoiceId, publicToken, invoiceNumber, total, currency, clientPhone, onSuccess, onClose,
}: Props) {
  const [phone, setPhone] = useState(clientPhone || "");
  const [state, setState] = useState<State>("input");
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countRef = useRef(0);

  const stopPolling = () => {
    if (pollRef.current) clearTimeout(pollRef.current);
  };

  useEffect(() => () => stopPolling(), []);

  const apiBase = publicToken
    ? `/api/public/invoices/${publicToken}`
    : `/api/invoices/${invoiceId}`;

  const sendStk = async () => {
    const resp = await fetch(`${apiBase}/mpesa-stk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(invoiceId
          ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
          : {}),
      },
      body: JSON.stringify({ phone }),
    });
    if (!resp.ok) {
      const data = await resp.json();
      throw new Error(data.error || "M-Pesa request failed");
    }
    return resp.json();
  };

  const checkStatus = async () => {
    const resp = await fetch(`${apiBase}/mpesa-status`, {
      headers: invoiceId
        ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
        : {},
    });
    return resp.json();
  };

  const startPolling = () => {
    countRef.current = 0;
    const poll = async () => {
      if (countRef.current >= 30) {
        setState("timeout");
        return;
      }
      countRef.current++;
      try {
        const result = await checkStatus();
        if (result.paid) {
          setState("success");
          onSuccess(result.invoice);
          return;
        }
        if (result.status === "cancelled") { setState("cancelled"); return; }
        if (result.status === "failed")    { setState("failed");    return; }
      } catch {
        // network error — keep trying
      }
      pollRef.current = setTimeout(poll, 3000);
    };
    pollRef.current = setTimeout(poll, 3000);
  };

  const handleSend = async () => {
    if (!phone.trim()) { setError("Please enter a phone number"); return; }
    setError("");
    setState("waiting");
    try {
      await sendStk();
      startPolling();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to send M-Pesa request");
      setState("input");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">🟢</div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Pay with M-Pesa</h2>
              <p className="text-xs text-gray-400">{invoiceNumber}</p>
            </div>
          </div>
          <button
            onClick={() => { stopPolling(); onClose(); }}
            className="text-gray-300 hover:text-gray-500 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Amount pill */}
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400 mb-0.5">Amount</p>
          <p className="text-2xl font-bold text-green-700">{fmt(total, currency)}</p>
        </div>

        {/* Input state */}
        {state === "input" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                M-Pesa Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="e.g. 0712 345 678"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Safaricom number to receive the payment prompt
              </p>
            </div>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              onClick={handleSend}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors"
            >
              Send M-Pesa Request
            </button>
          </div>
        )}

        {/* Waiting state */}
        {state === "waiting" && (
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <p className="font-semibold text-gray-800">Check your phone</p>
              <p className="text-sm text-gray-500 mt-1">
                A payment prompt has been sent to <span className="font-medium">{phone}</span>.
                Enter your M-Pesa PIN to complete payment.
              </p>
            </div>
            <p className="text-xs text-gray-400">Waiting for confirmation…</p>
          </div>
        )}

        {/* Success */}
        {state === "success" && (
          <div className="text-center space-y-3 py-2">
            <div className="text-5xl">✅</div>
            <p className="font-bold text-green-700 text-lg">Payment Received!</p>
            <p className="text-sm text-gray-500">
              M-Pesa payment confirmed. This invoice is now marked as paid.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl text-sm mt-1 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Failed / Cancelled / Timeout */}
        {(state === "failed" || state === "cancelled" || state === "timeout") && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
              <p className="font-semibold text-red-700">
                {state === "cancelled" ? "Payment cancelled" :
                 state === "timeout"   ? "Request timed out" : "Payment failed"}
              </p>
              <p className="text-xs text-red-500 mt-1">
                {state === "cancelled"
                  ? "You dismissed the prompt. You can try again."
                  : state === "timeout"
                  ? "No response received within 90 seconds."
                  : "M-Pesa could not process the payment."}
              </p>
            </div>
            <button
              onClick={() => { setState("input"); setError(""); }}
              className="w-full border-2 border-green-600 text-green-700 hover:bg-green-50 font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
