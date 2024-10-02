import React, { useState, useEffect } from 'react';
import { useSignalR } from '../../../contexts/SignalRContext';
import { Dropdown, Empty, Menu, Modal } from 'antd';
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import { useAuth } from '../../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClose } from '@fortawesome/free-solid-svg-icons';

const ChatBox = ({ chatUser, onClose }) => {
    return (
        <div className="chat-box !bottom-[-10px]">
            <div className='flex flex-row items-center justify-between p-2'>
                <span className="text-lg font-semibold">Chatting with {chatUser}</span>
                <FontAwesomeIcon icon={faClose} onClick={onClose} className="btn-close mr-2 size-2" />
            </div>

            <div className="message">
            </div>
            <input
                type="text"
                className="chat-input"
                placeholder="Type your message..."
            />
        </div>
    );
};

const UserChatBoxPrivate = () => {
    const { onlineUsers } = useSignalR();
    const { token, setToken } = useAuth();
    const [username, setUsername] = useState('');
    const [chatUser, setChatUser] = useState(null);

    useEffect(() => {
        const fetchUser = async () => {
            const tokenFromCookie = Cookies.get('token');
            if (tokenFromCookie) {
                try {
                    setToken(tokenFromCookie);
                    const decodedToken = jwt_decode(tokenFromCookie);
                    const userNameToken = decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
                    setUsername(userNameToken);
                } catch {
                    console.log('Not found or invalid token');
                }
            }
        };

        fetchUser();
    }, [setToken]);

    const openChat = (userName) => {
        setChatUser(userName);
    };

    const closeChat = () => {
        setChatUser(null);
    };

    return (
        <div>
            {chatUser && <ChatBox chatUser={chatUser} onClose={closeChat} />}
            <div className="flex flex-col gap-2">
                {onlineUsers.length > 0 ? (
                    onlineUsers.map((user) => (
                        <div key={user.userId}>
                            <div className="flex flex-row mb-2 items-center">
                                <div
                                    className="relative cursor-pointer flex flex-row"
                                    onClick={() => openChat(user.userName)}
                                >
                                    <img
                                        src={user.avatar}
                                        alt={`${user.userName}'s avatar`}
                                        className="avatarOnline"
                                        style={{ width: '40px', height: '40px', borderRadius: '50%', outline: '1px solid #111827' }}
                                    />
                                    <div className="absolute w-[10px] h-[10px] bg-[#28df28] top-[31px] left-[28px] rounded-full border-[2px] border-white" />
                                    <span className="flex justify-center items-center font-semibold ml-2">
                                        {user.userName}
                                        {user.userName === username && <span className="text-xs font-semibold ml-1">(me)</span>}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex justify-center flex-col items-center">
                        <Empty description={false}></Empty>
                        <p className="font-semibold">No users online</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserChatBoxPrivate;
