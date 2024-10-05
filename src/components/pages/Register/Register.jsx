import { useState } from "react";
import "./Register.scss";
import { Link } from "react-router-dom";
import axiosInstance from "../../../axiosConfig";
import { message, Spin, AutoComplete } from "antd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleRight } from "@fortawesome/free-regular-svg-icons";
import { useNavigate } from "react-router-dom";

const Register = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const navigate = useNavigate();
  const setAvatarRandom = () => {
    const seed = Math.floor(Math.random() * 1000000000);
    const avatarUrl = `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`;
    return avatarUrl;
  };

  const handleSearch = (value) => {
    setOptions(() => {
      if (!value || value.includes('@')) {
        return [];
      }
      return ['gmail.com', 'outlook.com.vn', 'devpro.com.vn', 'yahoo.com'].map((domain) => ({
        label: `${value}@${domain}`,
        value: `${value}@${domain}`,
      }));
    });
    setEmail(value);
  };

  const handleSelect = (value) => {
    setEmail(value);
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setLoading(true);
    const avatarUrl = setAvatarRandom();
    const finalEmail = email.includes("@") ? email : `${email}@gmail.com`;
    const userData = {
      username,
      email: finalEmail,
      password,
      avatar: avatarUrl,
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
        localStorage.setItem("userData", JSON.stringify(userData));
        message.loading("Redirecting to login...", 1).then(() => {
          setTimeout(() => {
            navigate("/login");
          }, 1000);
        });
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        const errors = error.response.data.errors;
        message.error(errors);
      } else {
        message.error("An unexpected error occurred.");
        console.error("An unexpected error occurred:", error.message);
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="login-container">
      <div>
        <h1 className="font-bold text-xl text-center">Register</h1>
        <br />
        <Spin spinning={loading}>
          <form onSubmit={handleRegister} className="login-form">
            <div className="form-group">
              <label htmlFor="username">username</label>
              <input
                type="text"
                id="username"
                className="text-sm pl-[10px]"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">email</label>
              <AutoComplete
                className="text-sm "
                style={{
                  width: "108%",
                  marginLeft: '-10px',
                  outline: 'none',
                  border: 'none',
                }}
                onSelect={handleSelect}
                onSearch={handleSearch}
                options={options}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">password</label>
              <input
                className="text-sm pl-[10px]"
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
        </Spin>
        <div className="flex justify-end w-full">
          <Link type="submit" to="/login" className="switch-btn">
            <FontAwesomeIcon icon={faCircleRight} /> Login
          </Link>
        </div>
      </div>
    </div>
  );
};
export default Register;
