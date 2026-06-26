import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Mail, MapPin, Droplet, AlertTriangle } from "lucide-react";
import { patientsApi } from "../api/endpoints";
import StatusBadge from "../components/StatusBadge";
import { formatDate, formatDateTime, calculateAge, formatCurrency } from "../utils/format";
import toast from "react-hot-toast";

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [tab, setTab] = useState("appointments");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await patientsApi.get(id);
        setPatient(res.data.patient);
      } catch (err) {
        toast.error("Could not load patient record.");
        navigate("/patients");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 rounded-full border-2 border-teal-200 border-t-teal-900 animate-spin" />
      </div>
    );
  }

  if (!patient) return null;

  const tabs = [
    { id: "appointments", label: `Appointments (${patient.appointments.length})` },
    { id: "records", label: `Medical Records (${patient.medicalRecords.length})` },
    { id: "bills", label: `Bills (${patient.bills.length})` },
  ];

  return (
    <div>
      <button onClick={() => navigate("/patients")} className="flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900 mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to Patients
      </button>

      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-2xl font-semibold text-ink-900">
                {patient.firstName} {patient.lastName}
              </h1>
              <span className="font-mono text-xs text-ink-500 bg-ink-100 px-2 py-1 rounded">{patient.patientCode}</span>
            </div>
            <p className="text-sm text-ink-600">
              {calculateAge(patient.dateOfBirth)} years old · {patient.gender} · Born {formatDate(patient.dateOfBirth)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-ink-100">
          <InfoItem icon={Phone} label="Phone" value={patient.phone} />
          <InfoItem icon={Mail} label="Email" value={patient.email || "—"} />
          <InfoItem icon={Droplet} label="Blood Group" value={patient.bloodGroup || "—"} />
          <InfoItem icon={MapPin} label="Address" value={patient.address || "—"} />
        </div>

        {patient.allergies && (
          <div className="mt-4 flex items-center gap-2 bg-coral-50 text-coral-600 text-sm font-medium px-4 py-2.5 rounded-lg">
            <AlertTriangle size={16} />
            Allergies: {patient.allergies}
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-ink-200 mb-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id ? "border-teal-900 text-teal-900" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "appointments" && (
        <div className="card divide-y divide-ink-100">
          {patient.appointments.length === 0 ? (
            <p className="text-sm text-ink-500 p-6">No appointments yet.</p>
          ) : (
            patient.appointments.map((a) => (
              <div key={a.id} className="p-5 flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink-900 text-sm">Dr. {a.doctor.user.name}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{formatDateTime(a.scheduledAt)} · {a.reason || "General visit"}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))
          )}
        </div>
      )}

      {tab === "records" && (
        <div className="space-y-3">
          {patient.medicalRecords.length === 0 ? (
            <div className="card"><p className="text-sm text-ink-500 p-6">No medical records yet.</p></div>
          ) : (
            patient.medicalRecords.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-display font-semibold text-ink-900">{r.diagnosis}</p>
                  <span className="text-xs text-ink-500">{formatDate(r.visitDate)}</span>
                </div>
                <p className="text-xs text-ink-500 mb-3">Dr. {r.doctor.user.name}</p>
                {r.symptoms && <p className="text-sm text-ink-700 mb-1"><span className="font-medium">Symptoms:</span> {r.symptoms}</p>}
                {r.prescription && <p className="text-sm text-ink-700"><span className="font-medium">Prescription:</span> {r.prescription}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "bills" && (
        <div className="card divide-y divide-ink-100">
          {patient.bills.length === 0 ? (
            <p className="text-sm text-ink-500 p-6">No bills yet.</p>
          ) : (
            patient.bills.map((b) => (
              <div key={b.id} className="p-5 flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-medium text-ink-900">{b.invoiceNumber}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{formatDate(b.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ink-900">{formatCurrency(b.totalAmount)}</p>
                  <StatusBadge status={b.paymentStatus} />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-ink-500 mb-1">
        <Icon size={13} /> {label}
      </div>
      <p className="text-sm font-medium text-ink-800 truncate">{value}</p>
    </div>
  );
}
