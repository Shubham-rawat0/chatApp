import { useNavigate } from "react-router-dom";
import { SignInButton, SignUpButton, useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import Loading from "../components/Loading";

const Welcome = () => {
  const navigate = useNavigate();
  const { isSignedIn } = useUser();

  useEffect(() => {
    if (isSignedIn ) {
      navigate("/chat");
    }
  }, [isSignedIn, navigate]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-purple-800 text-white py-20 px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Welcome to ChatApp
          </h1>
          <p className="text-lg md:text-xl mb-6 max-w-2xl mx-auto">
            ChatApp is your one-stop solution for real-time communication.
            Connect instantly with friends, teammates, and communities — all in
            one place.
          </p>

          {!isSignedIn ? (
            <div className="flex justify-center gap-4">
              <SignInButton>
                <button className="bg-teal-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-teal-300 transition">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="bg-white text-teal-700 px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition">
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          ) : (
            <div>
              <Loading />
            </div>
          )}
        </section>

        {/* Features Section */}
        <section className="py-16 px-6 md:px-12 bg-white text-gray-800">
          <h2 className="text-3xl font-bold text-center mb-10">
            Why Choose ChatApp?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="bg-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition">
              <h3 className="text-xl font-semibold mb-2">
                💬 Real-Time Messaging
              </h3>
              <p>
                Experience instant delivery and updates powered by Socket.io for
                smooth conversations.
              </p>
            </div>
            <div className="bg-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition">
              <h3 className="text-xl font-semibold mb-2">
                👥 Group & 1-to-1 Chats
              </h3>
              <p>
                Stay connected with individuals or groups — collaborate
                efficiently and effortlessly.
              </p>
            </div>
            <div className="bg-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition">
              <h3 className="text-xl font-semibold mb-2">
                🔒 Secure Authentication
              </h3>
              <p>
                Built with Clerk for seamless and secure sign-in using modern
                authentication flows.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 px-6 md:px-12 bg-gray-50">
          <h2 className="text-3xl font-bold text-center mb-10">How It Works</h2>
          <div className="max-w-4xl mx-auto text-center space-y-6 text-gray-700">
            <p>
              1️⃣ <strong>Create an Account</strong> — Sign up easily using
              Clerk’s secure platform.
            </p>
            <p>
              2️⃣ <strong>Start a Conversation</strong> — Connect with anyone in
              real-time using our optimized chat engine.
            </p>
            <p>
              3️⃣ <strong>Collaborate & Share</strong> — Exchange messages,
              files, and ideas instantly.
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-teal-600 text-white py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Chatting?</h2>
          <p className="text-lg mb-8">
            Join thousands of users already communicating smarter with ChatApp.
          </p>
          {!isSignedIn && (
            <SignUpButton>
              <button className="bg-white text-teal-700 px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition">
                Get Started for Free
              </button>
            </SignUpButton>
          )}
        </section>
      </main>

    </div>
  );
};

export default Welcome;


