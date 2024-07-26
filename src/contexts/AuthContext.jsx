import { createContext, useContext, useState, useEffect } from "react";
import * as jwt_decode from "jwt-decode";
import PropTypes from "prop-types";
import Cookies from "js-cookie";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [token, setTokenCookie] = useState(null);

  useEffect(() => {
    const tokenFromStorage = Cookies.get("token");

    if (tokenFromStorage) {
      try {
        const decodedToken = jwt_decode(tokenFromStorage);
        const userEmail =
          decodedToken[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
          ];
        setIsLoggedIn(true);
        setEmail(userEmail);
        setTokenCookie(tokenFromStorage);
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    }
  }, []);

  const setToken = (newToken) => {
    setTokenCookie(newToken);
    Cookies.set("token", newToken, { expires: 7 });
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, email, token, setToken }}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
