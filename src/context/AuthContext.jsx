import React, { createContext, useContext, useState, useEffect } from "react";

// Create Auth Context
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on page reload
  useEffect(() => {
    const userData = sessionStorage.getItem("userData");

    if (userData) {
      setUser(JSON.parse(userData));
    }

    setLoading(false);
  }, []);

  // Login function
  const login = (userData) => {
    setUser(userData);
    sessionStorage.setItem("userData", JSON.stringify(userData));
  };

  // Logout function
  const logout = async () => {
    setUser(null);
    sessionStorage.clear();

    try {
      // Call backend to clear cookies
      await fetch("http://localhost:5000/api/auth/logout", {
        method: "POST",
        credentials: "include", // important to send cookies
      });
    } catch (err) {
      console.error("Logout error:", err);
    }

    window.location.href = "/"; // redirect to login
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Custom hook for easy usage
export const useAuth = () => useContext(AuthContext);
