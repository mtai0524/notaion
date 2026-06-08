import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import Cookies from "js-cookie";
import { message, Spin } from "antd";
import jwt_decode from "jwt-decode";
import * as signalR from "@microsoft/signalr";
import config from "../../../config";

const LoginSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");

    if (token) {
      setToken(token);
      Cookies.set("token", token, { expires: 7 });
      message.success("Discord login successful!");
      
      // Trigger SignalR registration similar to manual login
      handleSignalRRegistration(token);
      
      navigate("/home-page");
    } else {
      message.error("Login failed. No token received.");
      navigate("/login");
    }
  }, [location, navigate, setToken]);

  const handleSignalRRegistration = async (token) => {
    const signalRUrl = config.SIGNALR_URL;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(signalRUrl, { withCredentials: true })
      .withAutomaticReconnect()
      .build();

    try {
      await connection.start();
      const decodedToken = jwt_decode(token);
      const userId = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
      const userName = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];
      const avatar = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/country"];

      await connection.invoke("RegisterUser", {
        UserId: userId,
        UserName: userName,
        Avatar: avatar,
      });
    } catch (err) {
      console.error("SignalR error in LoginSuccess:", err);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#fdfcf8' }}>
      <div style={{ textAlign: 'center' }}>
        <Spin size="large" />
        <h2 style={{ marginTop: '20px', fontFamily: 'Mali' }}>Authenticating with Discord...</h2>
      </div>
    </div>
  );
};

export default LoginSuccess;
