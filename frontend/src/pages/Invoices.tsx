import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getInvoices, deleteInvoice, updateInvoiceStatus } from "../api/invoices";
import type { Invoice, InvoiceStatus } from "../types";
import StatusBadge from "../components/StatusBadge";
import { format } from "date-fns";

const ALL_STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");
  const [loading, setLoading] = useState(true);

  const load = (status?: InvoiceStatus) => {
    setLoading(true);
    getInvoices(status)
      .then(setInvoices)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(filter === "all" ? undefined : filter);
  }, [filter]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this invoice?")) return;
    await deleteInvoice(id);
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  const handleStatusChange = async (id: number, status: InvoiceStatus) => {
    const updated = await updateInvoiceStatus(id, status);
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, ...updated } : inv)));
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <Link
          to="/invoices/new"
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Invoice
        </Link>
      </div>

      <div className="flex gap-2">
        {(["all", ...ALL_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === s
                ? "bg-brand-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No invoices found.{" "}
            <Link to="/invoices/new" className="text-brand-600 hover:underline">
              Create one
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Invoice #</th>
                <th className="px-6 py-3 font-medium">Client</th>
                <th className="px-6 py-3 font-medium">Issued</th>
                <th className="px-6 py-3 font-medium">Due</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Total</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <Link
                      to={`/invoices/${inv.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-gray-700">{inv.client?.name}</td>
                  <td className="px-6 py-3 text-gray-500">
                    {format(new Date(inv.issue_date), "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {format(new Date(inv.due_date), "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-3">
                    <select
                      value={inv.status}
                      onChange={(e) =>
                        handleStatusChange(inv.id, e.target.value as InvoiceStatus)
                      }
                      className="text-xs border-0 bg-transparent focus:ring-0 p-0 cursor-pointer"
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-gray-900">
                    {fmt(inv.total)}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-gray-500 hover:text-brand-600 text-xs"
                      >
                        View
                      </Link>
                      <Link
                        to={`/invoices/${inv.id}/edit`}
                        className="text-gray-500 hover:text-brand-600 text-xs"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
