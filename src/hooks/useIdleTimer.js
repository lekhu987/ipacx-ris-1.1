import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function useIdleTimer(idleTime = 45 * 60 * 1000) {
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!user) return;

    let timer;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        alert("Logged out due to inactivity");
        logout();
      }, idleTime);
    };

    ["mousemove", "keydown", "click", "scroll"].forEach((event) =>
      window.addEventListener(event, resetTimer)
    );

    resetTimer();

    return () => {
      clearTimeout(timer);
      ["mousemove", "keydown", "click", "scroll"].forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );
    };
  }, [user, idleTime, logout]);
}
