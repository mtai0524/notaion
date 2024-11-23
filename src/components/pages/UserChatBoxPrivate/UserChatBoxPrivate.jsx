import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useSignalR } from '../../../contexts/SignalRContext';
import { Avatar, Badge, Empty, Spin } from 'antd';
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import { useAuth } from '../../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClose } from '@fortawesome/free-solid-svg-icons';
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";

import axiosInstance from "../../../axiosConfig";
const UserChatBoxPrivate = forwardRef((props, ref) => {

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
    const [newMessage, setNewMessage] = useState('');
    const [scrolling, setScrolling] = useState(false);
    const messageEndRef = useRef(null);
    const inputRef = useRef(null);
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
                    newMessageCount: newMessageCountResponse.data
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
            setChatMessages(response.data);
            console.log(response.data);

        } catch (error) {
            console.error('Error fetching messages', error);
        } finally {
            setLoadingMessages(false);
        }
    };


    useImperativeHandle(ref, () => ({
        fetchFriends,
    }));

    useEffect(() => {
        fetchFriends();
    }, []);


    useEffect(() => {
        if (currentUserId) {
            fetchFriends();
        }
    }, [currentUserId]);

    useEffect(() => {
        if (connection) {
            connection.on('ReceiveMessagePrivate', (senderId, receiverId, message, currentUsername, friendUsername) => {
                if (senderId !== currentUserId) {
                    if (receiverId === currentUserId && chatUserId === senderId) {
                        setChatMessages(prev => [
                            ...prev,
                            { senderId, receiverId, content: message, currentUserName: currentUsername, sentDate: new Date().toISOString() }
                        ]);
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
            setScrolling(true);
            scrollToBottom();
            setScrolling(false);
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
                console.error('Error resetting new messages:', error);
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
                    SentDate: new Date().toISOString(),
                    CurrentUserName: username,
                };
                await axiosInstance.post('/api/ChatPrivate/add-chat-private', messagePayload);
                setChatMessages(prev => [...prev, { content: messageContent, senderId: currentUserId, currentUserName: username, sentDate: messagePayload.SentDate }]);
            } catch (error) {
                console.error('Error sending message:', error);
            }
        }
    };

    useEffect(() => {
        const lastMessage = chatMessages[chatMessages.length - 1];
        if (lastMessage && lastMessage.senderId === currentUserId) {
            scrollToBottom();
        }
    }, [chatMessages, currentUserId]);


    const scrollToBottom = () => {
        if (messageEndRef.current) {
            messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        if (!loadingMessages && chatMessages.length > 0) {
            scrollToBottom();
        }
    }, [loadingMessages]);

    const isUserOnline = (userId) => {
        return onlineUsers.some(user => user.userId === userId);
    };
    const adjustHeight = (element) => {
        element.style.height = 'auto';
        element.style.height = `${element.scrollHeight}px`;
    };

    const handleSendMessage = () => {
        if (newMessage.trim() !== '') {
            sendMessage(newMessage);
            setNewMessage('');
            scrollToBottom();
            inputRef.current.style.height = 'auto';
        }
    };
    return (
        <div>
            {chatUser && (
                <div className="chat-box !bottom-[-10px]">
                    <div className='flex flex-row items-center justify-between p-2 border-b-[#d6d6d6] border-1'>
                        <span className="text-lg font-semibold text-center">{chatUser}</span>
                        <FontAwesomeIcon icon={faClose} onClick={() => setChatUser(null)} className="btn-close mr-2 size-2" />
                    </div>

                    <div className="chat-messages mb-[10px]">
                        {loadingMessages ? (
                            <div className="flex justify-center items-center h-full">
                                <span className='font-bold'>Loading messages...</span>
                            </div>
                        ) : chatMessages.length > 0 ? (
                            chatMessages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={`chat-message ${msg.status === "sending" ? "sending-message" : ""} ${msg.currentUserName === username ? "sent-message " : "received-message"}`}
                                >
                                    <strong className="chat-user">
                                        {msg.currentUserName}
                                    </strong>
                                    <p className="chat-text">{msg.content}</p>
                                    <p className="chat-date">
                                        {new Date(msg.sentDate).toLocaleString("en-GB", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            day: "2-digit",
                                            month: "long",
                                            year: "numeric",
                                        }).replace(",", ", ")}
                                    </p>
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

                    <div className="chat-input-private" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <textarea
                            ref={inputRef}
                            className="textarea-private resize-none overflow-auto"
                            placeholder="Type your message..."
                            value={newMessage}
                            onChange={(e) => {
                                setNewMessage(e.target.value);
                                adjustHeight(e.target);
                            }}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    if (!e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }
                            }}
                            rows={1}
                            style={{ maxHeight: '200px', overflow: 'hidden', flex: 1, marginRight: '10px' }}
                        />
                        <button onClick={handleSendMessage}>
                            <FontAwesomeIcon icon={faPaperPlane} />
                        </button>
                    </div>

                </div>
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
                                className={`relative flex flex-row items-center cursor-pointer border-b-[1px] ${chatUser === friendUserName ? 'bg-gray-100 rounded-md' : ''}`}
                                onClick={() => toggleChat(friendId, friendUserName, friendId)}
                            >
                                <div className="cursor-pointer flex flex-row p-2 ">
                                    <Avatar
                                        src={friendAvatar}
                                        alt={`${friendUserName}'s avatar`}
                                        className="avatarOnline"
                                        style={{ width: '50px', height: '50px', borderRadius: '50%' }}
                                    />
                                    <div className={`absolute w-[10px] h-[10px] ${isUserOnline(friendId) ? 'bg-[#28df28]' : 'bg-[#ff0000]'} top-[50px] left-[43px] rounded-full border-[2px] border-white`} />
                                    <span className="flex justify-center items-center font-semibold ml-2">
                                        {friendUserName}
                                        {friendUserName === username && <span className="text-xs font-semibold ml-1">(me)</span>}
                                        <Badge className='absolute top-1 right-1' count={friend.newMessageCount} />
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

});

export default UserChatBoxPrivate;

