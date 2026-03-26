import axios from "axios";

const envBaseURL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
const inferredBaseURL =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : `http://${window.location.hostname}:5000`;
const baseURL = envBaseURL || inferredBaseURL;

export const apiUrl = (path) => {
  const raw =
    typeof path === "string"
      ? path
      : path && typeof path === "object"
      ? (path.image_path || path.path || path.url || "")
      : "";

  if (!raw) return baseURL;
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }
  return `${baseURL}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

const api = axios.create({
  baseURL,              
  withCredentials: true,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    try {
      const user = JSON.parse(sessionStorage.getItem("user") || "null");
      const token = sessionStorage.getItem("token");
      if (token) config.headers.Authorization = `Bearer ${token}`;
      if (user?.username) config.headers["x-audit-username"] = user.username;
      if (user?.role) config.headers["x-audit-role"] = user.role;
      if (user?.session_id) config.headers["x-audit-session"] = user.session_id;
    } catch {
      // no-op
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const token = sessionStorage.getItem("token");
      const onLoginPage = window.location.pathname === "/";
      if (token && !onLoginPage) {
        // Token expired or invalid
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("token");
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Patch global fetch to include Authorization for API calls.
if (typeof window !== "undefined" && !window.__authFetchPatched) {
  const originalFetch = window.fetch.bind(window);
  window.__authFetchPatched = true;
  window.fetch = (input, init = {}) => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      return originalFetch(input, init);
    }

    const requestUrl =
      typeof input === "string"
        ? input
        : input && input.url
        ? input.url
        : "";
    const isApiCall =
      requestUrl.startsWith(baseURL) || requestUrl.startsWith("/");

    if (!isApiCall) {
      return originalFetch(input, init);
    }

    const headers = new Headers(
      (init && init.headers) || (input && input.headers) || undefined
    );
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return originalFetch(input, { ...init, headers });
  };
}
