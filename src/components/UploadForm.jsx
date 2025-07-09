import { useState } from "react";

export default function UploadForm() {
  const [event, setEvent] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!event || !file) {
      setStatus("missing");
      return;
    }

    setStatus("getting-url");

    try {
      // 1. Pobierz tymczasowy upload URL (SAS)
      const res = await fetch(`/api/getUploadUrl?event=${event}&filename=${encodeURIComponent(file.name)}`);
      if (!res.ok) throw new Error("Could not get upload URL");

      const { uploadUrl, blobName } = await res.json();

      // 2. Upload bezpośrednio do Azure Blob Storage
      setStatus("uploading");
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "Content-Type": file.type
        },
        body: file
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      setStatus("success");
      setEvent("");
      setFile(null);
      e.target.reset();

      // 3. (Opcjonalnie) przekierowanie po uploadzie
      setTimeout(() => {
        window.location.href = `/private/${event}`;
      }, 1000);

    } catch (err) {
      console.error("Upload error:", err);
      setStatus("error");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white bg-opacity-10 p-6 rounded-xl mt-8 text-white space-y-4"
    >
      <h2 className="text-2xl font-bold">Create new event</h2>

      <div>
        <label className="block mb-1">Event name (folder):</label>
        <input
          type="text"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          className="w-full px-4 py-2 rounded bg-black bg-opacity-30 border border-white"
          placeholder="e.g. Summer2024"
        />
      </div>

      <div>
        <label className="block mb-1">Select photo:</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0])}
          className="text-white"
        />
      </div>

      <button
        type="submit"
        className="bg-white text-black px-6 py-2 rounded-xl font-semibold hover:bg-gray-300 transition"
      >
        Upload
      </button>

      {/* Status */}
      {status === "missing" && (
        <p className="text-yellow-400">Please provide both event name and photo.</p>
      )}
      {status === "getting-url" && (
        <p className="text-blue-300">Requesting upload URL...</p>
      )}
      {status === "uploading" && (
        <p className="text-blue-300">Uploading photo...</p>
      )}
      {status === "success" && (
        <p className="text-green-400">Upload successful! 🎉</p>
      )}
      {status === "error" && (
        <p className="text-red-400">Upload failed. See console for details.</p>
      )}
    </form>
  );
}
