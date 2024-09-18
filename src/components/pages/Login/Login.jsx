// Login.js
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { message, Spin } from "antd";
import axiosInstance from "../../../axiosConfig";
import { useAuth } from "../../../contexts/AuthContext";
import "./Login.scss";
import Cookies from "js-cookie";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleRight } from "@fortawesome/free-regular-svg-icons";
import { HubConnectionBuilder } from "@microsoft/signalr";
import * as signalR from "@microsoft/signalr";
import jwt_decode from "jwt-decode";
const Login = () => {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setToken } = useAuth();

  useEffect(() => {
    const userDataSession = JSON.parse(localStorage.getItem('userData'));

    if (userDataSession) {
      setEmailOrUsername(userDataSession.username);
      setPassword(userDataSession.password);
    }
  }, []);

  const handleLoginSuccess = async () => {
    const signalRUrl = import.meta.env.VITE_SIGNALR_URL || "https://localhost:7059/chathub";

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(signalRUrl, { withCredentials: true })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    if (!connection) {
      console.error("SignalR connection is not initialized");
      return;
    }

    try {
      await connection.start();
      console.log("Connected to SignalR");


      const tokenFromStorage = Cookies.get("token");
      if (tokenFromStorage) {
        const decodedToken = jwt_decode(tokenFromStorage);
        const userId = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
        const userNameToken = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];
        const avatar = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/country"];

        try {
          await connection.invoke("RegisterUser", { UserId: userId, UserName: userNameToken, Avatar: avatar })
            .catch(err => console.error("Error while calling RegisterUser: ", err));
          console.log(`User ${userNameToken} registered successfully`);
        } catch (error) {
          console.error('Error registering user:', error);
        }
      } else {
        console.warn('No token found in cookies.');
      }

    } catch (err) {
      console.error("SignalR connection error: ", err);
    }

    navigate("/home-page");
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const formData = {
        email: emailOrUsername,
        password: password,
        username: emailOrUsername,
      };

      const response = await axiosInstance.post("/api/account/SignIn", formData);

      if (response.status === 200) {
        const data = response.data;
        setToken(data.token);
        Cookies.set("token", data.token, { expires: 7 });
        message.success("Login successful");
        localStorage.setItem('userData', JSON.stringify(formData));

        handleLoginSuccess();
      }
    } catch (err) {
      if (err.response) {
        const errorMessage = err.response.data.message || [];
        message.error(errorMessage);
      } else if (err.request) {
        console.log(err.request);
        message.error("Server no response");
      } else {
        console.log("Error", err.message);
        message.error("An error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div>
        <h1 className="font-bold text-xl text-center">Login</h1>
        <br />
        <Spin spinning={loading}>
          <form onSubmit={handleSignIn} className="login-form">
            <div className="form-group">
              <label htmlFor="username">username or email</label>
              <input
                type="text"
                id="username"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="login-button">
              Login
            </button>
          </form>
        </Spin>
        <div className="flex justify-end w-full">
          <Link type="submit" to="/register" className="switch-btn">
            <FontAwesomeIcon icon={faCircleRight} /> Register
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
