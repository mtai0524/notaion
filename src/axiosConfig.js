import axios from "axios";
import config from "./config";
import Cookies from "js-cookie";

const instance = axios.create({
  baseURL: config.API_LOCAL,
});

export default instance;
