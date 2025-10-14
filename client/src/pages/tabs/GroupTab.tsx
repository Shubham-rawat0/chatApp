import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import Loading from "../../components/Loading";

interface Group {
  id: string;
  name: string;
  profileUrl?: string; // Group avatar
}

interface Message {
  id?: string;
  senderId: string; // 'me' or user id
  text: string;
  createdAt?: string;
  senderProfileUrl?: string; // sender's avatar
}

interface GroupChat {
  groupId: string;
  messages: Message[];
}

const CURRENT_USER_ID = "me";
const CURRENT_USER_PROFILE_URL = "/defaultPfp.jpeg"; // current user avatar

const GroupTab = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getToken, isLoaded } = useAuth();

  // Fetch groups & chats
  useEffect(() => {
    const fetchGroups = async () => {
      if (!isLoaded) return;
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("No token, please login again");

        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/user/getGroups`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const groupsData = (res.data.groups || []).filter(
          (g: any) => g && typeof g === "object"
        );
        let chatsData = res.data.groupChats || [];

        chatsData = chatsData
          .filter((c: any) => c && typeof c === "object")
          .map((c: any) => ({
            groupId: c.groupId,
            messages: Array.isArray(c.messages) ? c.messages : [],
          }));

        setGroups(groupsData);
        setGroupChats(chatsData);

        // Select latest group by last message timestamp
        if (groupsData.length > 0) {
          const latestGroupData = chatsData
            .map((c: any) => {
              const lastMsg = Array.isArray(c.messages)
                ? c.messages.slice(-1)[0]
                : null;
              return {
                groupId: c.groupId,
                lastMsgTime: lastMsg?.createdAt
                  ? new Date(lastMsg.createdAt).getTime()
                  : 0,
              };
            })
            .sort((a: any, b: any) => b.lastMsgTime - a.lastMsgTime)[0];

          const initialGroup =
            latestGroupData &&
            groupsData.find((g: any) => g.id === latestGroupData.groupId);

          setSelectedGroup(initialGroup || groupsData[0] || null);
        }

        setError(null);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, [getToken, isLoaded]);

  // Update messages when group changes
  useEffect(() => {
    if (!selectedGroup) return;
    const chat = groupChats.find((c) => c.groupId === selectedGroup.id);
    setMessages(chat?.messages || []);
  }, [selectedGroup, groupChats]);

  // Send group message
  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedGroup) return;

    try {
      const token = await getToken();
      if (!token) throw new Error("No token, please login again");

      const newMessage: Message = {
        senderId: CURRENT_USER_ID,
        text: messageInput,
        id: Math.random().toString(),
        createdAt: new Date().toISOString(),
        senderProfileUrl: CURRENT_USER_PROFILE_URL,
      };

      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/chat/sendGroup`,
        { groupId: selectedGroup.id, text: messageInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );

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
    <div className="flex flex-col md:flex-row w-full h-[80vh] min-h-[500px] bg-gray-900/20 backdrop-blur-md p-4 rounded-3xl gap-4 shadow-2xl text-white">
      {/* Groups List (Sidebar) */}
      <div className="w-full md:w-1/3 min-w-[250px] bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3 overflow-y-auto flex flex-col gap-2 shadow-inner">
        <h2 className="text-xl font-bold mb-3 px-1 text-white/90">Groups</h2>
        {groups.map((group) => {
          const chat = groupChats.find((c) => c.groupId === group.id);
          const lastMsg = Array.isArray(chat?.messages)
            ? chat.messages.slice(-1)[0]?.text || "No recent messages"
            : "No recent messages";

          const isSelected = selectedGroup?.id === group.id;

          return (
            <div
              key={group.id}
              onClick={() => setSelectedGroup(group)}
              className={`cursor-pointer w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                isSelected
                  ? "bg-white/30 border border-white/40 shadow-lg"
                  : "hover:bg-white/10"
              }`}
            >
              <img
                src={
                  group.profileUrl ||
                  "https://via.placeholder.com/40/808080/FFFFFF?text=G"
                }
                alt={`${group.name}'s avatar`}
                className="w-10 h-10 rounded-full object-cover border border-white/50"
              />
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="font-semibold text-white/95">{group.name}</div>
                <div className="text-sm text-white/70 truncate">{lastMsg}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat Box */}
      <div className="flex-1 relative flex flex-col bg-white/15 backdrop-blur-2xl border border-white/30 rounded-2xl shadow-xl overflow-hidden">
        {/* Chat Header */}
        {selectedGroup && (
          <div className="p-4 border-b border-white/30 bg-white/10 backdrop-blur-md flex items-center gap-3 shadow-md">
            <img
              src={
                selectedGroup.profileUrl ||
                "https://via.placeholder.com/40/808080/FFFFFF?text=G"
              }
              alt="group avatar"
              className="w-10 h-10 rounded-full object-cover border border-white/50"
            />
            <h3 className="text-lg font-semibold text-white/95">
              {selectedGroup.name}
            </h3>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
          {!selectedGroup && (
            <div className="text-white/50 text-center my-auto text-xl">
              Select a group to start chatting
            </div>
          )}
          {selectedGroup &&
            messages.map((msg) => {
              const isSender = msg.senderId === CURRENT_USER_ID;
              const avatarUrl = msg.senderProfileUrl || "/defaultPfp.jpeg";

              return (
                <div
                  key={msg.id || Math.random()}
                  className={`flex ${
                    isSender ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className="flex items-start gap-2 max-w-[80%]">
                    {!isSender && (
                      <img
                        src={avatarUrl}
                        alt="avatar"
                        className="w-8 h-8 rounded-full object-cover border border-white/50 flex-shrink-0"
                      />
                    )}
                    <div
                      className={`p-3 rounded-3xl shadow-xl text-gray-900 ${
                        isSender
                          ? "bg-teal-400/80 rounded-br-md"
                          : "bg-white/40 rounded-tl-md"
                      }`}
                    >
                      <span>{msg.text}</span>
                    </div>
                    {isSender && (
                      <img
                        src={avatarUrl}
                        alt="my avatar"
                        className="w-8 h-8 rounded-full object-cover border border-white/50 flex-shrink-0"
                      />
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Input Area */}
        {selectedGroup && (
          <div className="p-3 border-t border-white/30 bg-white/10 backdrop-blur-lg flex gap-3 rounded-b-2xl shadow-inner">
            <input
              type="text"
              className="flex-1 p-3 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-teal-400/80"
              placeholder="Message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button
              onClick={sendMessage}
              className="w-12 h-12 rounded-full bg-teal-500 hover:bg-teal-600 text-white font-bold transition flex items-center justify-center shadow-lg"
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

export default GroupTab;
