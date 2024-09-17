import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";

export const useSignalRConnection = () => {
    const [onlineUsers, setOnlineUsers] = useState([]);

    useEffect(() => {
        const signalRUrl = import.meta.env.VITE_SIGNALR_URL || "https://localhost:7059/chathub";

        const connect = new signalR.HubConnectionBuilder()
            .withUrl(signalRUrl, { withCredentials: true })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();

        connect.on("ReceiveOnlineUsers", (users) => {
            setOnlineUsers(users);
        });

        connect.on("UserRegistered", (user) => {
            setOnlineUsers((prevUsers) => [...prevUsers, user]);
        });

        connect.on("UserDisconnected", (userId) => {
            setOnlineUsers((prevUsers) => prevUsers.filter((user) => user.UserId !== userId));
        });

        connect.start().catch(err => console.error("Connection failed: ", err));

        return () => {
            connect.stop();
        };
    }, []);

    return { onlineUsers };
};
