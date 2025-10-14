import { useState, useEffect } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser,
} from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

import ChatTab from "./tabs/ChatTab";
import SettingTab from "./tabs/SettingTab";
import Loading from "../components/Loading";
import GroupTab from "./tabs/GroupTab";

type TabName = "chat" | "group" | "settings";

const Homepage = () => {
  const [activeTab, setActiveTab] = useState<TabName>("chat");

  const navigate = useNavigate();
  const { isSignedIn, user } = useUser();

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
    <div className="flex bg-white/10 p-1 rounded-full border border-white/20 shadow-xl backdrop-blur-md">
      {(["chat", "group", "settings"] as TabName[]).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`
            px-4 py-2 text-sm font-semibold transition-all duration-300 ease-in-out
            ${
              activeTab === tab
                ? "bg-white/90 text-gray-900 rounded-full shadow-md"
                : "text-white/80 hover:text-white/95"
            }
          `}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative min-h-screen flex flex-col bg-gray-800 text-white font-sans">
      {/* Full-screen Background and Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center -z-20"
        style={{ backgroundImage: "url('/background.jpg')" }}
      ></div>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[40px] -z-10"></div>

      {/* FIXED HEADER WITH TABS */}
      <header className="bg-white/10 backdrop-blur-lg fixed h-20 w-full flex items-center justify-between px-6 text-white z-20 border-b border-white/20 shadow-xl">
        {/* Left: Logo/Title */}
        <h2 className="text-xl font-bold tracking-wider text-white/95 hidden sm:block">
          ChatApp
        </h2>

        <div className="flex-1 flex justify-center h-full items-center">
          <TabsNavigation />
        </div>

        <div className="flex items-center gap-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-gray-900 font-semibold rounded-lg transition shadow-md">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <span className="text-sm font-medium text-white/80 hidden lg:inline">
              {user?.username ||
                user?.fullName ||
                user?.primaryEmailAddress?.emailAddress}
            </span>
            <div className="rounded-full overflow-hidden border-2 border-white/50">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>
      </header>

      <div className="flex-1 flex justify-center items-start pt-22 pb-2 px-6 relative z-10">
        <div
          className="
            w-full max-w-6xl p-8 md:p-12 rounded-[40px] 
            bg-white/20 backdrop-blur-[60px] 
            border border-white/25 
            shadow-[0_6px_40px_rgba(0,0,0,0.1),0_12px_30px_rgba(0,0,0,0.05)] 
            overflow-hidden text-white/90
          "
        >
          {renderTabContent()}
        </div>
      </div>

    </div>
  );
};

export default Homepage;
