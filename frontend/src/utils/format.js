export function formatCurrency(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return "—";
  const dob = new Date(dateOfBirth);
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export const STATUS_STYLES = {
  SCHEDULED: "bg-teal-100 text-teal-900",
  COMPLETED: "bg-sage-100 text-sage-700",
  CANCELLED: "bg-ink-200 text-ink-600",
  NO_SHOW: "bg-coral-100 text-coral-600",
  UNPAID: "bg-coral-100 text-coral-600",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-sage-100 text-sage-700",
  REFUNDED: "bg-ink-200 text-ink-600",
};
