import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "../api/endpoints";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("hms_token");
    const storedUser = localStorage.getItem("hms_user");

    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      // Verify token is still valid in the background
      authApi
        .getMe()
        .then((res) => {
          setUser(res.data.user);
          localStorage.setItem("hms_user", JSON.stringify(res.data.user));
        })
        .catch(() => {
          localStorage.removeItem("hms_token");
          localStorage.removeItem("hms_user");
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    const { user: loggedInUser, token } = res.data;
    localStorage.setItem("hms_token", token);
    localStorage.setItem("hms_user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const signup = useCallback(async (data) => {
    // No token comes back anymore — the new account is unverified until
    // they click the link in their email, so we don't log them in here.
    const res = await authApi.signup(data);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hms_token");
    localStorage.removeItem("hms_user");
    setUser(null);
  }, []);

  /**
   * Re-fetches the current user from the server and updates both state
   * and localStorage. Used after profile edits so the sidebar avatar,
   * name, etc. reflect changes immediately without needing a full
   * page reload or re-login.
   */
  const refreshUser = useCallback(async () => {
    const res = await authApi.getMe();
    setUser(res.data.user);
    localStorage.setItem("hms_user", JSON.stringify(res.data.user));
    return res.data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
