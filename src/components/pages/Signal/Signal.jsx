import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import "./Signal.scss";
import { notification } from "antd";

const App = () => {
  const [connection, setConnection] = useState(null);
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const connect = new signalR.HubConnectionBuilder()
      .withUrl("https://localhost:7059/chathub", {
        withCredentials: true,
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    setConnection(connect);

    connect
      .start()
      .then(() => {
        console.log("Connected!");
        notification.success({
          message: "SignalR Connected",
          description: "Successfully connected to SignalR Hub.",
          showProgress: true,
        });
        connect.on("ReceiveMessage", (user, message) => {
          setMessages((prevMessages) => [...prevMessages, { user, message }]);
        });
      })
      .catch((err) => {
        console.error("Connection failed: ", err);
        notification.error({
          message: "Connection Error",
          description: "Failed to connect to SignalR Hub.",
          showProgress: true,
          duration: 2,
        });
      });
  }, []);

  const sendMessage = async () => {
    if (connection) {
      try {
        await connection.invoke("SendMessage", user, message);
        setMessage(""); // Clear message input after sending
      } catch (err) {
        console.error("Send message failed: ", err);
      }
    }
  };

  return (
    <div className="App">
      <h1>SignalR Chat</h1>
      <div>
        <input
          type="text"
          placeholder="User"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
        <input
          type="text"
          placeholder="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
      <div>
        {messages.map((msg, index) => (
          <div key={index}>
            <strong>{msg.user}:</strong> {msg.message}{" "}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
