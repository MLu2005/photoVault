import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function EventGallery() {
  const { event } = useParams();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: tutaj potem damy fetch z Azure Function
    const loadPhotos = async () => {
      setLoading(true);
      try {
        // symulacja opóźnienia i danych z backendu
        await new Promise((res) => setTimeout(res, 800));
        const mockData = Array.from({ length: 12 }, (_, i) => ({
          id: i,
          url: `https://picsum.photos/seed/${event}-${i}/600/400`,
        }));
        setPhotos(mockData);
      } catch (err) {
        console.error("Error loading photos:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPhotos();
  }, [event]);

  return (
    <div className="min-h-screen bg-black text-white px-4 py-8">
      <div className="max-w-6xl mx-auto text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          Gallery for: <span className="capitalize">{event}</span>
        </h1>
        <p className="text-gray-400">
          Here you'll see photos for the event "{event}"
        </p>
      </div>

      {loading ? (
        <div className="text-center text-gray-300 text-xl">Loading photos...</div>
      ) : photos.length === 0 ? (
        <div className="text-center text-gray-400">No photos found for this event.</div>
      ) : (
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="rounded-lg overflow-hidden shadow-lg hover:scale-105 transition-transform duration-300"
            >
              <img
                src={photo.url}
                alt={`Photo ${photo.id}`}
                className="w-full h-60 object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
