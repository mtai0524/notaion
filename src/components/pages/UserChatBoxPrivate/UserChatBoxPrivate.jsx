import React, { useState, useEffect, useRef } from 'react';
import { useSignalR } from '../../../contexts/SignalRContext';
import { Avatar, Badge, Empty } from 'antd';
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import { useAuth } from '../../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClose } from '@fortawesome/free-solid-svg-icons';
import axiosInstance from "../../../axiosConfig";
const ChatBox = ({ loadingMessages, chatUser, currentUserId, chatMessages, onSendMessage, onClose }) => {
    const [newMessage, setNewMessage] = useState('');
    const messageEndRef = useRef(null);
    const isInitialRender = useRef(true);
    const inputRef = useRef(null);
    const handleSendMessage = () => {
        if (newMessage.trim() !== '') {
            onSendMessage(newMessage);
            setNewMessage('');
            scrollToBottom();
        }
    };

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);
    const scrollToBottom = () => {
        if (messageEndRef.current) {
            messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };
    useEffect(() => {
        if (!loadingMessages && isInitialRender.current) {
            isInitialRender.current = false;
            scrollToBottom();
        }
    }, [loadingMessages]);
    useEffect(() => {
        const lastMessage = chatMessages[chatMessages.length - 1];
        if (lastMessage && lastMessage.senderId === currentUserId) {
            scrollToBottom();
        }
    }, [chatMessages, currentUserId]);
    return (
        <div className="chat-box !bottom-[-10px]">
            <div className='flex flex-row items-center justify-between p-2 border-b-[#d6d6d6] border-1'>
                <span className="text-lg font-semibold text-center">Chatting with {chatUser}</span>
                <FontAwesomeIcon icon={faClose} onClick={onClose} className="btn-close mr-2 size-2" />
            </div>
            <div className="message mb-[40px]">
                {loadingMessages ? (
                    <div className="flex justify-center items-center h-full">
                        <span>Loading messages...</span>
                    </div>
                ) : chatMessages.length > 0 ? (
                    chatMessages.map((msg, index) => (
                        <div key={index} className={`message-item ${msg.senderId === currentUserId ? 'sent' : 'received'}`}>
                            {msg.content}
                        </div>
                    ))
                ) : (
                    <div className="h-full flex justify-center flex-col items-center">
                        <Empty description={false}></Empty>
                        <p className="font-semibold">No messages</p>
                    </div>
                )}
                <div ref={messageEndRef} />
            </div>
            <input
                ref={inputRef}
                type="text"
                className="chat-input-private border-t-[#d6d6d6] border-1"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
        </div>
    );
};
const UserChatBoxPrivate = () => {
    const { connection, onlineUsers } = useSignalR();
    const { token, setToken } = useAuth();
    const [username, setUsername] = useState('');
    const [currentUserId, setUserId] = useState('');
    const [chatUser, setChatUser] = useState(null);
    const [chatUserId, setChatUserId] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [friends, setFriends] = useState([]);
    const [receiverChatBoxId, setReceiverChatBoxId] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(false);
    useEffect(() => {
        const fetchUser = async () => {
            const tokenFromCookie = Cookies.get('token');
            if (tokenFromCookie) {
                try {
                    setToken(tokenFromCookie);
                    const decodedToken = jwt_decode(tokenFromCookie);
                    const userIdToken = decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
                    const userNameToken = decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
                    setUserId(userIdToken);
                    setUsername(userNameToken);
                } catch {
                    console.log('Not found or invalid token');
                }
            }
        };
        fetchUser();
    }, [setToken]);
    const fetchFriends = async () => {
        try {
            const response = await axiosInstance.get(`/api/FriendShip/get-friends/${currentUserId}`);
            const friendsWithNewMessageCounts = await Promise.all(response.data.map(async (friend) => {
                const friendId = friend.senderId === currentUserId ? friend.receiverId : friend.senderId;
                const newMessageCountResponse = await axiosInstance.get(`/api/ChatPrivate/new-messages/${friendId}/${currentUserId}`);
                return {
                    ...friend,
                    newMessageCount: newMessageCountResponse.data,
                };
            }));
            setFriends(friendsWithNewMessageCounts);
        } catch (error) {
            console.error('Error fetching friends', error);
        }
    };
    const fetchMessages = async (recvId) => {
        setLoadingMessages(true);
        try {
            const response = await axiosInstance.get(`/api/ChatPrivate/get-chats-private/${currentUserId}/${recvId}`);
            const sortedMessages = response.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setChatMessages(sortedMessages);
        } catch (error) {
            console.error('Error fetching messages', error);
        } finally {
            setLoadingMessages(false);
        }
    };
    useEffect(() => {
        if (currentUserId) {
            fetchFriends();
        }
    }, [currentUserId]);
    useEffect(() => {
        if (connection) {
            connection.on('ReceiveMessagePrivate', (senderId, receiverId, message) => {
                if (senderId !== currentUserId) {
                    if (receiverId === currentUserId && chatUserId === senderId) {
                        setChatMessages(prev => [...prev, { senderId, receiverId, content: message }]);
                    }
                    if (receiverId === currentUserId) {
                        const updatedFriends = friends.map(f => {
                            if (f.senderId === senderId || f.receiverId === senderId) {
                                return { ...f, newMessageCount: f.newMessageCount + 1 };
                            }
                            return f;
                        });
                        setFriends(updatedFriends);
                    }
                }
            });
        }
        return () => {
            if (connection) {
                connection.off('ReceiveMessagePrivate');
            }
        };
    }, [connection, currentUserId, friends, chatUserId]);
    const toggleChat = async (recvId, friendUserName, friendId) => {
        if (chatUser === friendUserName) {
            setChatUser(null);
        } else {
            setChatUser(friendUserName);
            setChatUserId(friendId);
            setReceiverChatBoxId(recvId);
            await fetchMessages(recvId);
            try {
                await axiosInstance.post(`/api/ChatPrivate/reset-new-messages/${friendId}/${currentUserId}`);
                setFriends(prevFriends =>
                    prevFriends.map(friend =>
                        (friend.senderId === friendId || friend.receiverId === friendId)
                            ? { ...friend, newMessageCount: 0 }
                            : friend
                    )
                );
            } catch (error) {
                console.error('Error resetting new message count:', error);
            }
        }
    };
    const sendMessage = async (messageContent) => {
        if (connection) {
            try {
                const friend = friends.find(f => f.senderUserName === chatUser || f.receiverUserName === chatUser);
                const receiverId = friend.senderId === currentUserId ? friend.receiverId : friend.senderId;
                const messagePayload = {
                    Content: messageContent,
                    SenderId: currentUserId,
                    ReceiverId: receiverId,
                };
                await axiosInstance.post('/api/ChatPrivate/add-chat-private', messagePayload);
                setChatMessages(prev => [...prev, { content: messageContent, senderId: currentUserId }]);
            } catch (error) {
                console.error('Error sending message:', error);
            }
        }
    };
    const isUserOnline = (userId) => {
        return onlineUsers.some(user => user.userId === userId);
    };
    return (
        <div>
            {chatUser && (
                <ChatBox
                    chatUser={chatUser}
                    currentUserId={currentUserId}
                    loadingMessages={loadingMessages}
                    chatMessages={chatMessages}
                    onSendMessage={sendMessage}
                    onClose={() => setChatUser(null)}
                />
            )}
            <div className="flex flex-col">
                {friends.length > 0 ? (
                    friends.map((friend) => {
                        const friendId = friend.senderId === currentUserId ? friend.receiverId : friend.senderId;
                        const friendUserName = friend.senderId === currentUserId ? friend.receiverUserName : friend.senderUserName;
                        const friendAvatar = friend.senderId === currentUserId ? friend.receiverAvatar : friend.senderAvatar;
                        return (
                            <div
                                key={friendId}
                                className={`relative flex flex-row  items-center cursor-pointer border-b-[1px] ${chatUser === friendUserName ? 'bg-gray-100 rounded-md' : ''}`}
                                onClick={() => toggleChat(friendId, friendUserName, friendId)}
                            >
                                <div className="cursor-pointer flex flex-row p-2 ">
                                    <img
                                        src={friendAvatar}
                                        alt={`${friendUserName}'s avatar`}
                                        className="avatarOnline"
                                        style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                                    />
                                    <div className={`absolute w-[10px] h-[10px] ${isUserOnline(friendId) ? 'bg-[#28df28]' : 'bg-[#ff0000]'} top-[40px] left-[37px] rounded-full border-[2px] border-white`} />
                                    <span className="flex justify-center items-center font-semibold ml-2">
                                        {friendUserName}
                                        {friendUserName === username && <span className="text-xs font-semibold ml-1">(me)</span>}
                                        <Badge className='absolute top-1 right-1' count={friend.newMessageCount} style={{ backgroundColor: '#52c41a' }} />
                                    </span>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex justify-center flex-col items-center">
                        <Empty description={false}></Empty>
                        <p className="font-semibold">No friends found</p>
                    </div>
                )}
            </div>
        </div>
    );
};
export default UserChatBoxPrivate;
