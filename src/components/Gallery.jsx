const mockPhotos = [
  { id: 1, event: "Wakacje 2024", url: "https://via.placeholder.com/150", description: "Na plaży" },
  { id: 2, event: "Wakacje 2024", url: "https://via.placeholder.com/150", description: "Wieczór" },
];

export default function Gallery({ isPrivate }) {
  return (
    <div>
      <h3>Zdjęcia</h3>
      <div style={{ display: "flex", gap: "10px" }}>
        {mockPhotos.map((photo) => (
          <div key={photo.id}>
            <img src={photo.url} alt={photo.description} width="150" />
            <p>{photo.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}