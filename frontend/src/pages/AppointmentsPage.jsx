import { useEffect, useState, useCallback } from "react";
import { Plus, CalendarClock, Search } from "lucide-react";
import { appointmentsApi, patientsApi, doctorsApi } from "../api/endpoints";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import { useAuth } from "../context/AuthContext";
import { formatDateTime } from "../utils/format";
import toast from "react-hot-toast";

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const canBook = user?.role === "ADMIN" || user?.role === "RECEPTIONIST";
  const canUpdateStatus = user?.role === "DOCTOR" || user?.role === "ADMIN" || user?.role === "RECEPTIONIST";

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appointmentsApi.list({ status: statusFilter || undefined, page, limit: 15 });
      setAppointments(res.data.appointments);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      toast.error("Could not load appointments.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  async function handleStatusChange(id, status) {
    try {
      await appointmentsApi.update(id, { status });
      toast.success(`Appointment marked as ${status.toLowerCase().replace("_", " ")}.`);
      fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not update appointment.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle="Book and manage patient appointments."
        action={
          canBook && (
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <Plus size={16} /> Book Appointment
            </button>
          )
        }
      />

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mb-1">
        {["", "SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
              statusFilter === s ? "bg-teal-900 text-white" : "bg-white text-ink-600 border border-ink-200 hover:bg-ink-50"
            }`}
          >
            {s === "" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="h-8 w-8 rounded-full border-2 border-teal-200 border-t-teal-900 animate-spin" />
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No appointments found" description="Book a new appointment to get started." />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-ink-200 text-left">
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide">Patient</th>
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide">Doctor</th>
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide">Date & Time</th>
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide hidden sm:table-cell">Reason</th>
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide">Status</th>
                {canUpdateStatus && <th className="px-5 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-5 py-3.5 font-medium text-ink-900">{a.patient.firstName} {a.patient.lastName}</td>
                  <td className="px-5 py-3.5 text-ink-700">Dr. {a.doctor.user.name}</td>
                  <td className="px-5 py-3.5 text-ink-700">{formatDateTime(a.scheduledAt)}</td>
                  <td className="px-5 py-3.5 text-ink-700 hidden sm:table-cell">{a.reason || "—"}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={a.status} /></td>
                  {canUpdateStatus && (
                    <td className="px-5 py-3.5">
                      {a.status === "SCHEDULED" && (
                        <select
                          onChange={(e) => e.target.value && handleStatusChange(a.id, e.target.value)}
                          defaultValue=""
                          className="text-xs border border-ink-200 rounded-md px-2 py-1 bg-white"
                        >
                          <option value="" disabled>Update…</option>
                          <option value="COMPLETED">Mark Completed</option>
                          <option value="CANCELLED">Cancel</option>
                          <option value="NO_SHOW">No Show</option>
                        </select>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {!loading && appointments.length > 0 && (
          <div className="px-5 pb-4">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      <BookAppointmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onBooked={() => { setModalOpen(false); setPage(1); fetchAppointments(); }}
      />
    </div>
  );
}

function BookAppointmentModal({ isOpen, onClose, onBooked }) {
  const [patientQuery, setPatientQuery] = useState("");
  const [patientOptions, setPatientOptions] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Only show active doctors as bookable — a deactivated doctor
      // shouldn't be assignable to new appointments, even though their
      // past appointments and records remain visible elsewhere.
      doctorsApi.list().then((res) => setDoctors(res.data.doctors.filter((d) => d.user.isActive)));
    } else {
      // reset on close
      setPatientQuery(""); setSelectedPatient(null); setSelectedDoctor("");
      setDate(""); setSlots([]); setSelectedSlot(""); setReason("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (patientQuery.length < 2) { setPatientOptions([]); return; }
    const timer = setTimeout(() => {
      patientsApi.list({ search: patientQuery, limit: 5 }).then((res) => setPatientOptions(res.data.patients));
    }, 300);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  useEffect(() => {
    if (!selectedDoctor || !date) { setSlots([]); return; }
    setLoadingSlots(true);
    doctorsApi.getAvailability(selectedDoctor, date)
      .then((res) => setSlots(res.data.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDoctor, date]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedPatient || !selectedDoctor || !selectedSlot) {
      toast.error("Please select a patient, doctor, and time slot.");
      return;
    }
    setSaving(true);
    try {
      await appointmentsApi.create({
        patientId: selectedPatient.id,
        doctorId: selectedDoctor,
        scheduledAt: selectedSlot,
        reason,
      });
      toast.success("Appointment booked successfully.");
      onBooked();
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not book appointment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book Appointment" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-text">Patient *</label>
          {selectedPatient ? (
            <div className="flex items-center justify-between bg-teal-50 px-3.5 py-2.5 rounded-lg">
              <span className="text-sm font-medium text-teal-900">{selectedPatient.firstName} {selectedPatient.lastName}</span>
              <button type="button" onClick={() => setSelectedPatient(null)} className="text-xs text-teal-700 hover:underline">Change</button>
            </div>
          ) : (
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                className="input-field pl-9"
                placeholder="Search patient by name or phone…"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
              />
              {patientOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-ink-200 rounded-lg shadow-cardHover max-h-48 overflow-y-auto">
                  {patientOptions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPatient(p); setPatientQuery(""); setPatientOptions([]); }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-teal-50 text-sm border-b border-ink-100 last:border-0"
                    >
                      <span className="font-medium text-ink-900">{p.firstName} {p.lastName}</span>
                      <span className="text-ink-500 text-xs ml-2">{p.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="label-text">Doctor *</label>
          <select required className="input-field" value={selectedDoctor} onChange={(e) => { setSelectedDoctor(e.target.value); setSelectedSlot(""); }}>
            <option value="">Select a doctor…</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>Dr. {d.user.name} — {d.specialization}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-text">Date *</label>
          <input
            required
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            className="input-field"
            value={date}
            onChange={(e) => { setDate(e.target.value); setSelectedSlot(""); }}
          />
        </div>

        {date && selectedDoctor && (
          <div>
            <label className="label-text">Available Slots *</label>
            {loadingSlots ? (
              <p className="text-sm text-ink-500">Loading slots…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-ink-500">No available slots for this date.</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSlot(s)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      selectedSlot === s ? "bg-teal-900 text-white border-teal-900" : "bg-white border-ink-200 text-ink-700 hover:border-teal-700"
                    }`}
                  >
                    {new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="label-text">Reason for Visit</label>
          <input className="input-field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Routine checkup" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Booking…" : "Book Appointment"}</button>
        </div>
      </form>
    </Modal>
  );
}
