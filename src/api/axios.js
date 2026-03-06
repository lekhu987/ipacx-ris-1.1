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
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
