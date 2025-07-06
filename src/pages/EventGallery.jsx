import { useParams, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import useAuth from "../hooks/useAuth"; // UWAGA: ścieżka może być "../hooks/useAuth" jeśli plik w pages/

export default function EventGallery({ isPrivate }) {
  const { event } = useParams();
  const [photos, setPhotos] = useState([]);
  const user = useAuth();

  // Autoryzacja dla /private/:event
  if (isPrivate && user === null) {
    return <div className="text-white">Checking login...</div>;
  }

  if (isPrivate && !user) {
    return <Navigate to="/" replace />;
  }

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
    <div className="p-4 text-white">
      <h1 className="text-2xl font-bold mb-4">
        {isPrivate ? "Private" : "Public"} Gallery for: {event}
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
    </div>
  );
}
