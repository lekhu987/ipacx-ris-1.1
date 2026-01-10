// src/components/Login/login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import "./login.css";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!username || !password) {
      return alert("Please enter username and password");
    }

    try {
      setLoading(true);

      // Call login API
      const res = await api.post("/api/login", { username, password });
      console.log("FULL LOGIN RESPONSE:", res);

      if (!res.data || !res.data.accessToken || !res.data.user) {
        console.error("Invalid login response:", res.data);
        alert("Login failed: invalid server response");
        return;
      }

      const { user, accessToken } = res.data;

      // Set 45-minute expiry
      const expiry = new Date(Date.now() + 45 * 60 * 1000);

      // Save session
      sessionStorage.setItem("accessToken", accessToken);
      sessionStorage.setItem("userData", JSON.stringify(user));
      sessionStorage.setItem("tokenExpiry", expiry.toISOString());
      sessionStorage.setItem("isSessionAuth", "true");

      // Update Auth Context
      login({
        ...user,
        accessToken,  
        tokenExpiry: expiry.toISOString(),
      });

      // Redirect all users to dashboard
      navigate("/dashboard");

    } catch (err) {
      if (err.response) {
        console.error("Login error response:", err.response.data);
        alert(err.response.data.message || "Login failed: wrong credentials");
      } else {
        console.error("Login error:", err);
        alert("Login failed: server not reachable");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Login</h2>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleLogin} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  );
}

export default Login;
