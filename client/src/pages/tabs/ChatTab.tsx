import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import Loading from "../../components/Loading";

interface Friend {
  id: string;
  username?: string;
  name?: string;
  email?: string;
  profileUrl?: string; // This is the friend's avatar URL
}

interface Message {
  id?: string;
  senderId: string; // 'me' or friend's id
  text: string;
  createdAt?: string;
}

interface PrivateChat {
  friendId: string;
  messages: Message[];
}

const CURRENT_USER_ID = "me";
const CURRENT_USER_PROFILE_URL =
  "defaultPfp.jpeg"; 

const ChatTab = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [privateChats, setPrivateChats] = useState<PrivateChat[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    const fetchUserData = async () => {
      if (!isLoaded) return;
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("No token, please login again");

        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/user/account`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const friendsData = (res.data.friends || []).filter(
          (f: any) => f && typeof f === "object"
        );
        let chatsData = res.data.privateChats || [];

        chatsData = chatsData
          .filter((c: any) => c && typeof c === "object")
          .map((c: any) => ({
            friendId: c.friendId || "",
            messages: Array.isArray(c.messages) ? c.messages : [],
          }));

        setFriends(friendsData);
        setPrivateChats(chatsData);

        // Select latest friend by last message timestamp (Your existing logic)
        if (friendsData.length > 0) {
          const latestFriendData = chatsData
            .map((c: any) => {
              const lastMsg = Array.isArray(c.messages)
                ? c.messages.slice(-1)[0]
                : null;
              return {
                friendId: c.friendId,
                lastMsgTime: lastMsg?.createdAt
                  ? new Date(lastMsg.createdAt).getTime()
                  : 0,
              };
            })
            .sort((a: any, b: any) => b.lastMsgTime - a.lastMsgTime)[0];

          const initialFriend =
            latestFriendData &&
            friendsData.find((f: any) => f.id === latestFriendData.friendId);

          setSelectedFriend(initialFriend || friendsData[0] || null);
        }

        setError(null);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [getToken, isLoaded]);

  useEffect(() => {
    if (!selectedFriend) return;
    const chat = privateChats.find((c) => c.friendId === selectedFriend.id);
    setMessages(chat?.messages || []);
  }, [selectedFriend, privateChats]);

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedFriend) return;

    try {
      const token = await getToken();
      if (!token) throw new Error("No token, please login again");

      const newMessage: Message = {
        senderId: CURRENT_USER_ID, // Use 'me' or current user ID
        text: messageInput,
        id: Math.random().toString(), // Temporary ID for UI update
        createdAt: new Date().toISOString(),
      };

      // Send message to backend (example API)
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/chat/send`,
        { receiverId: selectedFriend.id, text: messageInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update UI instantly
      setMessages((prev) => [...prev, newMessage]);
      setMessageInput("");
    } catch (err) {
      console.error(err);
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
    // Outer Container: Dark, semi-transparent base for the whole UI
    <div className="flex flex-col md:flex-row w-full h-[80vh] min-h-[500px] bg-gray-900/20 backdrop-blur-md p-4 rounded-3xl gap-4 shadow-2xl text-white">
      {/* Friends List (Sidebar) - Glass effect 1 */}
      <div className="w-full md:w-1/3 min-w-[250px] bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3 overflow-y-auto flex flex-col gap-2 shadow-inner">
        <h2 className="text-xl font-bold mb-3 px-1 text-white/90">Messages</h2>
        {friends.map((friend) => {
          const chat = privateChats.find((c) => c.friendId === friend.id);
          const lastMsg = Array.isArray(chat?.messages)
            ? chat.messages.slice(-1)[0]?.text || "No recent messages"
            : "No recent messages";
          const isSelected = selectedFriend?.id === friend.id;

          return (
            <div
              key={friend.id}
              onClick={() => setSelectedFriend(friend)}
              className={`cursor-pointer w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                isSelected
                  ? "bg-white/30 border border-white/40 shadow-lg" // Brighter selection for focus
                  : "hover:bg-white/10"
              }`}
            >
              {/* Avatar Fix: Use friend.profileUrl for the list */}
              <img
                src={
                  friend.profileUrl ||
                  "https://via.placeholder.com/40/808080/FFFFFF?text=A"
                } // Fallback image
                alt={`${friend.username || friend.name}'s avatar`}
                className="w-10 h-10 rounded-full object-cover border border-white/50"
              />
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="font-semibold text-white/95">
                  {friend.username || friend.name || "Unknown User"}
                </div>
                <div className="text-sm text-white/70 truncate">{lastMsg}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat Box (Main Area) - Glass effect 2 */}
      <div className="flex-1 relative flex flex-col bg-white/15 backdrop-blur-2xl border border-white/30 rounded-2xl shadow-xl overflow-hidden">
        {/* Chat Header */}
        {selectedFriend && (
          <div className="p-4 border-b border-white/30 bg-white/10 backdrop-blur-md flex items-center gap-3 shadow-md">
            <img
              src={
                selectedFriend.profileUrl ||
                "https://via.placeholder.com/40/808080/FFFFFF?text=A"
              }
              alt="friend's avatar"
              className="w-10 h-10 rounded-full object-cover border border-white/50"
            />
            <h3 className="text-lg font-semibold text-white/95">
              {selectedFriend.username || selectedFriend.name || "Chat"}
            </h3>
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
          {!selectedFriend && (
            <div className="text-white/50 text-center my-auto text-xl">
              Tap a contact to begin chatting
            </div>
          )}
          {selectedFriend &&
            messages.map((msg) => {
              const isSender = msg.senderId !== selectedFriend.id;

              // Avatar Fix: Determine the correct avatar URL
              const avatarUrl = isSender
                ? CURRENT_USER_PROFILE_URL // Use current user's avatar
                : selectedFriend.profileUrl; // Use friend's avatar

              return (
                <div
                  key={msg.id || Math.random()}
                  className={`flex ${
                    isSender ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className={`flex items-start gap-2 max-w-[80%]`}>
                    {/* Friend's Avatar (on the left) */}
                    {!isSender && (
                      <img
                        src={
                          avatarUrl ||
                          "https://via.placeholder.com/32/808080/FFFFFF?text=A"
                        }
                        alt="avatar"
                        className="w-8 h-8 rounded-full object-cover border border-white/50 flex-shrink-0"
                      />
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`p-3 rounded-3xl shadow-xl text-gray-900 ${
                        isSender
                          ? "bg-teal-400/80 rounded-br-md" // Sender: Teal/Vision Pro accent
                          : "bg-white/40 rounded-tl-md" // Receiver: Light glass
                      }`}
                    >
                      <span>{msg.text}</span>
                    </div>

                    {/* Sender's Avatar (on the right) */}
                    {isSender && (
                      <img
                        src={
                          avatarUrl ||
                          "/defaultPfp.jpeg"
                        }
                        alt="my avatar"
                        className="w-8 h-8 rounded-full object-cover border border-white/50 flex-shrink-0"
                      />
                    )}
                  </div>
                </div>
              );
            })}
        </div>
        {/* End of Messages Container */}

        {/* Input Area */}
        {selectedFriend && (
          // Fixed positioning to be relative to the Chat Box container
          <div className="p-3 border-t border-white/30 bg-white/10 backdrop-blur-lg flex gap-3 rounded-b-2xl shadow-inner">
            <input
              type="text"
              className="flex-1 p-3 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-teal-400/80"
              placeholder="Message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
            />
            <button
              onClick={sendMessage}
              className="w-12 h-12 rounded-full bg-teal-500 hover:bg-teal-600 text-white font-bold transition flex items-center justify-center shadow-lg"
              title="Send"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
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
