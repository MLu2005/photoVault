import { useParams } from "react-router-dom";

const mockPhotos = [
  { id: 1, event: "wakacje-2024", url: "https://via.placeholder.com/150", description: "Plaża" },
  { id: 2, event: "wakacje-2024", url: "https://via.placeholder.com/150", description: "Morze" },
  { id: 3, event: "sylwester", url: "https://via.placeholder.com/150", description: "Fajerwerki" }
];

export default function GalleryPage({ isPrivate }) {
  const { event } = useParams();
  const photos = mockPhotos.filter(photo => photo.event === event);

  return (
    <div className="container">
      <h3>{isPrivate ? "Private" : "Public"} Gallery for: {event}</h3>
      <div className="gallery">
        {photos.map(photo => (
          <div key={photo.id}>
            <img src={photo.url} alt={photo.description} />
            <p>{photo.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}