import { Link } from "react-router-dom";
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

  if (user === null) {
    // nadal trwa sprawdzanie sesji
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Checking login...</p>
      </div>
    );
  }

  if (!user) {
    // nie zalogowany
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-center p-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Access Restricted</h1>
          <p className="mb-6">You must be logged in to view private galleries.</p>
          <div className="space-y-3">
            <a
              href="/.auth/login/github?post_login_redirect_uri=/private"
              className="block bg-white text-black px-6 py-2 rounded-xl font-semibold hover:bg-gray-200 transition"
            >
              Log in with GitHub
            </a>
            <a
              href="/.auth/login/aad?post_login_redirect_uri=/private"
              className="block bg-white text-black px-6 py-2 rounded-xl font-semibold hover:bg-gray-200 transition"
            >
              Log in with Microsoft
            </a>
            <Link
              to="/"
              className="block border border-white px-6 py-2 rounded-xl font-semibold hover:bg-white hover:text-black transition"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  
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
