import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Activity, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { authApi } from "../api/endpoints";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token. Please use the link from your email.");
      return;
    }

    authApi
      .verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.data.message || "Email verified successfully.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.error || "Verification failed. The link may have expired.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-6">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-9 w-9 rounded-lg bg-coral-500 flex items-center justify-center">
            <Activity size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display text-lg font-semibold text-ink-900">MedCore</span>
        </div>

        <div className="card p-8">
          {status === "verifying" && (
            <>
              <Loader2 size={32} className="mx-auto mb-4 text-teal-700 animate-spin" />
              <h2 className="font-display text-lg font-semibold text-ink-900 mb-1">Verifying your email…</h2>
              <p className="text-sm text-ink-600">This will just take a moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="h-14 w-14 rounded-full bg-sage-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={26} className="text-sage-700" strokeWidth={1.75} />
              </div>
              <h2 className="font-display text-lg font-semibold text-ink-900 mb-1.5">Email verified</h2>
              <p className="text-sm text-ink-600 mb-6">{message}</p>
              <button onClick={() => navigate("/login")} className="btn-primary w-full">
                Continue to sign in
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="h-14 w-14 rounded-full bg-coral-50 flex items-center justify-center mx-auto mb-4">
                <XCircle size={26} className="text-coral-600" strokeWidth={1.75} />
              </div>
              <h2 className="font-display text-lg font-semibold text-ink-900 mb-1.5">Verification failed</h2>
              <p className="text-sm text-ink-600 mb-6">{message}</p>
              <Link to="/login" className="btn-secondary w-full inline-flex">
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
