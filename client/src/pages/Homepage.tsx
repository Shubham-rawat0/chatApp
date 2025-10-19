import { useState, useEffect } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser,
} from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
// Import icons for professional look
import { MessageSquare, Users, Settings } from "lucide-react";

import ChatTab from "./tabs/ChatTab";
import SettingTab from "./tabs/SettingTab";
import Loading from "../components/Loading";
import GroupTab from "./tabs/GroupTab";

type TabName = "chat" | "group" | "settings";

const tabMap: { [key in TabName]: { label: string; icon: React.ReactNode } } = {
  chat: { label: "Private Chat", icon: <MessageSquare size={18} /> },
  group: { label: "Group Chat", icon: <Users size={18} /> },
  settings: { label: "Settings", icon: <Settings size={18} /> },
};

const Homepage = () => {
  const [activeTab, setActiveTab] = useState<TabName>("chat");

  const navigate = useNavigate();
  const { isSignedIn, user } = useUser();

  // Navigation to /chat on sign-in logic (Kept as is)
  useEffect(() => {
    if (isSignedIn && window.location.pathname === "/") {
      navigate("/chat");
    }
  }, [isSignedIn, navigate]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "chat":
        return <ChatTab />;
      case "group":
        return <GroupTab />;
      case "settings":
        return <SettingTab />;
      default:
        return <Loading />;
    }
  };

  const TabsNavigation = () => (
    <div className="flex bg-white/10 p-1 rounded-xl border border-white/30 shadow-2xl backdrop-blur-md space-x-1">
      {(["chat", "group", "settings"] as TabName[]).map((tab) => {
        const isActive = activeTab === tab;
        const tabInfo = tabMap[tab];

        return (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              flex items-center justify-center gap-2 
              px-4 py-2 text-sm font-semibold rounded-lg 
              transition-all duration-300 ease-in-out min-w-[100px]
              ${
                isActive
                  ? "bg-teal-500 text-gray-900 shadow-xl" // Stronger accent color for active state
                  : "text-white/80 hover:bg-white/15 hover:text-white"
              }
            `}
            aria-current={isActive ? "page" : undefined}
          >
            {tabInfo.icon}
            <span className="hidden sm:inline">{tabInfo.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="relative min-h-screen flex flex-col bg-gray-900 text-white font-sans">
      {/* 1. Full-screen Background and Overlay (Refined Blur/Darkness) */}
      <div
        className="absolute inset-0 bg-cover bg-center -z-20"
        // Placeholder for a professional, blurred dark background image
        style={{ backgroundImage: "url('/background.jpg')" }}
      ></div>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[50px] -z-10"></div>

      {/* 2. FIXED HEADER WITH TABS */}
      <header className="bg-white/10 backdrop-blur-xl fixed h-20 w-full flex items-center justify-between px-4 sm:px-8 text-white z-50 border-b border-white/20 shadow-2xl">
        {/* Left: Logo/Title */}
        <h1 className="text-2xl font-extrabold tracking-widest text-teal-400">
          ChatApp
        </h1>

        {/* Center: Tabs Navigation */}
        <div className="flex-1 flex justify-center h-full items-center">
          <TabsNavigation />
        </div>

        {/* Right: User Authentication/Profile */}
        <div className="flex items-center gap-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-gray-900 font-bold rounded-xl transition duration-300 shadow-lg hover:shadow-xl active:scale-95">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <span className="text-base font-medium text-white/90 hidden lg:inline">
              Welcome, {user?.firstName || user?.username || "User"}!
            </span>
            <div className="rounded-full overflow-hidden border-3 border-teal-400/80 shadow-md">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>
      </header>

      {/* 3. MAIN CONTENT AREA */}
      <main
        className="flex-1 flex justify-center items-start px-4 sm:px-6 relative z-10"
        style={{ paddingTop: "85px" }} // 80px header + 5px gap
      >
        <div
          className="
      w-full max-w-7xl h-full p-6 sm:p-8 md:p-10 
      rounded-[28px] lg:rounded-[40px] 
      bg-white/10 backdrop-blur-[80px] 
      border border-white/20 
      shadow-[0_10px_60px_rgba(0,0,0,0.4),0_20px_40px_rgba(0,0,0,0.2)] 
      overflow-hidden text-white/90
    "
        >
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
};

export default Homepage;
