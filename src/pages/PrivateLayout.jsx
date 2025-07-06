import { Link, Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import GlobalNavbar from "../GlobalNavbar";

const events = [
  "Amsterdam",
  "Belgium",
  "Berlin",
  "Climbing",
  "Cooking",
  "Gala",
  "Maastricht",
  "Monschau",
  "Music",
  "StPeters",
  "Valkenburg",
];

export default function PrivateLayout() {
  const user = useAuth();

  if (user === null) return <div className="text-white">Checking login...</div>;
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="p-6">
      <GlobalNavbar />
      <h1 className="text-3xl font-bold mb-6 text-white">Private Gallery</h1>
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
