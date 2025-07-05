import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

export default function EventGallery() {
  const { event } = useParams();
  const [photos, setPhotos] = useState([]);

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
      <h1 className="text-2xl font-bold mb-4">{event}</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {photos.map((url, index) => (
          <img key={index} src={url} alt={`photo-${index}`} className="rounded-lg" />
        ))}
      </div>
    </div>
  );
}
