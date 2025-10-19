import { useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import Loading from "../../components/Loading"; // Assuming this component exists
import { io, Socket } from "socket.io-client";
import { format } from "date-fns"; // Recommended for professional date formatting

// --- INTERFACE DEFINITIONS (Kept as is) ---
interface Message {
  id: string | null;
  senderId: string;
  receiverId: string;
  roomId: string | null;
  message: string;
  createdAt: string;
  updatedAt: string | null;
}

interface Friend {
  id: string;
  name: string;
  email: string;
  lastActive: string;
  chats: Message[];
}

interface User {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  lastActive: string;
  registrationDate: string;
  profileUrl: string;
  clerkId: string;
  Bio: string;
}
// ------------------------------------------

// Utility to get initials for the avatar
const getInitials = (name: string): string => {
  if (!name) return "?";
  const parts = name.split(" ");
  return parts
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase()
    .substring(0, 2);
};

// Utility to format time for messages
const formatMessageTime = (isoString: string): string => {
  return format(new Date(isoString), "h:mm a");
};

const ChatTab = () => {
  const [user, setUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const selectedFriendRef = useRef<Friend | null>(selectedFriend);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { getToken, isLoaded } = useAuth();

  // Keep selectedFriend ref updated
  useEffect(() => {
    selectedFriendRef.current = selectedFriend;
  }, [selectedFriend]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch user, friends, and setup socket (Logic kept as is)
  useEffect(() => {
    if (!isLoaded) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("No token, please login again");

        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/user/account`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const backendUser: User = {
          ...res.data.user,
          lastActive: new Date(res.data.user.lastActive).toISOString(),
          registrationDate: new Date(
            res.data.user.registrationDate
          ).toISOString(),
        };
        setUser(backendUser);

        const backendFriends: Friend[] = res.data.friends.map((f: any) => ({
          ...f,
          lastActive: new Date(f.lastActive).toISOString(),
          chats: f.chats.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt).toISOString(),
            updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
          })),
        }));
        setFriends(backendFriends);

        if (backendFriends.length > 0) {
          const latestFriend = backendFriends
            .map((f) => {
              const lastMsgTime = f.chats.length
                ? new Date(f.chats[f.chats.length - 1].createdAt).getTime()
                : 0;
              return { friend: f, lastMsgTime };
            })
            .sort((a, b) => b.lastMsgTime - a.lastMsgTime)[0]?.friend;
          setSelectedFriend(latestFriend || backendFriends[0]);
        }

        // Setup socket
        if (!socket) {
          const newSocket = io(
            import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"
          );
          setSocket(newSocket);

          newSocket.on("connect", () => {
            console.log("socket connected:", newSocket.id);
            if (backendUser.id) newSocket.emit("register", backendUser.id);
          });

          // Handle incoming messages
          newSocket.on("receive-private-message", (msg: Message) => {
            // Update friend chats
            setFriends((prevFriends) =>
              prevFriends.map((f) => {
                if (f.id === msg.senderId || f.id === msg.receiverId) {
                  return { ...f, chats: [...f.chats, msg] };
                }
                return f;
              })
            );

            // If the message is for the currently selected friend, append to messages
            const currentFriend = selectedFriendRef.current;
            if (
              currentFriend &&
              (msg.senderId === currentFriend.id ||
                msg.receiverId === currentFriend.id)
            ) {
              setMessages((prev) => [...prev, msg]);
            }
          });
        }

        setError(null);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [getToken, isLoaded]);

  // Update messages when selected friend changes
  useEffect(() => {
    if (!selectedFriend) return;
    setMessages(selectedFriend.chats || []);
  }, [selectedFriend]);

  // Send message (Logic kept as is)
  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedFriend || !user) return;

    const newMessage: Message = {
      id: Math.random().toString(),
      senderId: user.id,
      receiverId: selectedFriend.id,
      roomId: null,
      message: messageInput,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setFriends((prev) =>
      prev.map((f) => {
        if (f.id === selectedFriend.id) {
          return { ...f, chats: [...f.chats, newMessage] };
        }
        return f;
      })
    );

    setMessageInput("");

    if (socket) {
      socket.emit("private-message", {
        senderId: newMessage.senderId,
        receiverId: selectedFriend.id,
        message: newMessage.message,
      });
    }
  };

  if (isLoading) return <Loading />;

  if (error)
    return (
      <div className="text-red-300 p-4 rounded-xl bg-red-900/40 backdrop-blur-md border border-red-700/50">
        {error}
      </div>
    );

  return (
    <div className="flex flex-col md:flex-row w-full h-[65vh] min-h-[550px] bg-white shadow-2xl rounded-xl overflow-hidden border border-gray-200">
      {/* 1. Friends List / Sidebar */}
      <div className="w-full md:w-1/3 min-w-[280px] bg-gray-50 border-r border-gray-200 overflow-y-auto flex flex-col p-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Chats</h2>
        <div className="space-y-2">
          {friends.map((friend) => {
            const lastMsg = friend.chats.length
              ? friend.chats[friend.chats.length - 1]
              : null;
            const isSelected = selectedFriend?.id === friend.id;

            return (
              <div
                key={friend.id}
                onClick={() => setSelectedFriend(friend)}
                className={`cursor-pointer flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                  isSelected
                    ? "bg-indigo-100/70 border border-indigo-300 shadow-sm"
                    : "hover:bg-gray-100"
                }`}
              >
                {/* Avatar */}
                <div className="relative w-10 h-10 flex items-center justify-center rounded-full bg-indigo-500 text-white font-semibold text-sm flex-shrink-0">
                  {getInitials(friend.name)}
                </div>

                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div className="font-semibold text-gray-800 truncate">
                      {friend.name}
                    </div>
                    {lastMsg && (
                      <div className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {formatMessageTime(lastMsg.createdAt)}
                      </div>
                    )}
                  </div>
                  <div
                    className={`text-sm truncate ${
                      isSelected
                        ? "text-indigo-600 font-medium"
                        : "text-gray-500"
                    }`}
                  >
                    {lastMsg ? lastMsg.message : "No recent messages"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Chat Box */}
      <div className="flex-1 relative flex flex-col bg-white">
        {/* Chat Header */}
        {selectedFriend ? (
          <div className="p-4 border-b border-gray-200 bg-white shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-500 text-white font-semibold text-sm">
              {getInitials(selectedFriend.name)}
            </div>
            <h3 className="text-xl font-semibold text-gray-800">
              {selectedFriend.name}
            </h3>
          </div>
        ) : (
          <div className="p-4 border-b border-gray-200 bg-white shadow-sm">
            <h3 className="text-xl font-semibold text-gray-400">
              Select a Chat
            </h3>
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 bg-gray-50/50 custom-scrollbar">
          {!selectedFriend && (
            <div className="text-gray-400 text-center my-auto text-xl italic">
              👈 Select a contact to begin chatting
            </div>
          )}
          {selectedFriend &&
            messages.map((msg) => {
              const isSender = msg.senderId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${
                    isSender ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className="max-w-xs md:max-w-md">
                    <div
                      className={`p-3 rounded-2xl shadow-md text-base break-words ${
                        isSender
                          ? "bg-indigo-600 text-white rounded-br-sm"
                          : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm"
                      }`}
                    >
                      {msg.message}
                    </div>
                    <div
                      className={`text-xs mt-1 ${
                        isSender
                          ? "text-gray-500 text-right"
                          : "text-gray-500 text-left"
                      }`}
                    >
                      {formatMessageTime(msg.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {selectedFriend && (
          <div className="p-4 border-t border-gray-200 bg-white flex gap-3 shadow-top">
            <input
              type="text"
              className="flex-1 p-3 rounded-full bg-gray-100 border border-gray-300 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={!socket} // Disable input if socket isn't ready
            />
            <button
              onClick={sendMessage}
              disabled={!messageInput.trim() || !socket}
              className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition duration-200 flex items-center justify-center shadow-lg disabled:bg-indigo-400 disabled:cursor-not-allowed"
              title="Send"
            >
              {/* Send Icon SVG - A cleaner, solid icon is often preferred */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="feather feather-send"
              >
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatTab;
