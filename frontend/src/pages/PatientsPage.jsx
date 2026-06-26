import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Users } from "lucide-react";
import { patientsApi } from "../api/endpoints";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import PhoneInput from "../components/PhoneInput";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import { useAuth } from "../context/AuthContext";
import { formatDate, calculateAge } from "../utils/format";
import toast from "react-hot-toast";

const emptyForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "MALE",
  phone: "",
  email: "",
  address: "",
  bloodGroup: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  allergies: "",
};

export default function PatientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const canCreate = user?.role === "ADMIN" || user?.role === "RECEPTIONIST";

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await patientsApi.list({ search, page, limit: 12 });
      setPatients(res.data.patients);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      toast.error("Could not load patients.");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const timer = setTimeout(fetchPatients, 300); // debounce search
    return () => clearTimeout(timer);
  }, [fetchPatients]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.phone || form.phone.trim().length < 7) {
      toast.error("Please enter a valid phone number.");
      return;
    }
    setSaving(true);
    try {
      await patientsApi.create(form);
      toast.success("Patient registered successfully.");
      setModalOpen(false);
      setForm(emptyForm);
      setPage(1);
      fetchPatients();
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not register patient.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle="Search, register, and manage patient records."
        action={
          canCreate && (
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <Plus size={16} /> Register Patient
            </button>
          )
        }
      />

      <div className="relative mb-5 max-w-md">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, phone, or patient code…"
          className="input-field pl-10"
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="h-8 w-8 rounded-full border-2 border-teal-200 border-t-teal-900 animate-spin" />
          </div>
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No patients found"
            description={search ? "Try a different search term." : "Register your first patient to get started."}
          />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-ink-200 text-left">
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide">Patient</th>
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide">Code</th>
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide">Age / Gender</th>
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide">Phone</th>
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide hidden sm:table-cell">Registered</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/patients/${p.id}`)}
                  className="border-b border-ink-100 last:border-0 hover:bg-teal-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-ink-900">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-ink-600">{p.patientCode}</td>
                  <td className="px-5 py-3.5 text-ink-700">
                    {calculateAge(p.dateOfBirth)} yrs · {p.gender}
                  </td>
                  <td className="px-5 py-3.5 text-ink-700">{p.phone}</td>
                  <td className="px-5 py-3.5 text-ink-500 hidden sm:table-cell">{formatDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {!loading && patients.length > 0 && (
          <div className="px-5 pb-4">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Register New Patient" maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">First Name *</label>
              <input required className="input-field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Last Name *</label>
              <input required className="input-field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Date of Birth *</label>
              <input required type="date" className="input-field" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Gender *</label>
              <select required className="input-field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Phone *</label>
              <PhoneInput value={form.phone} onChange={(val) => setForm({ ...form, phone: val })} />
            </div>
            <div>
              <label className="label-text">Email</label>
              <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label-text">Address</label>
            <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Blood Group</label>
              <input className="input-field" placeholder="e.g. O+" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Allergies</label>
              <input className="input-field" placeholder="e.g. Penicillin" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Emergency Contact Name</label>
              <input className="input-field" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Emergency Contact Phone</label>
              <PhoneInput value={form.emergencyContactPhone} onChange={(val) => setForm({ ...form, emergencyContactPhone: val })} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Register Patient"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
