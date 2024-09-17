import React from 'react';
import { useSignalR } from '../../../contexts/SignalRContext';

const OnlineUsers = () => {
    const { onlineUsers } = useSignalR();

    return (
        <div>
            <h2>Online Users</h2>
            <ul>
                {onlineUsers.length > 0 ? (
                    onlineUsers.map((user) => (
                        <li key={user.userId}>
                            {user.userName} (ID: {user.userId})
                        </li>
                    ))
                ) : (
                    <p>No users online</p>
                )}
            </ul>
        </div>
    );
};

export default OnlineUsers;
