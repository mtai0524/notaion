import "./Login.scss";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import axiosInstance from "../../../axiosConfig";

const Login = () => {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const navigate = useNavigate();

  const handleSignIn = async (event) => {
    event.preventDefault();

    try {
      const response = await axiosInstance.post("/api/account/SignIn", {
        email: emailOrUsername,
        password: password,
      });

      if (response.status === 200) {
        setToken(response.data.token);
        Cookies.set("token", response.data.token, { expires: 1 });
        console.log(token);
        navigate("/home-page");
      }
    } catch (err) {
      console.log(err);
    }
  };
  return (
    <div className="login-container">
      <h1 className="font-bold text-xl">Login</h1>
      <br></br>
      <form onSubmit={handleSignIn} className="login-form">
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
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
