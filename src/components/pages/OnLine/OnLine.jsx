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
                <span>profile</span>
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
                                            style={{ width: '40px', height: '40px', borderRadius: '50%', outline: '1px solid gray' }}
                                        />
                                        <div className="absolute w-[10px] h-[10px] bg-[#28df28] bottom-[0px] right-[1px] rounded-full border-[2px] border-white" />
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
