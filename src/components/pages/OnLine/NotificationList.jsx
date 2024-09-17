import { useSignalR } from "../../../contexts/SignalRContext";
import './NotificationList.scss'
const NotificationList = () => {
    const { notifications } = useSignalR();

    return (
        <div className="notification-list">
            {notifications.map((notification, index) => (
                <div key={index} className="notification-item">
                    {notification}
                </div>
            ))}
        </div>
    );
};

export default NotificationList;
