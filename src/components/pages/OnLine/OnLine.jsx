import React, { useState, useEffect } from 'react';
import { useSignalR } from '../../../contexts/SignalRContext';
import { Dropdown, Empty, Menu, Modal } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { MoreOutlined } from '@ant-design/icons';
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import { useAuth } from '../../../contexts/AuthContext';

const OnlineUsers = () => {
    const { onlineUsers } = useSignalR();
    const navigate = useNavigate();
    const { token, setToken } = useAuth();
    const [username, setUsername] = useState('');
    const location = useLocation();
    const [modalChatbox, setModalChatbox] = useState(false);

    const showModalChatbox = () => {
        setModalChatbox(true);
    };

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

    const renderMenu = (userName, userId) => (
        <Menu>
            <Menu.Item key="profile" onClick={() => switchPageProfile(userName)} style={{ backgroundColor: location.pathname.startsWith("/profile") ? "#f0f0f0" : "transparent" }} >
                <span className='font-semibold'>Profile</span>
            </Menu.Item>

            {userName === username && (
                <Menu.Item key="page" onClick={() => switchPagePage()} style={{ backgroundColor: location.pathname.startsWith("/page") ? "#f0f0f0" : "transparent" }}>
                    <span className='font-semibold'>Page</span>
                </Menu.Item>
            )}
        </Menu>
    );

    const switchPagePage = () => {
        navigate(`/page/`);
    };

    const switchPageProfile = (userName) => {
        navigate(`/profile/${userName}`);
    };

    return (
        <div>
            <Modal
                title="Choose an Avatar"
                visible={modalChatbox}
                onCancel={() => setModalChatbox(false)}
            ></Modal>
            <div className="flex flex-col gap-2">
                {onlineUsers.length > 0 ? (
                    onlineUsers.map((user) => (
                        <div key={user.userId}>
                            <div className="flex flex-row mb-2 items-center">
                                <div
                                    className="relative cursor-pointer flex flex-row"
                                    onClick={() => switchPageProfile(user.userName)}
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
                                <Dropdown overlay={renderMenu(user.userName, user.userId)} trigger={['click']}>
                                    <MoreOutlined
                                        style={{ fontSize: '20px', marginLeft: 'auto', cursor: 'pointer', opacity: '0.4' }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </Dropdown>
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

export default OnlineUsers;
