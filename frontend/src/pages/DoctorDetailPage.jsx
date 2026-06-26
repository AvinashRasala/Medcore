import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldOff, ShieldCheck } from "lucide-react";
import { doctorsApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import { formatCurrency, formatDateTime, getInitials } from "../utils/format";
import toast from "react-hot-toast";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function DoctorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const canManageStatus = user?.role === "ADMIN" || user?.role === "RECEPTIONIST";

  useEffect(() => {
    async function load() {
      try {
        const res = await doctorsApi.get(id);
        setDoctor(res.data.doctor);
      } catch (err) {
        toast.error("Could not load doctor profile.");
        navigate("/doctors");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, navigate]);

  async function handleToggleStatus() {
    const nextActive = !doctor.user.isActive;
    const confirmMsg = nextActive
      ? "Reactivate this doctor? They'll be able to log in again."
      : "Deactivate this doctor? They won't be able to log in, but all their appointments and medical records stay exactly as they are.";

    if (!window.confirm(confirmMsg)) return;

    setTogglingStatus(true);
    try {
      const res = await doctorsApi.updateStatus(id, nextActive);
      setDoctor((prev) => ({ ...prev, user: { ...prev.user, isActive: nextActive } }));
      toast.success(res.data.message || "Status updated.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not update doctor status.");
    } finally {
      setTogglingStatus(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 rounded-full border-2 border-teal-200 border-t-teal-900 animate-spin" />
      </div>
    );
  }
  if (!doctor) return null;

  return (
    <div>
      <button onClick={() => navigate("/doctors")} className="flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900 mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to Doctors
      </button>

      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-teal-900 text-white flex items-center justify-center text-lg font-semibold shrink-0 overflow-hidden">
            {doctor.user.profilePhoto ? (
              <img src={doctor.user.profilePhoto} alt="" className="h-full w-full object-cover" />
            ) : (
              getInitials(doctor.user.name)
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display text-2xl font-semibold text-ink-900">Dr. {doctor.user.name}</h1>
              {!doctor.user.isActive && (
                <span className="badge bg-ink-100 text-ink-600">Inactive</span>
              )}
            </div>
            <p className="text-sm text-ink-600 mt-0.5">{doctor.specialization} · {doctor.qualification}</p>
            <p className="text-sm text-ink-500 mt-1 break-words">{doctor.user.email} · {doctor.user.phone}</p>
          </div>
          <div className="sm:ml-auto text-left sm:text-right">
            <p className="text-xs text-ink-500 uppercase tracking-wide">Consultation Fee</p>
            <p className="font-display text-xl font-semibold text-teal-900">{formatCurrency(doctor.consultationFee)}</p>
          </div>
        </div>
        {doctor.bio && <p className="text-sm text-ink-700 mt-4 pt-4 border-t border-ink-100">{doctor.bio}</p>}

        {canManageStatus && (
          <div className="mt-4 pt-4 border-t border-ink-100">
            <button
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              className={doctor.user.isActive ? "btn-danger" : "btn-secondary"}
            >
              {doctor.user.isActive ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
              {togglingStatus
                ? "Updating…"
                : doctor.user.isActive
                ? "Deactivate Doctor"
                : "Reactivate Doctor"}
            </button>
            {doctor.user.isActive && (
              <p className="text-xs text-ink-500 mt-2">
                Deactivating blocks their login but keeps all appointment and medical record history intact.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5">
          <h3 className="font-display font-semibold text-ink-900 mb-3">Weekly Availability</h3>
          <div className="space-y-2">
            {doctor.schedules.length === 0 ? (
              <p className="text-sm text-ink-500">No schedule set.</p>
            ) : (
              doctor.schedules
                .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                .map((s) => (
                  <div key={s.id} className="flex justify-between text-sm">
                    <span className="text-ink-700">{DAYS[s.dayOfWeek]}</span>
                    <span className="font-mono text-xs text-ink-500">{s.startTime}–{s.endTime}</span>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h3 className="font-display font-semibold text-ink-900 mb-3">Recent Appointments</h3>
          <div className="divide-y divide-ink-100">
            {doctor.appointments.length === 0 ? (
              <p className="text-sm text-ink-500">No appointments yet.</p>
            ) : (
              doctor.appointments.slice(0, 8).map((a) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{a.patient.firstName} {a.patient.lastName}</p>
                    <p className="text-xs text-ink-500">{formatDateTime(a.scheduledAt)}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
