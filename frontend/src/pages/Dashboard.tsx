import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboardStats, getRevenueChart } from "../api/invoices";
import type { DashboardStats, RevenueChartPoint } from "../types";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-2 text-sm">
      <p className="font-medium text-gray-700">{label}</p>
      <p className="text-brand-600 font-bold">{fmt(payload[0].value)}</p>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chart, setChart] = useState<RevenueChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getRevenueChart()])
      .then(([s, c]) => {
        setStats(s);
        setChart(c);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), "MMMM d, yyyy")}</p>
        </div>
        <Link
          to="/invoices/new"
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Invoice
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={fmt(stats.total_revenue)} sub="from paid invoices" accent="text-emerald-600" />
        <StatCard label="Pending" value={fmt(stats.pending_amount)} sub="awaiting payment" accent="text-blue-600" />
        <StatCard label="Overdue" value={fmt(stats.overdue_amount)} sub="needs attention" accent="text-red-600" />
        <StatCard label="Total Clients" value={String(stats.total_clients)} sub={`${stats.total_invoices} invoices total`} accent="text-brand-600" />
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-6">Monthly Revenue (paid invoices)</h2>
        {chart.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
            No paid invoices yet. Revenue will appear here once you mark invoices as paid.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={48}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f3f4f6" }} />
              <Bar dataKey="revenue" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent invoices */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Recent Invoices</h2>
          <Link to="/invoices" className="text-sm text-brand-600 hover:underline">View all</Link>
        </div>
        {stats.recent_invoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            No invoices yet.{" "}
            <Link to="/invoices/new" className="text-brand-600 hover:underline">Create your first</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Invoice #</th>
                <th className="px-6 py-3 font-medium">Client</th>
                <th className="px-6 py-3 font-medium">Due Date</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.recent_invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <Link to={`/invoices/${inv.id}`} className="font-medium text-brand-600 hover:underline">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-gray-700">{inv.client?.name}</td>
                  <td className="px-6 py-3 text-gray-500">
                    {format(new Date(inv.due_date), "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="px-6 py-3 text-right font-semibold text-gray-900">{fmt(inv.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
