import { useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function useIdleTimer(idleTime = 45 * 60 * 1000) {
  const { user, logout, extendSession } = useAuth();

  useEffect(() => {
    if (!user) return;

    let timeout;

    // Reset idle timer and extend session
    const resetTimer = async () => {
      clearTimeout(timeout);

      // Extend session locally
      extendSession();

      // Optionally, refresh access token from server if needed
      try {
        const res = await api.post("/api/refresh-token"); // Your backend refresh endpoint
        const { accessToken } = res.data;

        if (accessToken) {
          const userData = JSON.parse(sessionStorage.getItem("userData"));
          const newExpiry = new Date(Date.now() + idleTime);

          sessionStorage.setItem("accessToken", accessToken);
          sessionStorage.setItem("tokenExpiry", newExpiry.toISOString());

          // Update Auth context
          extendSession(); // already updates expiry in context
        }
      } catch (err) {
        console.warn("Token refresh failed, logging out.");
        logout();
      }

      // Set idle logout
      timeout = setTimeout(() => {
        alert("You have been logged out due to inactivity.");
        logout();
      }, idleTime);
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));

    // Initialize timer
    resetTimer();

    // Cleanup listeners
    return () => {
      clearTimeout(timeout);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [user, idleTime, logout, extendSession]);
}
