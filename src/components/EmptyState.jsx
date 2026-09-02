export default function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={48} className="mb-4 text-slate-300" />}
      <h3
        className="text-lg font-semibold mb-1"
        style={{ color: "var(--text-secondary)" }}
      >
        {title}
      </h3>
      {subtitle && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
