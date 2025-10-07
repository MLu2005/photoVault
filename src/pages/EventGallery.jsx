import { useParams, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import useAuth from "../hooks/useAuth";
import GlobalNavbar from "../GlobalNavbar";

export default function EventGallery({ isPrivate }) {
  const { event } = useParams();
  const location = useLocation();
  const user = useAuth();

  // Jeśli prop nie został przekazany, rozpoznaj po ścieżce URL
  const isPrivateView =
      typeof isPrivate === "boolean" ? isPrivate : location.pathname.startsWith("/private");

  const [photos, setPhotos] = useState([]);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | uploading | deleting | error

  async function loadPhotos() {
    try {
      setStatus("loading");
      const res = await fetch(`/api/getPhotosByEvent?event=${encodeURIComponent(event)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const urls = await res.json();
      setPhotos(urls);
      setStatus("idle");
    } catch (err) {
      console.error("❌ Error fetching photos:", err);
      setStatus("error");
    }
  }

  useEffect(() => {
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  // W prywatnym widoku pokaż ekran "Checking login..." dopóki SWA nie zwróci usera
  if (isPrivateView && user === null) {
    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-lg text-gray-300 animate-pulse">Checking login...</p>
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-black text-white">
        <GlobalNavbar />
        <main className="p-6">
          <h1 className="text-3xl font-bold mb-6">
            {isPrivateView ? "Private" : "Public"} Gallery: {event}
          </h1>

          {/* Mini-uploader dostępny tylko w prywatnym widoku */}
          {isPrivateView && (
              <form
                  className="mb-6 flex items-center gap-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!file) return;
                    try {
                      setStatus("uploading");
                      // 1) poproś o SAS do uploadu dla tego eventu
                      const r = await fetch(
                          `/api/getUploadUrl?event=${encodeURIComponent(event)}&filename=${encodeURIComponent(file.name)}`
                      );
                      if (!r.ok) throw new Error(`getUploadUrl HTTP ${r.status}`);
                      const { uploadUrl } = await r.json();

                      // 2) wrzuć plik do Bloba
                      const up = await fetch(uploadUrl, {
                        method: "PUT",
                        headers: {
                          "x-ms-blob-type": "BlockBlob",
                          "Content-Type": file.type || "application/octet-stream",
                        },
                        body: file,
                      });
                      if (!up.ok) throw new Error(`upload HTTP ${up.status}`);

                      setFile(null);
                      await loadPhotos(); // 3) świeże SAS-y z serwera
                      setStatus("idle");
                    } catch (err) {
                      console.error("❌ Upload error:", err);
                      setStatus("error");
                      alert("Błąd uploadu zdjęcia");
                    }
                  }}
              >
                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block text-sm"
                />
                <button
                    type="submit"
                    className="bg-white text-black px-3 py-1 rounded hover:bg-gray-200 transition"
                    disabled={status === "uploading"}
                >
                  {status === "uploading" ? "Wgrywanie..." : "Dodaj zdjęcie"}
                </button>
              </form>
          )}

          {/* Siatka zdjęć */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {photos.map((url, index) => {
              // Robust: wylicz blobName z URL, niezależnie od hosta/CDN
              // np. https://<acct>.blob.core.windows.net/fullsize/event/file.jpg?... -> event/file.jpg
              let blobName = "";
              try {
                const u = new URL(url);
                const pathname = decodeURIComponent(u.pathname); // /fullsize/event/file.jpg
                blobName = pathname.replace(/^\/?fullsize\//, ""); // event/file.jpg
              } catch {
                // fallback – w mało prawdopodobnym razie, gdy URL jest względny
                const noQuery = url.split("?")[0];
                const afterContainer = noQuery.split("/").slice(4).join("/");
                blobName = decodeURIComponent(afterContainer);
              }

              return (
                  <div key={index} className="relative group">
                    <img
                        src={url}
                        alt={`photo-${index}`}
                        className="rounded-lg"
                        loading="lazy"
                    />

                    {/* Kasowanie dostępne tylko w prywatnym widoku */}
                    {isPrivateView && (
                        <button
                            onClick={async () => {
                              const ok = window.confirm("Delete this photo?");
                              if (!ok) return;
                              try {
                                setStatus("deleting");
                                const res = await fetch(
                                    `/api/deletePhoto?blobName=${encodeURIComponent(blobName)}`,
                                    { method: "DELETE" }
                                );
                                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                await loadPhotos(); // odśwież po usunięciu
                                setStatus("idle");
                              } catch (err) {
                                console.error("❌ Delete error:", err);
                                setStatus("error");
                                alert("Error deleting photo.");
                              }
                            }}
                            // zawsze widoczny (nie tylko na :hover), żeby nie „znikał” na mobile
                            className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded transition"
                            title="Delete photo"
                        >
                          🗑
                        </button>
                    )}
                  </div>
              );
            })}
          </div>

          {/* status / błędy */}
          {status === "loading" && (
              <p className="mt-4 text-sm text-gray-300">Ładowanie zdjęć…</p>
          )}
          {status === "error" && (
              <p className="mt-4 text-sm text-red-400">
                Coś poszło nie tak. Sprawdź konsolę przeglądarki.
              </p>
          )}

          {/* Nawigacja powrotna */}
          <div className="mt-8">
            <Link
                to={isPrivateView ? "/private" : "/public"}
                className="inline-block border border-white px-6 py-2 rounded-xl font-semibold hover:bg-white hover:text-black transition"
            >
              Return to Homepage
            </Link>
          </div>
        </main>
      </div>
  );
}
