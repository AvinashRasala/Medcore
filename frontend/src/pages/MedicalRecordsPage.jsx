import { useEffect, useState, useCallback } from "react";
import { Plus, FileText, Search } from "lucide-react";
import { medicalRecordsApi, patientsApi, doctorsApi } from "../api/endpoints";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import { useAuth } from "../context/AuthContext";
import { formatDate } from "../utils/format";
import toast from "react-hot-toast";

export default function MedicalRecordsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const canCreate = user?.role === "ADMIN" || user?.role === "DOCTOR";

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await medicalRecordsApi.list({ page, limit: 12 });
      setRecords(res.data.records);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      toast.error("Could not load medical records.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return (
    <div>
      <PageHeader
        title="Medical Records"
        subtitle="Diagnoses, prescriptions, and visit history."
        action={
          canCreate && (
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <Plus size={16} /> New Record
            </button>
          )
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 rounded-full border-2 border-teal-200 border-t-teal-900 animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="card">
          <EmptyState icon={FileText} title="No medical records yet" description="Records created by doctors after a visit will appear here." />
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-display font-semibold text-ink-900">{r.diagnosis}</p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {r.patient.firstName} {r.patient.lastName} ({r.patient.patientCode}) · Dr. {r.doctor.user.name}
                  </p>
                </div>
                <span className="text-xs text-ink-500 shrink-0">{formatDate(r.visitDate)}</span>
              </div>
              {r.symptoms && <p className="text-sm text-ink-700 mt-2"><span className="font-medium">Symptoms:</span> {r.symptoms}</p>}
              {r.prescription && <p className="text-sm text-ink-700 mt-1"><span className="font-medium">Prescription:</span> {r.prescription}</p>}
            </div>
          ))}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      <CreateRecordModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => { setModalOpen(false); setPage(1); fetchRecords(); }}
      />
    </div>
  );
}

function CreateRecordModal({ isOpen, onClose, onCreated }) {
  const { user } = useAuth();
  const [patientQuery, setPatientQuery] = useState("");
  const [patientOptions, setPatientOptions] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [prescription, setPrescription] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      doctorsApi.list().then((res) => {
        setDoctors(res.data.doctors);
        const own = res.data.doctors.find((d) => d.userId === user?.id);
        if (own) setSelectedDoctor(own.id);
      });
    } else {
      setPatientQuery(""); setSelectedPatient(null); setSelectedDoctor("");
      setDiagnosis(""); setSymptoms(""); setPrescription(""); setNotes("");
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (patientQuery.length < 2) { setPatientOptions([]); return; }
    const timer = setTimeout(() => {
      patientsApi.list({ search: patientQuery, limit: 5 }).then((res) => setPatientOptions(res.data.patients));
    }, 300);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedPatient || !selectedDoctor) {
      toast.error("Please select a patient and doctor.");
      return;
    }
    setSaving(true);
    try {
      await medicalRecordsApi.create({
        patientId: selectedPatient.id,
        doctorId: selectedDoctor,
        diagnosis,
        symptoms,
        prescription,
        notes,
      });
      toast.success("Medical record created.");
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not create record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Medical Record" maxWidth="max-w-xl">
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
              <input className="input-field pl-9" placeholder="Search patient…" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
              {patientOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-ink-200 rounded-lg shadow-cardHover max-h-48 overflow-y-auto">
                  {patientOptions.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setSelectedPatient(p); setPatientQuery(""); setPatientOptions([]); }} className="w-full text-left px-3.5 py-2.5 hover:bg-teal-50 text-sm border-b border-ink-100 last:border-0">
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
          <select required className="input-field" value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)}>
            <option value="">Select a doctor…</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.user.name} — {d.specialization}</option>)}
          </select>
        </div>

        <div>
          <label className="label-text">Diagnosis *</label>
          <input required className="input-field" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
        </div>
        <div>
          <label className="label-text">Symptoms</label>
          <textarea className="input-field" rows={2} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
        </div>
        <div>
          <label className="label-text">Prescription</label>
          <textarea className="input-field" rows={2} value={prescription} onChange={(e) => setPrescription(e.target.value)} />
        </div>
        <div>
          <label className="label-text">Notes</label>
          <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Create Record"}</button>
        </div>
      </form>
    </Modal>
  );
}
