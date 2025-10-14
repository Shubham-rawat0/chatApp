import { useEffect, useState} from "react";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import Loading from "../../components/Loading";

interface UserData {
  username: string;
  firstName: string;
  lastName: string;
  bio: string;
  email: string;
  onlineStatus?: string;
  location?: string;
  accountStatus?: string;
}

const SettingTab = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    const fetchUser = async () => {
      if (!isLoaded) return;

      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("No token found, please login again");

        const res = await axios.get("http://localhost:3000/user/account", {
          headers: { Authorization: `Bearer ${token}` },
        });

        setUser({
          username: res.data.user.name || "",
          firstName: res.data.user.firstName || "",
          lastName: res.data.user.lastName || "",
          bio: res.data.user.bio || "", 
          email: res.data.user.email || "",
          onlineStatus: "Online",
          location: "Earth",
          accountStatus: "Active",
        });
        setError(null);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [getToken, isLoaded]);

  const handleChange = (
    e: any
  ) => {
    if (!user) return;
    const { name, value } = e.target;
    setUser({ ...user, [name]: value });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setSuccessMsg(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No token found, please login again");

      await axios.put(
        "http://localhost:3000/user/update",
        {
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          bio: user.bio,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setSuccessMsg("Profile updated successfully!");
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <Loading />;
  if (error)
    return <div className="text-red-500 p-4 rounded bg-red-50">{error}</div>;

  return (
    <div className="w-full max-w-2xl p-6 bg-white/15 backdrop-blur-md border border-white/30 rounded-xl text-white/90">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>
      {successMsg && <div className="text-green-400 mb-4">{successMsg}</div>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            name="username"
            value={user?.username || ""}
            onChange={handleChange}
            className="w-full p-2 rounded bg-white/20 text-white border border-white/30"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">First Name</label>
            <input
              type="text"
              name="firstName"
              value={user?.firstName || ""}
              onChange={handleChange}
              className="w-full p-2 rounded bg-white/20 text-white border border-white/30"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Last Name</label>
            <input
              type="text"
              name="lastName"
              value={user?.lastName || ""}
              onChange={handleChange}
              className="w-full p-2 rounded bg-white/20 text-white border border-white/30"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Bio</label>
          <textarea
            name="bio"
            value={user?.bio || ""}
            onChange={handleChange}
            rows={3}
            className="w-full p-2 rounded bg-white/20 text-white border border-white/30"
          />
        </div>

        {/* Dummy fields */}
        <div className="grid grid-cols-2 gap-4 mt-2 text-gray-300 text-sm">
          <div>Online Status: {user?.onlineStatus}</div>
          <div>Location: {user?.location}</div>
          <div>Account Status: {user?.accountStatus}</div>
          <div>Email: {user?.email}</div>
        </div>

        <button
          type="submit"
          className="mt-4 px-4 py-2 bg-teal-400 text-gray-900 font-semibold rounded hover:bg-teal-500 transition"
        >
          Update Profile
        </button>
      </form>
    </div>
  );
};

export default SettingTab;
