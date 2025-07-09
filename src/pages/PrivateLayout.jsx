import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import GlobalNavbar from "../GlobalNavbar";
import NewEventForm from "./NewEventForm";

const ALLOWED_ID = "df853e4c8f6849c397f13b8c3bbffdae";

export default function PrivateLayout() {
  const user = useAuth();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch("/api/getEventsList");
        const data = await res.json();
        setEvents(data);
      } catch (err) {
        console.error("Failed to load events", err);
      }
    }
    fetchEvents();
  }, []);

  if (user === null) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Checking login...</p>
      </div>
    );
  }

  if (!user || user.identityProvider !== "github" || user.userId !== ALLOWED_ID) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-center p-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
          <p className="mb-6">You are not allowed to view this gallery.</p>
          <a href="/" className="block border border-white px-6 py-2 rounded-xl font-semibold hover:bg-white hover:text-black transition">
            Return to Homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <GlobalNavbar />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Private Gallery</h1>
        <div className="text-sm text-gray-400 text-right max-w-xs">
          <NewEventForm />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {events.map((event) => (
          <Link
            key={event}
            to={`/private/${event}`}
            className="bg-white bg-opacity-10 rounded-xl p-6 text-white hover:bg-opacity-20 transition text-center"
          >
            {event}
          </Link>
        ))}
      </div>
    </div>
  );
}
