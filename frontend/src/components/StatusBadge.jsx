import { STATUS_STYLES } from "../utils/format";

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || "bg-ink-200 text-ink-600";
  const label = status?.replace(/_/g, " ");
  return <span className={`badge ${style}`}>{label}</span>;
}
