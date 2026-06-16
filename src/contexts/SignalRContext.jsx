import { createContext, useContext, useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import PropTypes from "prop-types";
import jwt_decode from "jwt-decode";
import Cookies from "js-cookie";
import config from "../config";

const SignalRContext = createContext(null);

export const useSignalR = () => useContext(SignalRContext);

export const SignalRProvider = ({ children }) => {
  const [connection, setConnection] = useState(null);
  const [connectionId, setConnectionId] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  // userId -> last-seen ISO string, updated live when someone goes offline.
  const [lastSeenMap, setLastSeenMap] = useState({});

  useEffect(() => {
    const signalRUrl = config.SIGNALR_URL;

    const connect = new signalR.HubConnectionBuilder()
      .withUrl(signalRUrl, {
        accessTokenFactory: () => Cookies.get("token"),
        withCredentials: true
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connect.on("ReceiveOnlineUsers", (users) => {
      console.log("Received online users:", users);
      const now = new Date().toISOString();
      setOnlineUsers((prevUsers) => {
        const prevMap = new Map(prevUsers.map((u) => [u.userId, u]));
        // Keep an `onlineSince` stamp per user so the UI can show how long
        // they've been active. Existing users keep their original stamp;
        // newly-seen users get stamped now.
        const merged = [...prevUsers];
        for (const u of users) {
          if (!prevMap.has(u.userId)) {
            merged.push({ ...u, onlineSince: now });
          }
        }
        return merged;
      });
    });


    connect.on("UserDisconnected", (userId, lastSeen) => {
      console.log("User disconnected:", userId, lastSeen);
      setOnlineUsers((prevUsers) => prevUsers.filter(user => user.userId !== userId));
      setLastSeenMap((prev) => ({
        ...prev,
        [userId]: lastSeen || new Date().toISOString(),
      }));
    });

    connect.start()
      .then(async () => {
        console.log("Connected!");
        setConnectionId(connect.connectionId);
        setConnection(connect);

        // Đăng ký nhận tin nhắn ngay khi vừa kết nối thành công
        connect.on("ReceiveMessage", (user, receivedMessage) => {
            console.log(`[Global-SignalR] Received from ${user}: ${receivedMessage}`);
            const event = new CustomEvent("new-signalr-message", {
                detail: { user, content: receivedMessage }
            });
            window.dispatchEvent(event);
        });

        // Private messages broadcast — Header + các listener khác có thể subscribe
        // BE param order (ChatPrivateController.AddChat):
        //   senderId, receiverId, content, senderUserName(currentUser), receiverUserName(friendUser)
        connect.on("ReceiveMessagePrivate", (senderId, receiverId, message, senderUserName, receiverUserName) => {
            console.log(`[Global-SignalR] Private ${senderUserName}(${senderId}) → ${receiverUserName}(${receiverId}): ${message}`);
            const event = new CustomEvent("new-signalr-private-message", {
                detail: { senderId, receiverId, message, senderUserName, receiverUserName, sentAt: new Date().toISOString() }
            });
            window.dispatchEvent(event);
        });

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
    <SignalRContext.Provider value={{ connection, connectionId, onlineUsers, lastSeenMap }}>
      {children}
    </SignalRContext.Provider>
  );
};

SignalRProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
