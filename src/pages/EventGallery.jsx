import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import useAuth from "../hooks/useAuth";
import GlobalNavbar from "../GlobalNavbar";

export default function EventGallery({ isPrivate }) {
  const { event } = useParams();
  const [photos, setPhotos] = useState([]);
  const [file, setFile] = useState(null);
  const user = useAuth();

  // --- Auth gating for private view ---
  if (isPrivate && user === null) {
    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-lg text-gray-300 animate-pulse">Checking login...</p>
        </div>
    );
  }

  if (
      isPrivate &&
      (!user ||
          user.identityProvider !== "github" ||
          user.userId !== "df853e4c8f6849c397f13b8c3bbffdae")
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

  // --- Load photos ---
  async function fetchPhotos() {
    try {
      const res = await fetch(
          `/api/getPhotosByEvent?event=${encodeURIComponent(event)}`
      );
      const urls = await res.json();
      setPhotos(urls);
    } catch (err) {
      console.error("Error fetching photos:", err);
    }
  }

  useEffect(() => {
    fetchPhotos();
  }, [event]);

  // --- Upload photo handler ---
  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;

    try {
      const r = await fetch(
          `/api/getUploadUrl?event=${encodeURIComponent(
              event
          )}&filename=${encodeURIComponent(file.name)}`
      );
      if (!r.ok) {
        alert("Nie udało się pobrać URL-a uploadu");
        return;
      }

      const { uploadUrl } = await r.json();

      const up = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!up.ok) {
        alert("Upload nie powiódł się");
        return;
      }

      await fetchPhotos();
      setFile(null);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Błąd uploadu zdjęcia");
    }
  }

  return (
      <div className="min-h-screen bg-black text-white">
        <GlobalNavbar />
        <main className="p-6">
          <h1 className="text-3xl font-bold mb-6">
            {isPrivate ? "Private" : "Public"} Gallery: {event}
          </h1>

          {/* --- Inline uploader (private only) --- */}
          {isPrivate && (
              <form className="mb-6 flex items-center gap-3" onSubmit={handleUpload}>
                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files[0] || null)}
                    className="block text-sm"
                />
                <button
                    type="submit"
                    className="bg-white text-black px-3 py-1 rounded hover:bg-gray-200 transition"
                >
                  Dodaj zdjęcie
                </button>
              </form>
          )}

          {/* --- Photos grid --- */}
          {photos.length === 0 ? (
              <p className="text-gray-400 text-center mt-20">
                {isPrivate ? "Brak zdjęć w tym evencie." : "No photos available."}
              </p>
          ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map((url, index) => {
                  // --- Robust blobName extraction ---
                  const u = new URL(url, window.location.origin);
                  const pathname = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
                  const [, ...rest] = pathname.split("/"); // remove container segment
                  const blobName = rest.join("/"); // "event/file.jpg"

                  return (
                      <div key={index} className="relative group">
                        <img
                            src={url}
                            alt={`photo-${index}`}
                            className="rounded-lg"
                            loading="lazy"
                        />
                        {isPrivate && (
                            <button
                                onClick={async () => {
                                  const ok = window.confirm("Delete this photo?");
                                  if (!ok) return;

                                  try {
                                    const res = await fetch(
                                        `/api/deletePhoto?blobName=${encodeURIComponent(
                                            blobName
                                        )}`,
                                        { method: "DELETE" }
                                    );

                                    if (res.ok) {
                                      await fetchPhotos();
                                    } else {
                                      alert("Failed to delete photo.");
                                    }
                                  } catch (err) {
                                    console.error("Delete error:", err);
                                    alert("Error deleting photo.");
                                  }
                                }}
                                className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
                            >
                              🗑
                            </button>
                        )}
                      </div>
                  );
                })}
              </div>
          )}
        </main>
      </div>
  );
}
