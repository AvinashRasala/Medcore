import { useEffect, useState } from "react";
import { Users, CalendarCheck, Receipt, IndianRupee, Stethoscope, AlertCircle } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { dashboardApi } from "../api/endpoints";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import { formatCurrency } from "../utils/format";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [apptTrend, setApptTrend] = useState([]);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [doctorLoad, setDoctorLoad] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, a, r, d] = await Promise.all([
          dashboardApi.summary(),
          dashboardApi.appointmentsTrend(14),
          dashboardApi.revenueTrend(6),
          dashboardApi.doctorLoad(),
        ]);
        setSummary(s.data);
        setApptTrend(a.data.trend);
        setRevenueTrend(
          r.data.trend.map((t) => ({ ...t, monthLabel: new Date(`${t.month}-01`).toLocaleDateString("en-IN", { month: "short" }) }))
        );
        setDoctorLoad(d.data.doctorLoad);
      } catch (err) {
        toast.error("Could not load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 rounded-full border-2 border-teal-200 border-t-teal-900 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Today's snapshot across the hospital." />

      {/* Top stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Patients" value={summary.totalPatients} icon={Users} accent="teal" />
        <StatCard label="Appointments Today" value={summary.appointmentsToday} icon={CalendarCheck} accent="sage" />
        <StatCard label="Revenue This Month" value={formatCurrency(summary.revenueThisMonth)} icon={IndianRupee} accent="coral" />
        <StatCard label="Pending Bills" value={summary.pendingBillsCount} icon={Receipt} accent="amber" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard label="Active Doctors" value={summary.totalDoctors} icon={Stethoscope} accent="teal" />
        <StatCard
          label="Outstanding Balance"
          value={formatCurrency(summary.outstandingBalance)}
          icon={AlertCircle}
          accent="coral"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-display text-base font-semibold text-ink-900 mb-1">Appointments, last 14 days</h3>
          <p className="text-xs text-ink-600 mb-4">Daily volume across all doctors.</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={apptTrend}>
              <defs>
                <linearGradient id="apptGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#155E5E" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#155E5E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#D7DBDA" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                tick={{ fontSize: 11, fill: "#5B6362" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: "#5B6362" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                labelFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                contentStyle={{ borderRadius: 10, border: "1px solid #D7DBDA", fontSize: 13 }}
              />
              <Area type="monotone" dataKey="total" stroke="#155E5E" strokeWidth={2} fill="url(#apptGradient)" name="Appointments" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="font-display text-base font-semibold text-ink-900 mb-1">Busiest doctors</h3>
          <p className="text-xs text-ink-600 mb-4">By total appointments.</p>
          <div className="space-y-3.5 mt-2">
            {doctorLoad.slice(0, 6).map((d, i) => {
              const max = doctorLoad[0]?.appointmentCount || 1;
              const pct = Math.max((d.appointmentCount / max) * 100, 4);
              return (
                <div key={d.doctorId}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-ink-800 truncate">{d.name}</span>
                    <span className="text-ink-500 font-mono">{d.appointmentCount}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {doctorLoad.length === 0 && <p className="text-sm text-ink-400">No appointment data yet.</p>}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-display text-base font-semibold text-ink-900 mb-1">Revenue, last 6 months</h3>
        <p className="text-xs text-ink-600 mb-4">Collected payments by month.</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={revenueTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D7DBDA" vertical={false} />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: "#5B6362" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#5B6362" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />
            <Tooltip
              formatter={(v) => formatCurrency(v)}
              contentStyle={{ borderRadius: 10, border: "1px solid #D7DBDA", fontSize: 13 }}
            />
            <Bar dataKey="revenue" fill="#E8674B" radius={[6, 6, 0, 0]} name="Revenue" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
