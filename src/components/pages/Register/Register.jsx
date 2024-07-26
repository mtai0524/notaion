import { useState } from "react";
import "./Register.scss";
import { Link } from "react-router-dom";
import axiosInstance from "../../../axiosConfig";
import { message } from "antd";

const Register = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (event) => {
    event.preventDefault();

    const userData = {
      username,
      email,
      password,
    };

    try {
      const response = await axiosInstance.post(
        "/api/account/SignUp",
        userData,
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.status === 200) {
        message.success("Register successful");
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        const errors = error.response.data.errors;
        message.error(errors);
      } else {
        message.error("An unexpected error occurred.");
        console.error("An unexpected error occurred:", error.message);
      }
    }
  };

  return (
    <div className="login-container">
      <h1 className="font-bold text-xl">Login</h1>
      <br />
      <form onSubmit={handleRegister} className="login-form">
        <div className="form-group">
          <label htmlFor="username">username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          Register
        </button>
      </form>
      <Link type="submit" to="/login" className="main-button">
        Login
      </Link>
    </div>
  );
};

export default Register;
