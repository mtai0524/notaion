import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useSignalR } from '../../../contexts/SignalRContext';
import { Avatar, Badge, Empty, Spin, notification } from 'antd';
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import { useAuth } from '../../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClose, faPaperclip } from '@fortawesome/free-solid-svg-icons';
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";

import axiosInstance from "../../../axiosConfig";
import { uploadFilesToCloudinary } from "../../../services/fileService";
import MessageContent from "./MessageContent";
import "./UserChatBoxPrivate.scss";
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
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const messageEndRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);

    // Append an attachment/text snippet to the message draft, then resize the box.
    const appendToMessage = useCallback((snippet) => {
        setNewMessage((prev) => {
            if (!prev) return snippet;
            const sep = prev.endsWith("\n") || prev.endsWith(" ") ? "" : "\n";
            return prev + sep + snippet;
        });
        requestAnimationFrame(() => {
            const ta = inputRef.current;
            if (ta) {
                ta.focus();
                ta.style.height = "auto";
                ta.style.height = `${ta.scrollHeight}px`;
            }
        });
    }, []);

    // Upload images/files to Cloudinary, then insert them into the draft as
    // markdown — images as `![name](url)`, other files as `[📎 name](url)`. The
    // markdown lives inside the message Content, which the backend already
    // encrypts at rest, so attachment URLs are encrypted along with the text.
    const handleUploadFiles = useCallback(async (filesArray) => {
        const files = Array.from(filesArray || []).filter((f) => f && f.size > 0);
        if (files.length === 0) return;

        setUploading(true);
        setUploadProgress(0);
        try {
            const uploaded = await uploadFilesToCloudinary(files, (pct) => setUploadProgress(pct));
            if (!Array.isArray(uploaded) || uploaded.length === 0) {
                throw new Error("Upload trả về rỗng");
            }
            const snippets = uploaded.map((meta) => {
                const url = meta.cloudUrl;
                const name = meta.originalName || "attachment";
                if (!url) return "";
                const isImage = (meta.contentType || "").startsWith("image/");
                return isImage ? `![${name}](${url})` : `[📎 ${name}](${url})`;
            }).filter(Boolean).join("\n");

            if (snippets) appendToMessage(snippets);
            notification.success({ message: `Đã tải lên ${uploaded.length} file`, duration: 1.5 });
        } catch (err) {
            console.error("Upload failed", err);
            notification.error({
                message: "Upload thất bại",
                description: err?.response?.data?.title || err?.message || "Không xác định",
                duration: 3,
            });
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    }, [appendToMessage]);

    const handlePaste = useCallback((e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const files = [];
        for (const item of items) {
            if (item.kind === "file") {
                const f = item.getAsFile();
                if (f) files.push(f);
            }
        }
        if (files.length > 0) {
            e.preventDefault();
            handleUploadFiles(files);
        }
    }, [handleUploadFiles]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) handleUploadFiles(files);
    }, [handleUploadFiles]);
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
        openChatWithUser: async (senderId) => {
            if (!senderId) return;
            let list = friends;
            if (!list || list.length === 0) {
                try {
                    const response = await axiosInstance.get(`/api/FriendShip/get-friends/${currentUserId}`);
                    list = response.data;
                    setFriends(list);
                } catch (err) {
                    console.error('Failed to load friends for openChat:', err);
                    return;
                }
            }
            const friend = list.find(
                (f) => f.senderId === senderId || f.receiverId === senderId
            );
            if (!friend) return;
            const friendId = friend.senderId === currentUserId ? friend.receiverId : friend.senderId;
            const friendUserName = friend.senderId === currentUserId ? friend.receiverUserName : friend.senderUserName;
            toggleChat(friend.id, friendUserName, friendId);
        },
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
        if (!connection) return;
        const handler = (senderId, receiverId, message, currentUsername, friendUsername) => {
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
        };
        connection.on('ReceiveMessagePrivate', handler);
        return () => {
            connection.off('ReceiveMessagePrivate', handler);
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
                <div
                    className={`chat-box !bottom-[-10px] ${dragOver ? "drag-over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                    onDrop={handleDrop}
                >
                    <div className='flex flex-row items-center justify-between p-2 border-b-[#d6d6d6] border-1'>
                        <span className="text-lg font-semibold text-center">{chatUser}</span>
                        <FontAwesomeIcon icon={faClose} onClick={() => setChatUser(null)} className="btn-close cursor-pointer mr-2 size-2" />
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
                                    <div className="chat-text">
                                        <MessageContent content={msg.content} />
                                    </div>
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

                    {uploading && (
                        <div className="upload-progress">
                            <span className="upload-label">Đang tải lên... {uploadProgress}%</span>
                            <div className="upload-bar">
                                <div className="upload-fill" style={{ width: `${uploadProgress}%` }} />
                            </div>
                        </div>
                    )}

                    <div className="chat-input-private" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                if (e.target.files?.length) handleUploadFiles(e.target.files);
                                e.target.value = '';
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            title="Đính kèm ảnh / file"
                            style={{ marginRight: '8px' }}
                        >
                            <FontAwesomeIcon icon={faPaperclip} />
                        </button>
                        <textarea
                            ref={inputRef}
                            className="textarea-private resize-none overflow-auto"
                            placeholder="Type your message..."
                            value={newMessage}
                            onChange={(e) => {
                                setNewMessage(e.target.value);
                                adjustHeight(e.target);
                            }}
                            onPaste={handlePaste}
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

