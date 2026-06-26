import api, { DEPLOYMENT_TARGET } from "./client";

const isVercel = DEPLOYMENT_TARGET === "vercel";

// ---------- Auth ----------
// On Vercel, every auth action goes through ONE function (api/auth.js)
// distinguished by ?action=. On Express, each action is its own route.
export const authApi = {
  login: (data) => (isVercel ? api.post("/auth?action=login", data) : api.post("/auth/login", data)),
  signup: (data) => (isVercel ? api.post("/auth?action=signup", data) : api.post("/auth/signup", data)),
  register: (data) => (isVercel ? api.post("/auth?action=register", data) : api.post("/auth/register", data)),
  addDoctor: (data) => (isVercel ? api.post("/auth?action=add-doctor", data) : api.post("/auth/add-doctor", data)),
  getMe: () => (isVercel ? api.get("/auth?action=me") : api.get("/auth/me")),
  updateProfile: (data) => (isVercel ? api.put("/auth?action=me", data) : api.put("/auth/me", data)),
  verifyEmail: (token) =>
    isVercel
      ? api.get("/auth", { params: { action: "verify-email", token } })
      : api.get("/auth/verify-email", { params: { token } }),
  resendVerification: (email) =>
    isVercel
      ? api.post("/auth?action=resend-verification", { email })
      : api.post("/auth/resend-verification", { email }),
};

// ---------- Patients ----------
export const patientsApi = {
  list: (params) => api.get("/patients", { params }),
  get: (id) => (isVercel ? api.get("/patients", { params: { id } }) : api.get(`/patients/${id}`)),
  create: (data) => api.post("/patients", data),
  update: (id, data) => (isVercel ? api.put("/patients", data, { params: { id } }) : api.put(`/patients/${id}`, data)),
  remove: (id) => (isVercel ? api.delete("/patients", { params: { id } }) : api.delete(`/patients/${id}`)),
};

// ---------- Doctors ----------
export const doctorsApi = {
  list: (params) => api.get("/doctors", { params }),
  get: (id) => (isVercel ? api.get("/doctors", { params: { id } }) : api.get(`/doctors/${id}`)),
  update: (id, data) => (isVercel ? api.put("/doctors", data, { params: { id } }) : api.put(`/doctors/${id}`, data)),
  updateStatus: (id, isActive) =>
    isVercel
      ? api.put("/doctors", { isActive }, { params: { id, action: "status" } })
      : api.put(`/doctors/${id}/status`, { isActive }),
  addSchedule: (id, data) =>
    isVercel
      ? api.post("/doctors", data, { params: { id, action: "schedules" } })
      : api.post(`/doctors/${id}/schedules`, data),
  removeSchedule: (id, scheduleId) =>
    isVercel
      ? api.delete("/doctors", { params: { id, action: "schedules", scheduleId } })
      : api.delete(`/doctors/${id}/schedules/${scheduleId}`),
  getAvailability: (id, date) =>
    isVercel
      ? api.get("/doctors", { params: { id, action: "availability", date } })
      : api.get(`/doctors/${id}/availability`, { params: { date } }),
};

// ---------- Appointments ----------
export const appointmentsApi = {
  list: (params) => api.get("/appointments", { params }),
  get: (id) => (isVercel ? api.get("/appointments", { params: { id } }) : api.get(`/appointments/${id}`)),
  create: (data) => api.post("/appointments", data),
  update: (id, data) =>
    isVercel ? api.put("/appointments", data, { params: { id } }) : api.put(`/appointments/${id}`, data),
  cancel: (id) => (isVercel ? api.delete("/appointments", { params: { id } }) : api.delete(`/appointments/${id}`)),
};

// ---------- Medical Records ----------
export const medicalRecordsApi = {
  list: (params) => api.get("/medical-records", { params }),
  get: (id) => (isVercel ? api.get("/medical-records", { params: { id } }) : api.get(`/medical-records/${id}`)),
  create: (data) => api.post("/medical-records", data),
  update: (id, data) =>
    isVercel ? api.put("/medical-records", data, { params: { id } }) : api.put(`/medical-records/${id}`, data),
};

// ---------- Billing ----------
export const billingApi = {
  list: (params) => api.get("/bills", { params }),
  get: (id) => (isVercel ? api.get("/bills", { params: { id } }) : api.get(`/bills/${id}`)),
  create: (data) => api.post("/bills", data),
  update: (id, data) => (isVercel ? api.put("/bills", data, { params: { id } }) : api.put(`/bills/${id}`, data)),
  recordPayment: (id, data) =>
    isVercel
      ? api.post("/bills", data, { params: { id, action: "payments" } })
      : api.post(`/bills/${id}/payments`, data),
};

// ---------- Dashboard ----------
export const dashboardApi = {
  summary: () => (isVercel ? api.get("/dashboard", { params: { action: "summary" } }) : api.get("/dashboard/summary")),
  appointmentsTrend: (days) =>
    isVercel
      ? api.get("/dashboard", { params: { action: "appointments-trend", days } })
      : api.get("/dashboard/appointments-trend", { params: { days } }),
  revenueTrend: (months) =>
    isVercel
      ? api.get("/dashboard", { params: { action: "revenue-trend", months } })
      : api.get("/dashboard/revenue-trend", { params: { months } }),
  doctorLoad: () =>
    isVercel
      ? api.get("/dashboard", { params: { action: "doctor-load" } })
      : api.get("/dashboard/doctor-load"),
};
