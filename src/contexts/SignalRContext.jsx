import { createContext, useContext, useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import PropTypes from "prop-types";
import jwt_decode from "jwt-decode";
import Cookies from "js-cookie";

const SignalRContext = createContext(null);

export const useSignalR = () => useContext(SignalRContext);

export const SignalRProvider = ({ children }) => {
  const [connection, setConnection] = useState(null);
  const [connectionId, setConnectionId] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const signalRUrl = import.meta.env.VITE_SIGNALR_URL || "https://localhost:7059/chathub";

    const connect = new signalR.HubConnectionBuilder()
      .withUrl(signalRUrl, { withCredentials: true })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connect.on("ReceiveOnlineUsers", (users) => {
      console.log("Received online users:", users);
      setOnlineUsers((prevUsers) => {
        const userIds = new Set(prevUsers.map(user => user.userId));
        return [...prevUsers, ...users.filter(user => !userIds.has(user.userId))];
      });
    });


    connect.on("UserDisconnected", (userId) => {
      console.log("User disconnected:", userId);
      setOnlineUsers((prevUsers) => prevUsers.filter(user => user.userId !== userId));
    });

    connect.start()
      .then(async () => {
        console.log("Connected!");
        setConnectionId(connect.connectionId);
        setConnection(connect);

        const tokenFromStorage = Cookies.get("token");
        if (tokenFromStorage) {
          const decodedToken = jwt_decode(tokenFromStorage);
          const userId = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
          const userName = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];
          const avatar = decodedToken["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/country"];
          try {
            await connect.invoke('RegisterUser', { userId, userName, avatar });
            console.log(`User ${userName} registered successfully`);
          } catch (error) {
            console.error('Error registering user:', error);
          }
        } else {
          console.warn('No token found in cookies.');
        }
      })
      .catch((err) => {
        console.error("Connection failed: ", err);
      });

    return () => {
      connect.stop();
    };
  }, []);

  return (
    <SignalRContext.Provider value={{ connection, connectionId, onlineUsers }}>
      {children}
    </SignalRContext.Provider>
  );
};

SignalRProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
