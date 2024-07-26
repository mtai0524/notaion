import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../../axiosConfig";
import { useAuth } from "../../../contexts/AuthContext";
import "./Login.scss";

const Login = () => {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { setToken } = useAuth(); // Access the setToken function from context

  const handleLoginSuccess = () => {
    navigate("/home-page");
  };

  const handleSignIn = async (event) => {
    event.preventDefault();

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
        const data = await response.data;
        setToken(data.token);
        handleLoginSuccess();
      } else {
        console.error("Failed to sign in:", response.statusText);
      }
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="login-container">
      <h1 className="font-bold text-xl">Login</h1>
      <br />
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
    </div>
  );
};

export default Login;
