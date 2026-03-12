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

  // ✅ Handle login
  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent page reload

    if (!username || !password) {
      alert("Please enter username and password");
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/api/login", { username, password });

      if (!res.data || !res.data.user) {
        alert("Login failed");
        return;
      }

      // Save user context
      login(res.data.user, res.data.token);

      // Navigate to dashboard
      navigate("/dashboard");
    } catch (err) {
      if (err.response?.data?.message) {
        alert(err.response.data.message);
      } else {
        alert("Server not reachable");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Left Side: Branding/Illustration */}
        <div className="login-left">
          <div className="branding">
            <h1>iPacx RIS</h1>
          </div>
          <div className="illustration-wrapper">
            {/* Soft decorative circles for modern feel */}
            <div className="circle circle-1"></div>
            <div className="circle circle-2"></div>
            <div className="circle circle-3"></div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="login-right">
          <div className="form-wrapper">
            <h2>Welcome Back</h2>
            <p className="subtitle">Please enter your details to sign in.</p>

            <form onSubmit={handleLogin} className="login-form">
              <div className="input-group">
                <label>Username</label>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "Logging in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
