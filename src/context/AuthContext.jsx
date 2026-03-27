import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";
import { getTokenExpiry } from "../utils/tokenUtils";
import { logLogoutEvent } from "../utils/auditClient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore user and token from sessionStorage, then verify with /api/me
  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      const storedToken = sessionStorage.getItem("token");
      if (!storedToken) {
        if (isActive) setLoading(false);
        return;
      }

      try {
        const res = await api.get("/api/me");
        const userData = res.data?.user || null;
        if (isActive) {
          if (userData) {
            setUser(userData);
            setToken(storedToken);
            sessionStorage.setItem("user", JSON.stringify(userData));
          } else {
            sessionStorage.removeItem("user");
            sessionStorage.removeItem("token");
          }
        }
      } catch {
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("token");
        if (isActive) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isActive) setLoading(false);
      }
    };

    bootstrap();
    return () => {
      isActive = false;
    };
  }, []);

  // Login with token
  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    sessionStorage.setItem("user", JSON.stringify(userData));
    sessionStorage.setItem("token", authToken);
  };

  // Logout
  const logout = async () => {
    try {
      await logLogoutEvent();
    } catch {
      // no-op
    }
    setUser(null);
    setToken(null);
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");
    window.location.href = "/";
  };

  // Expire token (for idle timeout)
  const expireToken = () => {
    setToken(null);
    sessionStorage.removeItem("token");
    // Keep user data for potential re-login, but clear token
  };

  // Setup idle timeout for auto-logout
  useEffect(() => {
    let timeoutId;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      if (token) {
        // 15 minutes = 15 * 60 * 1000 ms
        timeoutId = setTimeout(() => {
          logout();
          alert("You have been automatically logged out due to 15 minutes of inactivity.");
        }, 15 * 60 * 1000);
      }
    };

    if (token) {
      // Listen to these events to detect activity
      const events = ["mousemove", "keydown", "scroll", "click"];
      events.forEach((event) => window.addEventListener(event, resetTimer));

      // Start the timer initially
      resetTimer();

      // Cleanup
      return () => {
        clearTimeout(timeoutId);
        events.forEach((event) => window.removeEventListener(event, resetTimer));
      };
    }
  }, [token]);

  // Refresh token before expiry
  useEffect(() => {
    let refreshTimer;

    const scheduleRefresh = async () => {
      if (!token) return;
      const expiry = getTokenExpiry(token);
      if (!expiry) return;

      const now = Date.now();
      const refreshAt = Math.max(expiry - 5 * 60 * 1000, now + 10 * 1000);
      const delay = Math.max(refreshAt - now, 1000);

      refreshTimer = setTimeout(async () => {
        try {
          const res = await api.post("/api/refresh");
          const newToken = res.data?.token;
          const userData = res.data?.user;
          if (newToken) {
            setToken(newToken);
            sessionStorage.setItem("token", newToken);
            if (userData) {
              setUser(userData);
              sessionStorage.setItem("user", JSON.stringify(userData));
            }
          }
        } catch {
          sessionStorage.removeItem("user");
          sessionStorage.removeItem("token");
          setUser(null);
          setToken(null);
          window.location.href = "/";
        }
      }, delay);
    };

    scheduleRefresh();
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [token]);


  return (
    <AuthContext.Provider value={{ user, token, login, logout, expireToken, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
