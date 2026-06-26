import { useEffect, useState, useCallback } from "react";
import { Plus, Receipt, Search, Trash2 } from "lucide-react";
import { billingApi, patientsApi } from "../api/endpoints";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import { formatCurrency, formatDate } from "../utils/format";
import toast from "react-hot-toast";

export default function BillingPage() {
  const [bills, setBills] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [payModalBill, setPayModalBill] = useState(null);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await billingApi.list({ paymentStatus: statusFilter || undefined, page, limit: 12 });
      setBills(res.data.bills);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      toast.error("Could not load bills.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="Create invoices and record payments."
        action={
          <button onClick={() => setCreateModalOpen(true)} className="btn-primary">
            <Plus size={16} /> New Invoice
          </button>
        }
      />

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mb-1">
        {["", "UNPAID", "PARTIALLY_PAID", "PAID"].map((s) => (
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
        ) : bills.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices found" description="Create your first invoice to start billing patients." />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-ink-200 text-left">
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide">Invoice</th>
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide">Patient</th>
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide hidden sm:table-cell">Date</th>
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide">Total</th>
                <th className="px-5 py-3 font-semibold text-ink-600 text-xs uppercase tracking-wide">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-5 py-3.5 font-mono text-xs text-ink-700">{b.invoiceNumber}</td>
                  <td className="px-5 py-3.5 font-medium text-ink-900">{b.patient.firstName} {b.patient.lastName}</td>
                  <td className="px-5 py-3.5 text-ink-600 hidden sm:table-cell">{formatDate(b.createdAt)}</td>
                  <td className="px-5 py-3.5 font-semibold text-ink-900">{formatCurrency(b.totalAmount)}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={b.paymentStatus} /></td>
                  <td className="px-5 py-3.5 text-right">
                    {b.paymentStatus !== "PAID" && (
                      <button onClick={() => setPayModalBill(b)} className="text-xs font-semibold text-teal-900 hover:underline">
                        Record Payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {!loading && bills.length > 0 && (
          <div className="px-5 pb-4">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      <CreateInvoiceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => { setCreateModalOpen(false); setPage(1); fetchBills(); }}
      />

      <RecordPaymentModal
        bill={payModalBill}
        onClose={() => setPayModalBill(null)}
        onRecorded={() => { setPayModalBill(null); fetchBills(); }}
      />
    </div>
  );
}

function CreateInvoiceModal({ isOpen, onClose, onCreated }) {
  const [patientQuery, setPatientQuery] = useState("");
  const [patientOptions, setPatientOptions] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [items, setItems] = useState([{ description: "Consultation Fee", quantity: 1, unitPrice: "" }]);
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPatientQuery(""); setSelectedPatient(null);
      setItems([{ description: "Consultation Fee", quantity: 1, unitPrice: "" }]);
      setDiscount("0"); setTax("0");
    }
  }, [isOpen]);

  useEffect(() => {
    if (patientQuery.length < 2) { setPatientOptions([]); return; }
    const timer = setTimeout(() => {
      patientsApi.list({ search: patientQuery, limit: 5 }).then((res) => setPatientOptions(res.data.patients));
    }, 300);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: "" }]);
  }
  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const total = Math.max(subtotal - (Number(discount) || 0) + (Number(tax) || 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedPatient) { toast.error("Please select a patient."); return; }
    if (items.some((it) => !it.description || !it.unitPrice)) {
      toast.error("Please fill in all bill item fields.");
      return;
    }
    setSaving(true);
    try {
      await billingApi.create({
        patientId: selectedPatient.id,
        items: items.map((it) => ({ description: it.description, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) })),
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
      });
      toast.success("Invoice created successfully.");
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not create invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Invoice" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
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
          <label className="label-text">Bill Items *</label>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Description"
                  value={it.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)}
                />
                <input
                  type="number"
                  min="1"
                  className="input-field w-20"
                  placeholder="Qty"
                  value={it.quantity}
                  onChange={(e) => updateItem(i, "quantity", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field w-28"
                  placeholder="Price"
                  value={it.unitPrice}
                  onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                />
                <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1} className="text-ink-400 hover:text-coral-600 disabled:opacity-30 px-1">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="text-xs font-semibold text-teal-900 hover:underline mt-2">+ Add line item</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Discount (₹)</label>
            <input type="number" min="0" step="0.01" className="input-field" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div>
            <label className="label-text">Tax (₹)</label>
            <input type="number" min="0" step="0.01" className="input-field" value={tax} onChange={(e) => setTax(e.target.value)} />
          </div>
        </div>

        <div className="bg-ink-50 rounded-lg p-4 space-y-1.5">
          <div className="flex justify-between text-sm"><span className="text-ink-600">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-ink-600">Discount</span><span className="font-medium">-{formatCurrency(discount || 0)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-ink-600">Tax</span><span className="font-medium">+{formatCurrency(tax || 0)}</span></div>
          <div className="flex justify-between text-base font-semibold pt-1.5 border-t border-ink-200"><span>Total</span><span className="text-teal-900">{formatCurrency(total)}</span></div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Creating…" : "Create Invoice"}</button>
        </div>
      </form>
    </Modal>
  );
}

function RecordPaymentModal({ bill, onClose, onRecorded }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bill) setAmount(String(Number(bill.totalAmount) - Number(bill.amountPaid)));
  }, [bill]);

  if (!bill) return null;

  const remaining = Number(bill.totalAmount) - Number(bill.amountPaid);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await billingApi.recordPayment(bill.id, { amount: Number(amount), paymentMethod: method });
      toast.success("Payment recorded.");
      onRecorded();
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not record payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={!!bill} onClose={onClose} title={`Record Payment — ${bill.invoiceNumber}`} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-ink-50 rounded-lg p-3.5 text-sm flex justify-between">
          <span className="text-ink-600">Remaining balance</span>
          <span className="font-semibold text-ink-900">{formatCurrency(remaining)}</span>
        </div>
        <div>
          <label className="label-text">Amount (₹) *</label>
          <input required type="number" min="0.01" step="0.01" max={remaining} className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label-text">Payment Method *</label>
          <select required className="input-field" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="UPI">UPI</option>
            <option value="INSURANCE">Insurance</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Recording…" : "Record Payment"}</button>
        </div>
      </form>
    </Modal>
  );
}
