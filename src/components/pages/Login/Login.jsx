import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { message, Spin } from "antd";
import axiosInstance from "../../../axiosConfig";
import { useAuth } from "../../../contexts/AuthContext";
import "./Login.scss";
import Cookies from "js-cookie";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleRight } from "@fortawesome/free-regular-svg-icons";

const Login = () => {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setToken } = useAuth();

  const handleLoginSuccess = async () => {
    navigate("/home-page");
  };
  const handleSignIn = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const formData = {
        email: emailOrUsername,
        password: password,
      };

      const response = await axiosInstance.post(
        "/api/account/SignIn",
        formData
      );

      if (response.status === 200) {
        const data = response.data;
        setToken(data.token);
        Cookies.set("token", data.token, { expires: 7 });
        message.success("Login successful");
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
