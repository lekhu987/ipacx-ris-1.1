// src/hooks/useTokenTimer.js
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getTokenExpiry, getRemainingTime } from "../utils/tokenUtils";

export default function useTokenTimer() {
  const [timeLeft, setTimeLeft] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const expiry = getTokenExpiry(token);
    if (!expiry) return;

    const updateTimer = () => {
      const remaining = getRemainingTime(expiry);

      if (remaining === "Expired") {
        localStorage.removeItem("token");
        //localStorage.removeItem("token_expiry");
        navigate("/login"); // redirect to login
        return;
      }

      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [navigate]);

  return timeLeft;
}
