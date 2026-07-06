import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useSignalR } from '../../../contexts/SignalRContext';
import { Avatar, Badge, Empty, Spin, notification } from 'antd';
import Cookies from "js-cookie";
import jwt_decode from "jwt-decode";
import { useAuth } from '../../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClose, faPaperclip, faMagnifyingGlass, faArrowLeft, faExpand, faCompress } from '@fortawesome/free-solid-svg-icons';
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";

import axiosInstance from "../../../axiosConfig";
import { uploadFilesToCloudinary } from "../../../services/fileService";
import MessageContent from "./MessageContent";
import "./UserChatBoxPrivate.scss";

// "Hoạt động X trước" — how long ago an offline user was last seen.
const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return "Ngoại tuyến";
    const mins = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000);
    if (mins < 1) return "Vừa truy cập";
    if (mins < 60) return `Hoạt động ${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hoạt động ${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hoạt động ${days} ngày trước`;
    return `Hoạt động ${Math.floor(days / 7)} tuần trước`;
};
const UserChatBoxPrivate = forwardRef((props, ref) => {

    const { connection, onlineUsers, lastSeenMap } = useSignalR();
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
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [highlightTerm, setHighlightTerm] = useState('');
    const [expanded, setExpanded] = useState(false);
    const [, setTick] = useState(0);
    const messageEndRef = useRef(null);
    const firstMatchRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const searchTimer = useRef(null);

    // Re-render once a minute so the "Hoạt động X phút" labels stay fresh.
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 60000);
        return () => clearInterval(id);
    }, []);

    // Debounced global search across every conversation (backend decrypts & matches).
    useEffect(() => {
        const q = search.trim();
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!q || !currentUserId) {
            setSearchResults([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        searchTimer.current = setTimeout(async () => {
            try {
                const res = await axiosInstance.get(
                    `/api/ChatPrivate/search/${currentUserId}`,
                    { params: { keyword: q } }
                );
                setSearchResults(Array.isArray(res.data) ? res.data : []);
            } catch (error) {
                console.error('Error searching chats', error);
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 350);
        return () => searchTimer.current && clearTimeout(searchTimer.current);
    }, [search, currentUserId]);

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
            setHighlightTerm('');
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

    // Open a conversation directly (no toggle) — used by search results.
    // Carries the search keyword over so matches are highlighted + scrolled to.
    const openConversation = async (friendId, friendUserName) => {
        const term = search.trim();
        setSearch('');
        setSearchResults([]);
        setHighlightTerm(term);
        setChatUser(friendUserName);
        setChatUserId(friendId);
        setReceiverChatBoxId(friendId);
        await fetchMessages(friendId);
        // Jump to the first highlighted message instead of the bottom.
        requestAnimationFrame(() => {
            if (firstMatchRef.current) firstMatchRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            else scrollToBottom();
        });
        try {
            await axiosInstance.post(`/api/ChatPrivate/reset-new-messages/${friendId}/${currentUserId}`);
            setFriends(prev => prev.map(f =>
                (f.senderId === friendId || f.receiverId === friendId)
                    ? { ...f, newMessageCount: 0 } : f));
        } catch { /* no new messages to reset is fine */ }
    };

    // Collapse search hits into one row per friend (most-recent hit on top),
    // Messenger-search style.
    const groupedSearch = useMemo(() => {
        const byFriend = new Map();
        for (const r of searchResults) {
            if (!byFriend.has(r.friendId)) byFriend.set(r.friendId, { ...r, count: 1 });
            else byFriend.get(r.friendId).count += 1;
        }
        return Array.from(byFriend.values());
    }, [searchResults]);

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
    // Avatar of the friend whose conversation is open (for received bubbles).
    const chatAvatar = useMemo(() => {
        const f = friends.find(fr => fr.senderId === chatUserId || fr.receiverId === chatUserId);
        if (!f) return null;
        return f.senderId === currentUserId ? f.receiverAvatar : f.senderAvatar;
    }, [friends, chatUserId, currentUserId]);

    // friendUserId -> LastSeen (from the friends list / get-friends payload).
    const friendLastSeen = useMemo(() => {
        const map = {};
        for (const f of friends) {
            if (f.senderId) map[f.senderId] = f.senderLastSeen;
            if (f.receiverId) map[f.receiverId] = f.receiverLastSeen;
        }
        return map;
    }, [friends]);

    // Status line for a friend. Online → "Đang hoạt động"; otherwise the most
    // recent last-seen we know of (live disconnect event wins over the list).
    const statusText = (userId) => {
        if (isUserOnline(userId)) return "Đang hoạt động";
        const lastSeen = lastSeenMap?.[userId] || friendLastSeen[userId];
        return formatLastSeen(lastSeen);
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
                    className={`chat-box !bottom-[-10px] ${expanded ? "expanded" : ""} ${dragOver ? "drag-over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                    onDrop={handleDrop}
                >
                    <div className='chat-header'>
                        <FontAwesomeIcon icon={faArrowLeft} onClick={() => setChatUser(null)} className="chat-header-back cursor-pointer" />
                        <div className="chat-header-info">
                            <span className="chat-header-name">{chatUser}</span>
                            <span className={`chat-header-status ${isUserOnline(chatUserId) ? 'is-online' : ''}`}>
                                {isUserOnline(chatUserId) && <span className="status-dot" />}
                                {statusText(chatUserId)}
                            </span>
                        </div>
                        <FontAwesomeIcon
                            icon={expanded ? faCompress : faExpand}
                            onClick={() => setExpanded((v) => !v)}
                            className="chat-header-expand cursor-pointer"
                            title={expanded ? "Thu nhỏ" : "Mở rộng"}
                        />
                        <FontAwesomeIcon icon={faClose} onClick={() => setChatUser(null)} className="btn-close cursor-pointer" />
                    </div>

                    <div className="chat-messages mb-[10px]">
                        {loadingMessages ? (
                            <div className="flex justify-center items-center h-full">
                                <span className='font-bold'>Loading messages...</span>
                            </div>
                        ) : chatMessages.length > 0 ? (
                            (() => {
                                const term = highlightTerm.toLowerCase();
                                let firstMatchFound = false;
                                // Messages closer together than this and from the same
                                // sender collapse into one visual group (Messenger-style).
                                const GROUP_WINDOW_MS = 5 * 60 * 1000;
                                const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
                                const inSameGroup = (a, b) =>
                                    a && b &&
                                    a.currentUserName === b.currentUserName &&
                                    sameDay(a.sentDate, b.sentDate) &&
                                    Math.abs(new Date(b.sentDate) - new Date(a.sentDate)) < GROUP_WINDOW_MS;

                                return chatMessages.map((msg, index) => {
                                    const isMatch = term && (msg.content || "").toLowerCase().includes(term);
                                    const setRef = isMatch && !firstMatchFound;
                                    if (setRef) firstMatchFound = true;

                                    const sent = msg.currentUserName === username;
                                    const prevMsg = index > 0 ? chatMessages[index - 1] : null;
                                    const nextMsg = index < chatMessages.length - 1 ? chatMessages[index + 1] : null;
                                    const msgDate = new Date(msg.sentDate);
                                    const showDaySeparator = !prevMsg || !sameDay(prevMsg.sentDate, msg.sentDate);
                                    const groupedWithNext = inSameGroup(msg, nextMsg);
                                    // Time + avatar only close out a group, so a run of
                                    // quick messages reads as one block.
                                    const showTime = !groupedWithNext;

                                    return (
                                        <React.Fragment key={index}>
                                            {showDaySeparator && (
                                                <div className="chat-day-separator">
                                                    <span>
                                                        {msgDate.toLocaleDateString("en-GB", {
                                                            day: "2-digit",
                                                            month: "long",
                                                            year: "numeric",
                                                        })}
                                                    </span>
                                                </div>
                                            )}
                                            <div
                                                ref={setRef ? firstMatchRef : null}
                                                className={`chat-message ${msg.status === "sending" ? "sending-message" : ""} ${sent ? "sent-message" : "received-message"} ${isMatch ? "has-match" : ""} ${groupedWithNext ? "in-group" : ""}`}
                                            >
                                                {!sent && (
                                                    <span className={`chat-avatar private-avatar ${groupedWithNext ? "ghost" : ""}`}>
                                                        {chatAvatar
                                                            ? <img src={chatAvatar} alt={chatUser} />
                                                            : (chatUser?.[0] || "?").toUpperCase()}
                                                    </span>
                                                )}
                                                <div className="chat-col">
                                                    <div className="chat-bubble">
                                                        <div className="chat-text">
                                                            <MessageContent content={msg.content} highlight={highlightTerm} />
                                                        </div>
                                                    </div>
                                                    {showTime && (
                                                        <p className="chat-date">
                                                            {msgDate.toLocaleTimeString("en-GB", {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                });
                            })()
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

            {/* Search bar — searches across every conversation */}
            <div className="chat-search">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="chat-search-icon" />
                <input
                    type="text"
                    className="chat-search-input"
                    placeholder="Tìm trong tất cả tin nhắn..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                    <FontAwesomeIcon
                        icon={faClose}
                        className="chat-search-clear cursor-pointer"
                        onClick={() => setSearch('')}
                    />
                )}
            </div>

            {search.trim() ? (
                /* === Search results === */
                <div className="chat-list">
                    {searching ? (
                        <div className="flex justify-center items-center p-4"><Spin size="small" /></div>
                    ) : groupedSearch.length > 0 ? (
                        groupedSearch.map((r) => (
                            <div
                                key={r.friendId}
                                className="chat-row cursor-pointer"
                                onClick={() => openConversation(r.friendId, r.friendUserName)}
                            >
                                <div className="chat-row-avatar">
                                    <Avatar src={r.friendAvatar} alt={r.friendUserName} className="avatarOnline" />
                                    <span className={`presence ${isUserOnline(r.friendId) ? 'online' : 'offline'}`} />
                                </div>
                                <div className="chat-row-body">
                                    <span className="chat-row-name">{r.friendUserName}</span>
                                    <span className="chat-row-sub">
                                        {r.fromMe && <span className="me-prefix">Bạn: </span>}
                                        {r.snippet}
                                    </span>
                                </div>
                                {r.count > 1 && <span className="match-count">{r.count}</span>}
                            </div>
                        ))
                    ) : (
                        <div className="flex justify-center flex-col items-center p-4">
                            <Empty description={false} />
                            <p className="font-semibold">Không tìm thấy tin nhắn</p>
                        </div>
                    )}
                </div>
            ) : (
                /* === Friend list === */
                <div className="chat-list">
                    {friends.length > 0 ? (
                        friends.map((friend) => {
                            const friendId = friend.senderId === currentUserId ? friend.receiverId : friend.senderId;
                            const friendUserName = friend.senderId === currentUserId ? friend.receiverUserName : friend.senderUserName;
                            const friendAvatar = friend.senderId === currentUserId ? friend.receiverAvatar : friend.senderAvatar;
                            const online = isUserOnline(friendId);

                            return (
                                <div
                                    key={friendId}
                                    className={`chat-row cursor-pointer ${chatUser === friendUserName ? 'active' : ''}`}
                                    onClick={() => toggleChat(friendId, friendUserName, friendId)}
                                >
                                    <div className="chat-row-avatar">
                                        <Avatar
                                            src={friendAvatar}
                                            alt={`${friendUserName}'s avatar`}
                                            className="avatarOnline"
                                        />
                                        <span className={`presence ${online ? 'online' : 'offline'}`} />
                                    </div>
                                    <div className="chat-row-body">
                                        <span className="chat-row-name">
                                            {friendUserName}
                                            {friendUserName === username && <span className="me-tag">(me)</span>}
                                        </span>
                                        <span className={`chat-row-sub ${online ? 'is-online' : ''}`}>
                                            {statusText(friendId)}
                                        </span>
                                    </div>
                                    <Badge count={friend.newMessageCount} />
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
            )}
        </div>
    );

});

export default UserChatBoxPrivate;

