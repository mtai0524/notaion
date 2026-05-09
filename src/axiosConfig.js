import axios from "axios";
import config from "./config";
import Cookies from "js-cookie";

const instance = axios.create({
  baseURL: config.API_LOCAL,
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
