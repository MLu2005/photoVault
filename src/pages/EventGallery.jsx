import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import useAuth from "../hooks/useAuth";
import GlobalNavbar from "../GlobalNavbar";

export default function EventGallery({ isPrivate }) {
  const { event } = useParams();
  const [photos, setPhotos] = useState([]);
  const user = useAuth();

  // Obsługa stanu "ładowania sesji"
  if (isPrivate && user === null) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-lg text-gray-300 animate-pulse">Checking login...</p>
      </div>
    );
  }

  // Obsługa użytkownika niezalogowanego
  if (isPrivate && !user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-center p-6">
        <div>
          <h1 className="text-3xl font-bold mb-4">Access Restricted</h1>
          <p className="mb-6">You must be logged in to view this gallery.</p>
          <div className="space-y-3">
            <a
              href={`/.auth/login/github?post_login_redirect_uri=/private/${event}`}
              className="block bg-white text-black px-6 py-2 rounded-xl font-semibold hover:bg-gray-200 transition"
            >
              Log in with GitHub
            </a>
            <a
              href={`/.auth/login/aad?post_login_redirect_uri=/private/${event}`}
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

  // Pobieranie zdjęć
  useEffect(() => {
    async function fetchPhotos() {
      try {
        const res = await fetch(`/api/getPhotosByEvent?event=${event}`);
        const urls = await res.json();
        setPhotos(urls);
      } catch (err) {
        console.error("Error loading photos:", err);
      }
    }

    fetchPhotos();
  }, [event]);

  return (
    <div className="min-h-screen bg-black text-white">
      <GlobalNavbar />
      <main className="p-6">
        <h1 className="text-3xl font-bold mb-6">
          {isPrivate ? "Private" : "Public"} Gallery: {event}
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((url, index) => (
            <img
              key={index}
              src={url}
              alt={`photo-${index}`}
              className="rounded-lg"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
