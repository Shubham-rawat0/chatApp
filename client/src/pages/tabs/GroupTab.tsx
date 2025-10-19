import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import Loading from "../../components/Loading";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  Plus,
  X,
  Search,
  UserPlus,
  LogIn,
  Crown,
  Users,
  Clock,
  ArrowRight,
} from "lucide-react";
import { io, Socket } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

// --- INTERFACE DEFINITIONS ---
interface RoomMember {
  id: string;
  name?: string;
  username?: string;
  profileUrl?: string;
  lastActive?: string;
  email?: string;
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
// -----------------------------

// Utility functions
const getGroupAvatar = (name: string): string => {
  if (!name) return "G";
  const parts = name.split(" ").filter((p) => p.length > 0);
  return parts.length > 1
    ? (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
    : name.charAt(0).toUpperCase();
};

const formatMessageTime = (isoString: string): string => {
  try {
    return format(new Date(isoString), "h:mm a");
  } catch {
    return "";
  }
};

const formatLastActive = (isoString?: string): string => {
  if (!isoString) return "Status Unknown";
  try {
    const date = parseISO(isoString);
    if (new Date().getTime() - date.getTime() < 60000) {
      return "Active now";
    }
    return `Active ${formatDistanceToNow(date, { addSuffix: true })}`;
  } catch {
    return "Status Unknown";
  }
};

let socketGlobal: Socket | null = null;

const GroupTab = () => {
  const { getToken, isLoaded } = useAuth();

  // core data
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // modals / creation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMemberSelectionOpen, setIsMemberSelectionOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isMemberListModalOpen, setIsMemberListModalOpen] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [availableFriends, setAvailableFriends] = useState<RoomMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<RoomMember[]>([]);
  const [membersToAddToExisting, setMembersToAddToExisting] = useState<
    RoomMember[]
  >([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // refs
  const socketRef = useRef<Socket | null>(null);
  const selectedGroupRef = useRef<Group | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // derived
  const currentUserId = currentUser?.id;
  const isSelectedGroupAdmin =
    selectedGroup?.room.createdById === currentUserId;
  const isCurrentUserMember =
    selectedGroup?.members.some((m) => m.id === currentUserId) ?? false;

  // keep ref updated
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  // autoscroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedGroup?.room.chats.length]);

  // initial fetch: currentUser, groups, friends
  useEffect(() => {
    const fetchData = async () => {
      if (!isLoaded) return;
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("No token found");

        // current user
        const userRes = await axios.get(`${BACKEND_URL}/user/currentUser`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const user = userRes.data.currentUser;
        setCurrentUser(user);

        // groups
        const groupRes = await axios.get(`${BACKEND_URL}/user/getGroups`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let roomsData: Group[] = Array.isArray(groupRes.data)
          ? groupRes.data
          : groupRes.data.groups || [];
        roomsData = roomsData.map((g) => ({
          ...g,
          room: {
            ...g.room,
            chats: Array.isArray(g.room.chats)
              ? g.room.chats.map((msg: any, idx: number) => ({
                  id: msg.id || `${g.room.id}_${msg.createdAt || idx}`,
                  text: msg.text || msg.message || msg.content || "",
                  senderId:
                    msg.senderId ||
                    msg.userId ||
                    (msg.sender && msg.sender.id) ||
                    "",
                  createdAt: msg.createdAt || new Date().toISOString(),
                  sender: msg.sender || undefined,
                }))
              : [],
          },
        }));
        setGroups(roomsData);

        // friends
        const friendsRes = await axios.get(
          `${BACKEND_URL}/user/friendsOfuser`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const fetchedFriends: RoomMember[] = Array.isArray(
          friendsRes.data.friends
        )
          ? friendsRes.data.friends.filter((u: RoomMember) => u.id !== user.id)
          : [];
        setAvailableFriends(fetchedFriends);

        // auto-select most recent
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

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, isLoaded]);

  // initialize socket when currentUser is available (single socket)
  useEffect(() => {
    if (!currentUser) return;

    // avoid duplicate socket instances
    if (socketRef.current && socketRef.current.connected) {
      // already connected
      socketRef.current.emit("register", currentUser.id);
      return;
    }

    const s = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    socketRef.current = s;
    socketGlobal = s;

    s.on("connect", () => {
      console.log("socket connected", s.id);
      // Only join group if selectedGroup exists
      if (selectedGroup?.room.id) {
        s.emit("register-group", {
          userId: currentUser.id,
          roomId: selectedGroup.room.id,
        });
      }
    });

    // receive group messages broadcast by server
    s.on(
      "group-message-received",
      (data: {
        senderId: string;
        roomId: string;
        message: string;
        createdAt: string;
      }) => {
        try {
          // basic validation
          if (!data || !data.roomId || !data.message) {
            console.warn("Received invalid group message:", data);
            return;
          }

          // build ChatMessage
          const incoming: ChatMessage = {
            id: `${data.roomId}_${data.createdAt}_${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            text: data.message,
            senderId: data.senderId,
            createdAt: data.createdAt,
            sender: undefined,
          };

          // update groups list (append to that group's chats)
          setGroups((prev) =>
            prev.map((g) => {
              if (g.room.id === data.roomId) {
                let chats = g.room.chats;
                const last = chats[chats.length - 1];
                if (
                  last &&
                  last.senderId === data.senderId &&
                  last.text === data.message &&
                  last.id.startsWith("temp_")
                ) {
                  chats = chats.slice(0, -1);
                }
                if (
                  chats.length &&
                  chats[chats.length - 1].createdAt === data.createdAt &&
                  chats[chats.length - 1].text === data.message
                ) {
                  return g;
                }
                return {
                  ...g,
                  room: {
                    ...g.room,
                    chats: [
                      ...chats,
                      {
                        id: `${data.roomId}_${data.createdAt}_${Math.random()
                          .toString(36)
                          .slice(2, 8)}`,
                        text: data.message,
                        senderId: data.senderId,
                        createdAt: data.createdAt,
                        sender: undefined,
                      },
                    ],
                  },
                };
              }
              return g;
            })
          );

          if (selectedGroupRef.current?.room.id === data.roomId) {
            setSelectedGroup((prev) =>
              prev
                ? {
                    ...prev,
                    room: {
                      ...prev.room,
                      chats: [...prev.room.chats, incoming],
                    },
                  }
                : prev
            );
          }
        } catch (err) {
          console.error("Error handling incoming group message:", err);
        }
      }
    );

    s.on("disconnect", (reason) => {
      console.log("socket disconnected:", reason);
    });

    s.on("connect_error", (err) => {
      console.error("socket connect_error:", err);
    });

    return () => {
      try {
        s.off("group-message-received");
        s.disconnect();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // when a group is selected, register with backend for that group via socket
  useEffect(() => {
    if (!selectedGroup || !currentUser || !socketRef.current) return;
    try {
      socketRef.current.emit("register-group", {
        userId: currentUser.id,
        roomId: selectedGroup.room.id,
      });
    } catch (err) {
      console.error("Error registering group on socket:", err);
    }
  }, [selectedGroup, currentUser]);

  // helper: optional fetch of single group (not required, kept commented in main flow)
  const fetchSingleGroup = async (groupId: string) => {
    try {
      const token = await getToken();
      const res = await axios.get(`${BACKEND_URL}/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const g: Group = res.data.group;
      // update groups and selectedGroup
      setGroups((prev) => {
        const found = prev.find((p) => p.room.id === groupId);
        if (found) {
          return prev.map((p) => (p.room.id === groupId ? g : p));
        }
        return [g, ...prev];
      });
      if (selectedGroup?.room.id === groupId) setSelectedGroup(g);
    } catch (err) {
      // ignore
    }
  };

  // Send group message (emit via socket, fallback to HTTP if socket not available)
  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedGroup || !currentUser) return;

    if (!isCurrentUserMember) {
      alert("You must join the group before sending a message.");
      setMessageInput("");
      return;
    }

    // Prepare message payload
    const messageData = {
      userId: currentUser.id,
      roomId: selectedGroup.room.id,
      message: messageInput,
      createdAt: new Date().toISOString(),
    };

    // Create optimistic message for UI
    const optimistic: ChatMessage = {
      id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: messageInput,
      senderId: currentUser.id,
      createdAt: messageData.createdAt,
      sender: {
        id: currentUser.id,
        name: currentUser.name,
        profileUrl: currentUser.profileUrl,
      },
    };

    // update UI
    setSelectedGroup((prev) => {
      if (!prev) return prev;
      const last = prev.room.chats[prev.room.chats.length - 1];
      if (
        last &&
        last.text === optimistic.text &&
        last.senderId === optimistic.senderId &&
        Math.abs(
          new Date(last.createdAt).getTime() -
            new Date(optimistic.createdAt).getTime()
        ) < 2000
      ) {
        return prev;
      }
      return {
        ...prev,
        room: { ...prev.room, chats: [...prev.room.chats, optimistic] },
      };
    });
    setGroups((prev) =>
      prev.map((g) => {
        if (g.room.id !== selectedGroup.room.id) return g;
        const last = g.room.chats[g.room.chats.length - 1];
        if (
          last &&
          last.text === optimistic.text &&
          last.senderId === optimistic.senderId &&
          Math.abs(
            new Date(last.createdAt).getTime() -
              new Date(optimistic.createdAt).getTime()
          ) < 2000
        ) {
          return g;
        }
        return {
          ...g,
          room: { ...g.room, chats: [...g.room.chats, optimistic] },
        };
      })
    );

    setMessageInput(""); // Clear input early for better UX

    try {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("group-message-sent", messageData);
      } else {
        // fallback to HTTP endpoint if socket is down (backend should accept this route)
        const token = await getToken();
        await axios.post(
          `${BACKEND_URL}/chat/sendGroup`,
          { groupId: selectedGroup.room.id, text: optimistic.text },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (err) {
      console.error("sendMessage error:", err);
    }
  };

  // Member selection helpers
  const handleSelectMember = (member: RoomMember, forNewGroup: boolean) => {
    const setState = forNewGroup
      ? setSelectedMembers
      : setMembersToAddToExisting;
    setState((prev) => {
      if (prev.find((m) => m.id === member.id)) {
        return prev.filter((m) => m.id !== member.id);
      } else {
        return [...prev, member];
      }
    });
  };

  const filteredFriends = useMemo(() => {
    const friendsList = isAddMemberModalOpen
      ? availableFriends.filter(
          (u) => !selectedGroup?.members.some((m) => m.id === u.id)
        )
      : availableFriends;
    const q = userSearchTerm?.toLowerCase() ?? "";
    return friendsList.filter(
      (friend) =>
        (friend.name || "").toLowerCase().includes(q) ||
        (friend.username || "").toLowerCase().includes(q) ||
        (friend.email || "").toLowerCase().includes(q)
    );
  }, [
    availableFriends,
    userSearchTerm,
    isAddMemberModalOpen,
    selectedGroup?.members,
  ]);

  // CREATE GROUP
  const handleCreateGroup = async () => {
    if (!groupNameInput.trim() || selectedMembers.length === 0) {
      alert("Please enter a group name and select members.");
      return;
    }
    setIsCreating(true);
    try {
      const token = await getToken();
      const memberIds = selectedMembers.map((m) => m.id);
      const res = await axios.post(
        `${BACKEND_URL}/user/createGroup`,
        { roomName: groupNameInput.trim(), memberIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newGroup: Group = res.data.group;
      setGroups((prev) => [newGroup, ...prev]);
      setSelectedGroup(newGroup);

      // register with socket immediately
      if (socketRef.current && socketRef.current.connected && currentUser) {
        socketRef.current.emit("register-group", {
          userId: currentUser.id,
          roomId: newGroup.room.id,
        });
      }

      setGroupNameInput("");
      setSelectedMembers([]);
      setIsMemberSelectionOpen(false);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Group creation failed:", err);
      alert(err.response?.data?.message || "Failed to create group.");
    } finally {
      setIsCreating(false);
    }
  };

  // JOIN GROUP
  const handleJoinGroup = async (groupId: string) => {
    if (!currentUser) return;
    setIsJoining(true);
    try {
      const token = await getToken();
      await axios.post(
        `${BACKEND_URL}/user/joinGroup`,
        { roomId: groupId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedUser: RoomMember = {
        id: currentUser.id,
        name: currentUser.name,
        profileUrl: currentUser.profileUrl,
        lastActive: currentUser.lastActive,
      };

      const updatedGroups = groups.map((g) =>
        g.room.id === groupId
          ? { ...g, members: [...g.members, updatedUser] }
          : g
      );
      setGroups(updatedGroups);
      setSelectedGroup(
        updatedGroups.find((g) => g.room.id === groupId) || null
      );

      // register group on socket
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("register-group", {
          userId: currentUser.id,
          roomId: groupId,
        });
      }
    } catch (err: any) {
      console.error("Join group failed:", err);
      alert(err.response?.data?.message || "Failed to join group.");
    } finally {
      setIsJoining(false);
    }
  };

  // ADD MEMBERS TO GROUP
  const handleAddToGroup = async () => {
    if (!selectedGroup || membersToAddToExisting.length === 0) return;

    if (!isSelectedGroupAdmin) {
      alert("Permission denied. Only the group admin can add new members.");
      return;
    }
    setIsCreating(true);
    try {
      const token = await getToken();
      const newMemberIds = membersToAddToExisting.map((m) => m.id);

      await axios.post(
        `${BACKEND_URL}/user/addTogroup`,
        { roomId: selectedGroup.room.id, memberIds: newMemberIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newMembers = membersToAddToExisting;
      const updatedGroup: Group = {
        ...selectedGroup,
        members: [...selectedGroup.members, ...newMembers],
      };

      setGroups((prev) =>
        prev.map((g) =>
          g.room.id === selectedGroup.room.id ? updatedGroup : g
        )
      );
      setSelectedGroup(updatedGroup);

      setMembersToAddToExisting([]);
      setIsAddMemberModalOpen(false);
    } catch (err: any) {
      console.error("Add member failed:", err);
      alert(
        err.response?.data?.message || "Failed to add members to the group."
      );
    } finally {
      setIsCreating(false);
    }
  };

  // MODALS and MEMBER SELECTOR components (same as before)
  const ModalBase = ({ title, onClose, children }: any) => (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg text-gray-800">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-2xl font-bold text-indigo-700">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-600"
          >
            <X size={24} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  const GroupNameModal = () => {
    if (!isModalOpen) return null;
    return (
      <ModalBase title="New Group Name" onClose={() => setIsModalOpen(false)}>
        <p className="text-sm text-gray-600 mb-4">
          First, choose a name for your group chat.
        </p>
        <input
          type="text"
          value={groupNameInput}
          onChange={(e) => setGroupNameInput(e.target.value)}
          placeholder="Enter Group Name (e.g., Project Alpha)"
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 mb-4"
        />
        <button
          onClick={() => {
            if (!groupNameInput.trim()) {
              alert("Group name is required.");
              return;
            }
            setIsModalOpen(false);
            setIsMemberSelectionOpen(true);
            setUserSearchTerm("");
            setSelectedMembers([]);
          }}
          disabled={!groupNameInput.trim()}
          className="w-full py-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-400"
        >
          Next: Select Members <ArrowRight size={20} className="inline ml-2" />
        </button>
      </ModalBase>
    );
  };

  const MemberSelectionModal = () => {
    if (!isMemberSelectionOpen) return null;
    return (
      <ModalBase
        title={`Add Members to "${groupNameInput}"`}
        onClose={() => setIsMemberSelectionOpen(false)}
      >
        <p className="text-sm text-gray-600 mb-3">
          Select friends to invite to the new group.
        </p>
        <MemberSelector
          users={filteredFriends}
          selected={selectedMembers}
          onSelect={(m: RoomMember) => handleSelectMember(m, true)}
          searchTerm={userSearchTerm}
          setSearchTerm={setUserSearchTerm}
        />
        <button
          onClick={handleCreateGroup}
          disabled={isCreating || selectedMembers.length === 0}
          className="w-full py-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-400 mt-4"
        >
          {isCreating
            ? "Creating Group..."
            : `Create Group (${selectedMembers.length} Members)`}
        </button>
      </ModalBase>
    );
  };

  const AddMemberModal = () => {
    if (!isAddMemberModalOpen || !selectedGroup || !isSelectedGroupAdmin)
      return null;
    return (
      <ModalBase
        title={`Add Members to ${selectedGroup.room.roomName}`}
        onClose={() => {
          setIsAddMemberModalOpen(false);
          setMembersToAddToExisting([]);
          setUserSearchTerm("");
        }}
      >
        <p className="text-sm text-gray-600 mb-3">
          Select friends to add to this group. Only friends not currently in the
          group are shown.
        </p>
        <MemberSelector
          users={filteredFriends}
          selected={membersToAddToExisting}
          onSelect={(m: RoomMember) => handleSelectMember(m, false)}
          searchTerm={userSearchTerm}
          setSearchTerm={setUserSearchTerm}
        />
        <button
          onClick={handleAddToGroup}
          disabled={isCreating || membersToAddToExisting.length === 0}
          className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-400 mt-4"
        >
          {isCreating
            ? "Adding Members..."
            : `Add ${membersToAddToExisting.length} Member(s)`}
        </button>
      </ModalBase>
    );
  };

  const MemberListModal = () => {
    if (!isMemberListModalOpen || !selectedGroup) return null;
    const members = [...selectedGroup.members].sort((a, b) => {
      const isAdminA = a.id === selectedGroup.room.createdById;
      const isAdminB = b.id === selectedGroup.room.createdById;
      if (isAdminA !== isAdminB) return isAdminA ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });

    return (
      <ModalBase
        title={`Group Members (${selectedGroup.members.length})`}
        onClose={() => setIsMemberListModalOpen(false)}
      >
        <div className="h-96 overflow-y-auto border border-gray-200 rounded-lg">
          {members.map((member) => {
            const isAdmin = member.id === selectedGroup.room.createdById;
            const isSelf = member.id === currentUserId;
            const lastActiveStatus = formatLastActive(member.lastActive);
            return (
              <div
                key={member.id}
                className="flex items-center p-3 border-b hover:bg-gray-50"
              >
                <img
                  src={
                    member.profileUrl ||
                    "https://via.placeholder.com/30/808080/FFFFFF?text=U"
                  }
                  className="w-10 h-10 rounded-full object-cover mr-3"
                  alt={member.name}
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-800">
                    {member.name}{" "}
                    {isSelf && (
                      <span className="text-indigo-500 font-normal">(You)</span>
                    )}
                  </p>
                  <div className="text-sm text-gray-500 flex items-center">
                    <Clock size={14} className="mr-1 text-gray-400" />
                    {lastActiveStatus}
                  </div>
                </div>
                {isAdmin && (
                  <span className="flex items-center text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                    <Crown size={12} className="mr-1" fill="currentColor" />{" "}
                    Admin
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </ModalBase>
    );
  };

  const MemberSelector = ({
    users,
    selected,
    onSelect,
    searchTerm,
    setSearchTerm,
  }: any) => (
    <>
      <div className="relative mb-3">
        <Search
          size={20}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search friends by name or email"
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div className="mb-4 p-3 border border-dashed border-indigo-300 rounded-lg min-h-[50px] flex flex-wrap gap-2">
        {selected.map((member: RoomMember) => (
          <span
            key={member.id}
            className="flex items-center bg-indigo-100 text-indigo-700 text-sm font-medium px-3 py-1 rounded-full shadow-sm"
          >
            {member.name}
            <button
              onClick={() => onSelect(member)}
              className="ml-2 text-indigo-500 hover:text-indigo-700"
            >
              <X size={14} />
            </button>
          </span>
        ))}
        {selected.length === 0 && (
          <p className="text-gray-400 text-sm">Select friends below.</p>
        )}
      </div>
      <div className="h-40 overflow-y-auto border border-gray-200 rounded-lg">
        {users.length === 0 ? (
          <div className="text-center text-gray-400 p-4">
            No friends available to add.
          </div>
        ) : (
          users.map((member: RoomMember) => {
            const isSelected = selected.some((m: any) => m.id === member.id);
            return (
              <div
                key={member.id}
                className={`flex items-center p-3 cursor-pointer transition-colors ${
                  isSelected ? "bg-indigo-50" : "hover:bg-gray-100"
                }`}
                onClick={() => onSelect(member)}
              >
                <img
                  src={
                    member.profileUrl ||
                    "https://via.placeholder.com/30/808080/FFFFFF?text=U"
                  }
                  className="w-8 h-8 rounded-full object-cover mr-3"
                  alt={member.name}
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{member.name}</p>
                  <p className="text-sm text-gray-500">@{member.email}</p>
                </div>
                {isSelected ? (
                  <span className="text-teal-600 font-bold text-sm">Added</span>
                ) : (
                  <span className="text-gray-400 text-sm">Add</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );

  // Render
  if (isLoading) return <Loading />;

  if (error && groups.length === 0)
    return (
      <div className="text-red-600 p-4 rounded-xl bg-red-100 border border-red-300 shadow-md mx-4 my-auto">
        Error loading data: {error}
      </div>
    );

  return (
    <>
      <GroupNameModal />
      <MemberSelectionModal />
      <AddMemberModal />
      <MemberListModal />

      <div className="flex flex-col md:flex-row w-full h-[85vh] min-h-[600px] bg-white shadow-2xl rounded-xl overflow-hidden border border-gray-200">
        {/* Sidebar */}
        <div className="w-full md:w-1/3 min-w-[280px] bg-gray-50 border-r border-gray-200 overflow-y-auto flex flex-col p-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Group Chats</h2>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors font-medium shadow-md"
              title="Create New Group"
            >
              <Plus size={18} /> New
            </button>
          </div>

          <div className="space-y-2">
            {groups.length === 0 && (
              <div className="text-center text-gray-500 mt-10">
                No groups found.
              </div>
            )}
            {groups.map((group) => {
              const lastMsg = group.room.chats?.slice(-1)[0];
              const groupName = group.room.roomName || "Unnamed Group";
              const isSelected = selectedGroup?.room.id === group.room.id;

              const lastSender =
                lastMsg && group.members.find((m) => m.id === lastMsg.senderId);
              const lastSenderName =
                lastMsg &&
                (lastMsg.senderId === currentUserId
                  ? "You"
                  : lastSender?.name || "Member");

              return (
                <div
                  key={group.room.id}
                  onClick={() => setSelectedGroup(group)}
                  className={`cursor-pointer flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                    isSelected
                      ? "bg-indigo-100/70 border border-indigo-300 shadow-sm"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <div className="relative w-10 h-10 flex items-center justify-center rounded-full bg-indigo-500 text-white font-semibold text-sm flex-shrink-0">
                    {getGroupAvatar(groupName)}
                    {group.room.createdById === currentUserId && (
                      <Crown
                        size={14}
                        className="absolute -top-1 -right-1 text-yellow-400 bg-white rounded-full p-0.5"
                        fill="currentColor"
                      />
                    )}
                  </div>

                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="font-semibold text-gray-800 truncate">
                      {groupName}
                    </div>
                    <div className="text-sm truncate text-gray-500">
                      {lastMsg ? (
                        <span className="font-medium text-gray-700">
                          {lastSenderName}: {lastMsg.text}
                        </span>
                      ) : (
                        "No recent messages"
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat Box */}
        <div className="flex-1 relative flex flex-col bg-white">
          {/* Header */}
          {selectedGroup ? (
            <div className="p-4 border-b border-gray-200 bg-white shadow-sm flex justify-between items-center">
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setIsMemberListModalOpen(true)}
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 text-white font-semibold text-sm relative">
                  {getGroupAvatar(selectedGroup.room.roomName || "G")}
                  {selectedGroup.room.createdById === currentUserId && (
                    <Crown
                      size={14}
                      className="absolute -top-1 -right-1 text-yellow-400"
                      fill="currentColor"
                    />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">
                    {selectedGroup.room.roomName || "Unnamed Group"}
                  </h3>
                  <div className="text-sm text-gray-500 flex items-center hover:text-indigo-600 transition">
                    <Users size={14} className="mr-1" />
                    {selectedGroup.members.length} members (Tap to view)
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {isSelectedGroupAdmin && (
                  <button
                    onClick={() => {
                      setIsAddMemberModalOpen(true);
                      setUserSearchTerm("");
                      setMembersToAddToExisting([]);
                    }}
                    className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-md transition-colors"
                    title="Add Member (Admin Only)"
                  >
                    <UserPlus size={20} />
                  </button>
                )}

                {!isCurrentUserMember && (
                  <button
                    onClick={() => handleJoinGroup(selectedGroup.room.id)}
                    disabled={isJoining}
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-md transition-colors disabled:bg-blue-400"
                    title="Join Group"
                  >
                    <LogIn size={20} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 border-b border-gray-200 bg-white shadow-sm">
              <h3 className="text-xl font-semibold text-gray-400">
                Select a Group
              </h3>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 bg-gray-50/50 custom-scrollbar">
            {!selectedGroup && (
              <div className="text-gray-400 text-center my-auto text-xl italic">
                👈 Select a group to begin chatting
              </div>
            )}

            {selectedGroup && !isCurrentUserMember && (
              <div className="text-center my-auto p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800">
                You are not a member of this group. Click{" "}
                <strong>Join Group</strong> to participate.
              </div>
            )}

            {selectedGroup?.room.chats.length === 0 && isCurrentUserMember && (
              <div className="text-gray-400 text-center my-auto">
                Start a conversation!
              </div>
            )}

            {selectedGroup &&
              isCurrentUserMember &&
              selectedGroup.room.chats.map((msg) => {
                const isSender = currentUserId === msg.senderId;
                const sender = selectedGroup.members.find(
                  (m) => m.id === msg.senderId
                );
                const senderName = isSender
                  ? "You"
                  : sender?.name || sender?.username || "Member";
                const senderProfileUrl = isSender
                  ? currentUser?.profileUrl
                  : sender?.profileUrl;

                const avatarContent = senderProfileUrl ? (
                  <img
                    src={senderProfileUrl}
                    alt={senderName}
                    className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-700 font-semibold text-sm flex items-center justify-center flex-shrink-0">
                    {senderName.charAt(0)}
                  </div>
                );

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${
                      isSender ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isSender && avatarContent}
                    <div className="max-w-[70%] flex flex-col">
                      {!isSender && (
                        <span className="text-xs font-semibold mb-1 text-gray-600">
                          {senderName}
                        </span>
                      )}
                      <div
                        className={`p-3 rounded-2xl shadow-md text-base break-words ${
                          isSender
                            ? "bg-teal-500 text-white rounded-br-sm"
                            : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <div
                        className={`text-xs mt-1 text-gray-500 ${
                          isSender ? "text-right" : "text-left"
                        }`}
                      >
                        {formatMessageTime(msg.createdAt)}
                      </div>
                    </div>
                    {isSender && avatarContent}
                  </div>
                );
              })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {selectedGroup && isCurrentUserMember && (
            <div className="p-4 border-t border-gray-200 bg-white flex gap-3 shadow-top">
              <input
                type="text"
                className="flex-1 p-3 rounded-full bg-gray-100 border border-gray-300 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button
                onClick={sendMessage}
                disabled={!messageInput.trim()}
                className="w-12 h-12 rounded-full bg-teal-500 hover:bg-teal-600 text-white transition duration-200 flex items-center justify-center shadow-lg disabled:bg-teal-400 disabled:cursor-not-allowed"
                title="Send"
              >
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

          {selectedGroup && !isCurrentUserMember && (
            <div className="p-4 border-t border-gray-200 bg-gray-100 text-center text-gray-600">
              Join the group to send messages.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GroupTab;
