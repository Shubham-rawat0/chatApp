import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import Loading from "../../components/Loading";

interface RoomMember {
  id: string;
  name?: string;
  username?: string;
  profileUrl?: string;
}

interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
  sender?: RoomMember;
}

interface Room {
  id: string;
  roomName?: string;
  createdById: string;
  createdAt: string;
  chats: ChatMessage[];
}

interface Group {
  room: Room;
  members: RoomMember[];
}

const GroupTab = () => {
  const { getToken, isLoaded } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = "me"; // Map to Clerk userId later

  // Fetch groups
  useEffect(() => {
    const fetchGroups = async () => {
      if (!isLoaded) return;

      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("No token found");

        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/user/getGroups`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const roomsData: Group[] = Array.isArray(res.data)
          ? res.data
          : res.data.groups || [];

        setGroups(roomsData);

        // Auto-select most recent room
        if (roomsData.length > 0) {
          const sorted = [...roomsData].sort((a, b) => {
            const lastA = a.room.chats?.slice(-1)[0]?.createdAt || 0;
            const lastB = b.room.chats?.slice(-1)[0]?.createdAt || 0;
            return new Date(lastB).getTime() - new Date(lastA).getTime();
          });
          setSelectedGroup(sorted[0]);
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

  // Send group message
  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedGroup) return;

    try {
      const token = await getToken();
      if (!token) throw new Error("No token found");

      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/chat/sendGroup`,
        {
          groupId: selectedGroup.room.id,
          text: messageInput,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local state
      setSelectedGroup((prev) =>
        prev
          ? {
              ...prev,
              room: {
                ...prev.room,
                chats: [
                  ...prev.room.chats,
                  {
                    id: Math.random().toString(),
                    senderId: currentUserId,
                    text: messageInput,
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
            }
          : prev
      );

      setMessageInput("");
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) return <Loading />;
  if (error)
    return (
      <div className="text-red-400 p-4 rounded-xl bg-red-900/40 border border-red-600">
        {error}
      </div>
    );

  return (
    <div className="flex w-full h-[80vh] bg-gray-900/20 rounded-3xl overflow-hidden text-white">
      {/* LEFT SIDEBAR */}
      <div className="w-1/3 bg-gray-800/60 border-r border-gray-700 flex flex-col">
        <div className="p-4 text-xl font-semibold border-b border-gray-700">
          Groups
        </div>
        <div className="flex-1 overflow-y-auto">
          {groups.map((group) => {
            const lastMsg =
              group.room.chats?.slice(-1)[0]?.text || "No recent messages";

            const groupName =
              group.room.roomName ||
              group.members.map((m) => m.name || m.username).join(", ") ||
              "Unnamed Group";

            const profileUrl =
              group.members[0]?.profileUrl ||
              "https://via.placeholder.com/40/808080/FFFFFF?text=G";

            const isSelected = selectedGroup?.room.id === group.room.id;

            return (
              <div
                key={group.room.id}
                onClick={() => setSelectedGroup(group)}
                className={`flex items-center gap-3 p-3 cursor-pointer transition-all ${
                  isSelected ? "bg-gray-700/70" : "hover:bg-gray-700/40"
                }`}
              >
                <img
                  src={profileUrl}
                  alt="group"
                  className="w-10 h-10 rounded-full object-cover border border-white/30"
                />
                <div className="flex flex-col">
                  <div className="font-semibold">{groupName}</div>
                  <div className="text-sm text-gray-300 truncate w-40">
                    {lastMsg}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT CHAT AREA */}
      <div className="flex-1 flex flex-col bg-gray-900/40">
        {selectedGroup ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex items-center gap-3 bg-gray-800/40">
              <img
                src={
                  selectedGroup.members[0]?.profileUrl ||
                  "https://via.placeholder.com/40/808080/FFFFFF?text=G"
                }
                className="w-10 h-10 rounded-full border border-white/30"
              />
              <div>
                <div className="font-semibold text-lg">
                  {selectedGroup.room.roomName ||
                    selectedGroup.members
                      .map((m) => m.name || m.username)
                      .join(", ")}
                </div>
                <div className="text-sm text-gray-400">
                  {selectedGroup.members.length} members
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {selectedGroup.room.chats.length === 0 && (
                <div className="text-gray-400 text-center mt-20">
                  No messages yet
                </div>
              )}
              {selectedGroup.room.chats.map((msg) => {
                const isSender = msg.senderId === currentUserId;
                const sender = selectedGroup.members.find(
                  (m) => m.id === msg.senderId
                );

                return (
                  <div
                    key={msg.id}
                    className={`flex ${
                      isSender ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isSender && (
                      <img
                        src={
                          sender?.profileUrl ||
                          "https://via.placeholder.com/30/808080/FFFFFF?text=U"
                        }
                        className="w-8 h-8 rounded-full border border-white/30"
                      />
                    )}
                    <div
                      className={`max-w-[70%] px-3 py-2 rounded-2xl ${
                        isSender
                          ? "bg-teal-500/80 text-gray-900 rounded-br-sm"
                          : "bg-gray-200/70 text-gray-900 rounded-tl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                    {isSender && (
                      <img
                        src="/defaultPfp.jpeg"
                        className="w-8 h-8 rounded-full border border-white/30"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-700 flex gap-2 bg-gray-800/40">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message"
                className="flex-1 p-2 rounded-full bg-gray-700/50 border border-gray-600 focus:outline-none text-white placeholder-gray-400"
              />
              <button
                onClick={sendMessage}
                className="bg-teal-500 hover:bg-teal-600 text-white px-4 rounded-full font-semibold"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 text-gray-400 text-lg">
            Select a group to start chatting
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupTab;
