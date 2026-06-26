import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// "vercel" = consolidated serverless functions using ?id=/?action= query
// params (api/patients.js, api/doctors.js, etc — see backend-vercel/).
// "express" = traditional path-based REST routes (api/patients/:id, etc
// — see backend/). Defaults to "express" for local development; set
// VITE_DEPLOYMENT_TARGET=vercel in .env when pointing at the Vercel backend.
export const DEPLOYMENT_TARGET = import.meta.env.VITE_DEPLOYMENT_TARGET || "express";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach the JWT token to every outgoing request, if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hms_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear stored auth and bounce to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("hms_token");
      localStorage.removeItem("hms_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
