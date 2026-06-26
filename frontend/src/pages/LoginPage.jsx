import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Activity, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/endpoints";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setNeedsVerification(false);
    try {
      await login(email, password);
      const redirectTo = location.state?.from || "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error || "Could not sign in. Check your credentials.";
      toast.error(errorMsg);
      if (status === 403 && errorMsg.toLowerCase().includes("verify")) {
        setNeedsVerification(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      await authApi.resendVerification(email);
      toast.success("If that account needs verification, a new link has been sent.");
    } catch {
      toast.error("Could not resend verification email. Please try again.");
    }
  }

  function fillDemo(role) {
    const creds = {
      admin: "admin@hospital.com",
      reception: "reception@hospital.com",
      doctor: "doctor1@hospital.com",
    };
    setEmail(creds[role]);
    setPassword("Password123!");
  }

  return (
    <div className="min-h-screen flex bg-cream">
      {/* Left: brand panel with signature pulse-line motif */}
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
            One system for every patient, visit, and invoice.
          </h1>
          <p className="text-teal-200 text-base leading-relaxed">
            Registration, scheduling, clinical notes, and billing — connected end to end,
            so nothing falls through the cracks between departments.
          </p>
        </div>

        <div className="relative z-10 text-xs text-teal-400">
          © {new Date().getFullYear()} MedCore Hospital Systems
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-9 w-9 rounded-lg bg-coral-500 flex items-center justify-center">
              <Activity size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display text-lg font-semibold text-ink-900">MedCore</span>
          </div>

          <h2 className="font-display text-2xl font-semibold text-ink-900 mb-1.5">Sign in</h2>
          <p className="text-sm text-ink-600 mb-7">Enter your staff credentials to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className="label-text">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
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
              {loading ? "Signing in…" : "Sign in"}
            </button>

            {needsVerification && (
              <button
                type="button"
                onClick={handleResend}
                className="text-sm text-teal-900 font-semibold hover:underline w-full text-center"
              >
                Resend verification email
              </button>
            )}
          </form>

          <div className="mt-8 pt-6 border-t border-ink-200">
            <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-3">Demo accounts</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => fillDemo("admin")} className="text-xs px-3 py-1.5 rounded-full bg-teal-50 text-teal-900 font-medium hover:bg-teal-100 transition-colors">
                Admin
              </button>
              <button onClick={() => fillDemo("reception")} className="text-xs px-3 py-1.5 rounded-full bg-sage-50 text-sage-700 font-medium hover:bg-sage-100 transition-colors">
                Receptionist
              </button>
              <button onClick={() => fillDemo("doctor")} className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 font-medium hover:bg-amber-100 transition-colors">
                Doctor
              </button>
            </div>
            <p className="text-xs text-ink-400 mt-3">Password for all demo accounts: Password123!</p>
          </div>

          <p className="text-sm text-ink-600 mt-6 text-center">
            New here?{" "}
            <button onClick={() => navigate("/signup")} className="font-semibold text-teal-900 hover:underline">
              Create an account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// Signature element: an ambient ECG/pulse line drifting across the brand panel
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
