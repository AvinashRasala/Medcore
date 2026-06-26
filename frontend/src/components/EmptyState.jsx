export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && (
        <div className="h-14 w-14 rounded-full bg-teal-50 flex items-center justify-center mb-4">
          <Icon size={24} className="text-teal-700" strokeWidth={1.75} />
        </div>
      )}
      <h3 className="font-display text-base font-semibold text-ink-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-ink-600 max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}
