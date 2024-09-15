import * as signalR from "@microsoft/signalr";

let connection = null;

export const getSignalRConnection = () => {
    if (!connection) {
        const signalRUrl =
            import.meta.env.VITE_SIGNALR_URL || "https://localhost:7059/chathub";
        connection = new signalR.HubConnectionBuilder()
            .withUrl(signalRUrl, {
                withCredentials: true,
            })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();
    }
    return connection;
};
