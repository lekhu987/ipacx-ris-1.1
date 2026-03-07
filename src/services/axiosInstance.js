import axios from "axios";

const envBaseURL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
const inferredBaseURL = `${window.location.protocol}//${window.location.hostname}:5000/api`;
const baseURL = envBaseURL || inferredBaseURL;

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default axiosInstance;
