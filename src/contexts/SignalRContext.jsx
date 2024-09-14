import { createContext, useContext, useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import PropTypes from "prop-types";

const SignalRContext = createContext(null);

export const useSignalR = () => useContext(SignalRContext);

export const SignalRProvider = ({ children }) => {
  const [connection, setConnection] = useState(null);
  const [connectionId, setConnectionId] = useState(null);

  useEffect(() => {
    const signalRUrl =
      import.meta.env.VITE_SIGNALR_URL || "https://localhost:7059/chathub";

    const connect = new signalR.HubConnectionBuilder()
      .withUrl(signalRUrl, {
        withCredentials: true,
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connect.start()
      .then(() => {
        console.log("Connected!");
        setConnectionId(connect.connectionId);
        setConnection(connect);


        connection.on("ReceiveFriendRequest", (requesterId, requesterName) => {
          console.log("Received friend request from:", requesterName);
        });
      })
      .catch((err) => {
        console.error("Connection failed: ", err);
      });

    return () => {
      connect
        .stop()
        .then(() => {
          console.log("Disconnected!");
        })
        .catch((err) => {
          console.error("Disconnection failed: ", err);
        });
    };
  }, []);

  return (
    <SignalRContext.Provider value={{ connection, connectionId }}>
      {children}
    </SignalRContext.Provider>
  );
};

SignalRProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
