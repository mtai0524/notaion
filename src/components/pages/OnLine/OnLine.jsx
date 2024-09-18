import React from 'react';
import { useSignalR } from '../../../contexts/SignalRContext';
import { Dropdown, Menu, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';

const OnlineUsers = () => {
    const { onlineUsers } = useSignalR();
    const navigate = useNavigate();

    const renderMenu = (userName, userId) => (
        <Menu>
            <Menu.Item key="username" onClick={() => switchPageProfile(userName)}>
                <span>{userName}</span>
            </Menu.Item>
        </Menu>
    );

    const switchPageProfile = (userName) => {
        navigate(`/profile/${userName}`);
    }

    return (
        <div>
            <div className="flex flex-row gap-2 justify-center items-center">
                {onlineUsers.length > 0 ? (
                    onlineUsers.map((user) => (
                        <div key={user.userId} className="online-user">
                            <Dropdown overlay={renderMenu(user.userName, user.userId)} trigger={['click']} arrow>
                                <Tooltip title={user.userName} placement='top'>
                                    <div className="text-center relative cursor-pointer" onClick={(e) => e.preventDefault()}>
                                        <img
                                            src={user.avatar}
                                            alt={`${user.userName}'s avatar`}
                                            className="avatarOnline"
                                            style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid gray' }}
                                        />
                                        <div className="absolute w-2 h-2 bg-green-400 bottom-[1px] right-[3px] rounded" />
                                    </div>
                                </Tooltip>
                            </Dropdown>
                        </div>
                    ))
                ) : (
                    <p></p>
                    // <p>No users online</p>
                )}
            </div>
        </div>
    );
};

export default OnlineUsers;
