export default function StatCard({ label, value, icon: Icon, accent = "teal", trend }) {
  const accentStyles = {
    teal: "bg-teal-100 text-teal-900",
    coral: "bg-coral-100 text-coral-600",
    sage: "bg-sage-100 text-sage-700",
    amber: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-2">{label}</div>
          <div className="font-display text-2xl font-semibold text-ink-900">{value}</div>
          {trend && <div className="text-xs text-sage-700 font-medium mt-1.5">{trend}</div>}
        </div>
        {Icon && (
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${accentStyles[accent]}`}>
            <Icon size={20} strokeWidth={2} />
          </div>
        )}
      </div>
    </div>
  );
}
