import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from storage
  useEffect(() => {
    const sessionAuth = sessionStorage.getItem("isSessionAuth");
    const userData = sessionStorage.getItem("userData");
    const token = sessionStorage.getItem("accessToken");
    const tokenExpiry = sessionStorage.getItem("tokenExpiry");

    if (sessionAuth === "true" && userData && token && tokenExpiry) {
      const expiryTime = new Date(tokenExpiry).getTime();
      if (Date.now() < expiryTime) {
        setUser({
          ...JSON.parse(userData),
          accessToken: token,
          tokenExpiry,
        });
      } else {
        // Session expired, clear storage without setting state
        sessionStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  // Auto-logout effect
  useEffect(() => {
    if (!user || !user.tokenExpiry) return;

    const expiryTime = new Date(user.tokenExpiry).getTime();
    const timeout = expiryTime - Date.now();

    if (timeout <= 0) {
      logout();
    } else {
      const timer = setTimeout(() => {
        alert("Session expired. Please login again.");
        logout();
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [user]);

  // Login
  const login = (userData) => {
    // Compute 45 min expiry
    const expiry = new Date(Date.now() + 45 * 60 * 1000);
    const userWithExpiry = { ...userData, tokenExpiry: expiry.toISOString() };

    setUser(userWithExpiry);

    sessionStorage.setItem("isSessionAuth", "true");
    sessionStorage.setItem("accessToken", userData.accessToken);
    sessionStorage.setItem("userData", JSON.stringify(userData));
    sessionStorage.setItem("tokenExpiry", expiry.toISOString());
  };

  // Logout
  const logout = () => {
    setUser(null);
    sessionStorage.clear();
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
