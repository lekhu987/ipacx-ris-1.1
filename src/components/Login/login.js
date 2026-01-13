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

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      return alert("Please enter username and password");
    }

    try {
      setLoading(true);

      // Send login request with credentials
      const res = await api.post(
        "/api/auth/login",
        { username, password },
        { withCredentials: true } // important to receive cookies
      );

      // Backend sends user info in response
      if (!res.data || !res.data.user) {
        console.error("Server response:", res.data);
        return alert("Login failed: invalid server response");
      }

      const { user } = res.data;

      // Save user in AuthContext/sessionStorage
      login(user);

      // Navigate to dashboard
      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);

      if (err.response?.data?.message) {
        alert(err.response.data.message);
      } else {
        alert("Login failed: server not reachable");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>iPacx RIS Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="text"
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
          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
