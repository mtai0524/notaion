import axios from "axios";
import config from "./config";
import Cookies from "js-cookie";

const instance = axios.create({
  baseURL: window.location.hostname === "localhost" 
    ? config.API_LOCAL 
    : config.API_HOSTING,
});

// Add a request interceptor
instance.interceptors.request.use(
  (config) => {
    const token = Cookies.get("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default instance;
