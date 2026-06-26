import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Stethoscope, Plus } from "lucide-react";
import { doctorsApi, authApi } from "../api/endpoints";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import PhoneInput from "../components/PhoneInput";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, getInitials } from "../utils/format";
import toast from "react-hot-toast";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  specialization: "",
  qualification: "",
  licenseNumber: "",
  consultationFee: "",
};

export default function DoctorsPage() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  // Both Admin and Receptionist can add doctors; keeping the variable name
  // generic since it now covers more than just the admin role.
  const canAddDoctor = user?.role === "ADMIN" || user?.role === "RECEPTIONIST";

  const fetchDoctors = useCallback(() => {
    setLoading(true);
    doctorsApi
      .list()
      .then((res) => setDoctors(res.data.doctors))
      .catch(() => toast.error("Could not load doctors."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.addDoctor({
        ...form,
        consultationFee: Number(form.consultationFee),
      });
      toast.success("Doctor added. They'll receive a verification email before they can log in.");
      setModalOpen(false);
      setForm(emptyForm);
      fetchDoctors();
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not add doctor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Doctors"
        subtitle="Browse specialists and their availability."
        action={
          canAddDoctor && (
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <Plus size={16} /> Add Doctor
            </button>
          )
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 rounded-full border-2 border-teal-200 border-t-teal-900 animate-spin" />
        </div>
      ) : doctors.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Stethoscope}
            title="No doctors yet"
            description={canAddDoctor ? "Add your first doctor to get started." : "Doctor profiles will appear here once added."}
            action={
              canAddDoctor && (
                <button onClick={() => setModalOpen(true)} className="btn-primary">
                  <Plus size={16} /> Add Doctor
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {doctors.map((d) => (
            <div
              key={d.id}
              onClick={() => navigate(`/doctors/${d.id}`)}
              className={`card p-5 cursor-pointer hover:shadow-cardHover transition-shadow ${
                !d.user.isActive ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-full bg-teal-900 text-white flex items-center justify-center text-sm font-semibold shrink-0 overflow-hidden">
                  {d.user.profilePhoto ? (
                    <img src={d.user.profilePhoto} alt="" className="h-full w-full object-cover" />
                  ) : (
                    getInitials(d.user.name)
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display font-semibold text-ink-900 truncate">Dr. {d.user.name}</p>
                    {!d.user.isActive && <span className="badge bg-ink-100 text-ink-600 shrink-0">Inactive</span>}
                  </div>
                  <p className="text-xs text-ink-500">{d.specialization}</p>
                </div>
              </div>
              <p className="text-xs text-ink-600 mb-3 line-clamp-2">{d.bio}</p>
              <div className="flex items-center justify-between text-xs pt-3 border-t border-ink-100">
                <span className="text-ink-500">{d.qualification}</span>
                <span className="font-semibold text-teal-900">{formatCurrency(d.consultationFee)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add New Doctor" maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Full Name *</label>
              <input required className="input-field" placeholder="Dr. Jane Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Email *</label>
              <input required type="email" className="input-field" placeholder="jane.doe@hospital.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Phone</label>
              <PhoneInput value={form.phone} onChange={(val) => setForm({ ...form, phone: val })} />
            </div>
            <div>
              <label className="label-text">Temporary Password *</label>
              <input required minLength={6} className="input-field" placeholder="At least 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Specialization *</label>
              <input required className="input-field" placeholder="e.g. Cardiology" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Qualification</label>
              <input className="input-field" placeholder="e.g. MD, DM Cardiology" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">License Number *</label>
              <input required className="input-field" placeholder="e.g. LIC-1234" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Consultation Fee *</label>
              <input required type="number" min="0" step="0.01" className="input-field" placeholder="e.g. 800" value={form.consultationFee} onChange={(e) => setForm({ ...form, consultationFee: e.target.value })} />
            </div>
          </div>

          <p className="text-xs text-ink-500">
            The doctor can sign in immediately using this email and temporary password — share it with them securely and ask them to change it after their first login.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "Adding…" : "Add Doctor"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
