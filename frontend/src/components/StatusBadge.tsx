import type { InvoiceStatus } from "../types";

const config: Record<InvoiceStatus, { label: string; classes: string }> = {
  draft: { label: "Draft", classes: "bg-gray-100 text-gray-600" },
  sent: { label: "Sent", classes: "bg-blue-100 text-blue-700" },
  paid: { label: "Paid", classes: "bg-emerald-100 text-emerald-700" },
  overdue: { label: "Overdue", classes: "bg-red-100 text-red-700" },
};

export default function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, classes } = config[status] ?? config.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
