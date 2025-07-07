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
  if (
  isPrivate &&
  (!user || user.identityProvider !== "github" || user.userId !== "df853e4c8f6849c397f13b8c3bbffdae")
) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center text-center p-6">
      <div>
        <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
        <p className="mb-6">You are not authorized to view this gallery.</p>
        <a
          href="/"
          className="block border border-white px-6 py-2 rounded-xl font-semibold hover:bg-white hover:text-black transition"
        >
          Return to Homepage
        </a>
      </div>
    </div>
  );
}

useEffect(() => {
  async function fetchPhotos() {
    try {
      console.log("Fetching photos for event:", event); // DEBUG
      const res = await fetch(`/api/getPhotosByEvent?event=${event}`);
      console.log("Response status:", res.status);
      const urls = await res.json();
      console.log("Received photo URLs:", urls);
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
