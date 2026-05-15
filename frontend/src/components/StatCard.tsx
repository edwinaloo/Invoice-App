interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

export default function StatCard({ label, value, sub, accent = "bg-brand-50 text-brand-600" }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}
