import axios from "axios";

const envBaseURL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
const inferredBaseURL =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : `http://${window.location.hostname}:5000`;
const baseURL = envBaseURL || inferredBaseURL;

export const apiUrl = (path) => {
  if (!path) return baseURL;
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }
  return `${baseURL}${path.startsWith("/") ? path : `/${path}`}`;
};

const api = axios.create({
  baseURL,              
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
