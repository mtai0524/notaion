import * as signalR from "@microsoft/signalr";
import config from "../config";

let connection = null;

export const getSignalRConnection = () => {
    if (!connection) {
        const signalRUrl = config.SIGNALR_URL;
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
