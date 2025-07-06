import { Link } from "react-router-dom";
import GlobalNavbar from "../GlobalNavbar";

const publicEvents = [
  { id: 1, name: "Wedding", slug: "wedding" },
  { id: 2, name: "Birthday", slug: "birthday" },
  { id: 3, name: "Vacation", slug: "vacation" },
];

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-6">
      <GlobalNavbar />
      <h1 className="text-4xl font-bold mb-8 text-center">Public Gallery</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {publicEvents.map((event) => (
          <Link
            key={event.id}
            to={`/public/${event.slug}`}
            className="block bg-gray-800 rounded-xl p-6 hover:bg-gray-700 transition duration-300 shadow-lg"
          >
            <h2 className="text-2xl font-semibold">{event.name}</h2>
            <p className="mt-2 text-gray-400">View photos from {event.name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
