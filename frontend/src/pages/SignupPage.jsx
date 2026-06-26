import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Eye, EyeOff, Mail, Stethoscope, ClipboardList } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PhoneInput from "../components/PhoneInput";
import toast from "react-hot-toast";

export default function SignupPage() {
  const [role, setRole] = useState("RECEPTIONIST"); // RECEPTIONIST | DOCTOR
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Doctor-only fields
  const [specialization, setSpecialization] = useState("");
  const [qualification, setQualification] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [consultationFee, setConsultationFee] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (role === "DOCTOR" && (!specialization || !licenseNumber || !consultationFee)) {
      toast.error("Please fill in specialization, license number, and consultation fee.");
      return;
    }

    setLoading(true);
    try {
      await signup({
        name,
        email,
        phone,
        password,
        role,
        ...(role === "DOCTOR" && {
          specialization,
          qualification,
          licenseNumber,
          consultationFee: Number(consultationFee),
        }),
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-cream">
      {/* Left: brand panel, same signature pulse-line motif as login */}
      <div className="hidden lg:flex lg:w-1/2 bg-teal-950 relative overflow-hidden flex-col justify-between p-12">
        <PulseBackground />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-coral-500 flex items-center justify-center">
            <Activity size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display text-xl font-semibold text-cream tracking-tight">MedCore</span>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="font-display text-4xl font-semibold text-cream leading-tight tracking-tight mb-4">
            Join the team.
          </h1>
          <p className="text-teal-200 text-base leading-relaxed">
            Sign up as front-desk staff or as a doctor. Admin access is
            granted separately by your hospital administrator and isn't
            available through self-signup.
          </p>
        </div>

        <div className="relative z-10 text-xs text-teal-400">
          © {new Date().getFullYear()} MedCore Hospital Systems
        </div>
      </div>

      {/* Right: signup form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-sm py-6">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-9 w-9 rounded-lg bg-coral-500 flex items-center justify-center">
              <Activity size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display text-lg font-semibold text-ink-900">MedCore</span>
          </div>

          <h2 className="font-display text-2xl font-semibold text-ink-900 mb-1.5">Create an account</h2>
          <p className="text-sm text-ink-600 mb-6">Choose the role that matches your position.</p>

          {submitted ? (
            <div className="text-center py-6">
              <div className="h-14 w-14 rounded-full bg-sage-50 flex items-center justify-center mx-auto mb-4">
                <Mail size={24} className="text-sage-700" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-lg font-semibold text-ink-900 mb-2">Check your email</h3>
              <p className="text-sm text-ink-600 mb-6">
                We sent a verification link to <span className="font-medium text-ink-800">{email}</span>.
                Click it to activate your account before signing in.
              </p>
              <button onClick={() => navigate("/login")} className="btn-secondary w-full">
                Back to sign in
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role picker */}
            <div>
              <label className="label-text">I am signing up as a…</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRole("RECEPTIONIST")}
                  className={`flex items-center gap-2 justify-center rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                    role === "RECEPTIONIST"
                      ? "border-teal-700 bg-teal-50 text-teal-900"
                      : "border-ink-200 text-ink-600 hover:bg-ink-50"
                  }`}
                >
                  <ClipboardList size={16} />
                  Receptionist
                </button>
                <button
                  type="button"
                  onClick={() => setRole("DOCTOR")}
                  className={`flex items-center gap-2 justify-center rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                    role === "DOCTOR"
                      ? "border-teal-700 bg-teal-50 text-teal-900"
                      : "border-ink-200 text-ink-600 hover:bg-ink-50"
                  }`}
                >
                  <Stethoscope size={16} />
                  Doctor
                </button>
              </div>
            </div>

            <div>
              <label className="label-text">Full Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder={role === "DOCTOR" ? "Dr. Jane Doe" : "Jane Doe"}
                autoComplete="name"
              />
            </div>
            <div>
              <label className="label-text">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@hospital.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label-text">Phone</label>
              <PhoneInput value={phone} onChange={setPhone} />
            </div>

            {role === "DOCTOR" && (
              <div className="space-y-4 pt-1 pb-1 border-t border-ink-100 mt-1">
                <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide pt-3">
                  Doctor details
                </p>
                <div>
                  <label className="label-text">Specialization</label>
                  <input
                    required
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="input-field"
                    placeholder="e.g. Cardiology"
                  />
                </div>
                <div>
                  <label className="label-text">Qualification</label>
                  <input
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="input-field"
                    placeholder="e.g. MD, DM Cardiology"
                  />
                </div>
                <div>
                  <label className="label-text">License Number</label>
                  <input
                    required
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="input-field"
                    placeholder="e.g. LIC-1042"
                  />
                </div>
                <div>
                  <label className="label-text">Consultation Fee</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(e.target.value)}
                    className="input-field"
                    placeholder="e.g. 800"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label-text">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
          )}

          {!submitted && (
            <p className="text-sm text-ink-600 mt-6 text-center">
              Already have an account?{" "}
              <button onClick={() => navigate("/login")} className="font-semibold text-teal-900 hover:underline">
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Same signature element as the login page, for visual continuity
function PulseBackground() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.18]"
      viewBox="0 0 600 800"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 400 L80 400 L110 320 L140 480 L170 200 L200 400 L600 400"
        stroke="#7FA88E"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M0 560 L120 560 L150 520 L180 600 L210 460 L240 560 L600 560"
        stroke="#258A8A"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M0 240 L150 240 L180 210 L210 270 L240 180 L270 240 L600 240"
        stroke="#258A8A"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
