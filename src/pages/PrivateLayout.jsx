import { Link } from "react-router-dom";

const privateEvents = [
  { id: 1, name: "Private Party", slug: "private-party" },
  { id: 2, name: "Company Retreat", slug: "company-retreat" },
];

export default function PrivateLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-6">
      <h1 className="text-4xl font-bold mb-8 text-center">Private Gallery</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {privateEvents.map((event) => (
          <Link
            key={event.id}
            to={`/private/${event.slug}`}
            className="block bg-gray-800 rounded-xl p-6 hover:bg-gray-700 transition duration-300 shadow-lg"
          >
            <h2 className="text-2xl font-semibold">{event.name}</h2>
            <p className="mt-2 text-gray-400">Access photos from {event.name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
