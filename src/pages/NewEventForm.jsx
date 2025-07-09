import { useState } from "react";

export default function NewEventForm() {
  const [eventName, setEventName] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    if (!eventName || !file) {
      setStatus("⚠️ Provide folder name and image.");
      return;
    }

    setStatus("⏳ Getting upload URL...");

    try {
      const res = await fetch(`/api/getUploadUrl?event=${eventName}&filename=${encodeURIComponent(file.name)}`);
      if (!res.ok) throw new Error("Could not get upload URL");

      const { uploadUrl, blobName } = await res.json();

      setStatus("⏳ Uploading...");

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "Content-Type": file.type
        },
        body: file
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      setStatus("✅ Uploaded: " + blobName);

      // Redirect after success
      setTimeout(() => {
        window.location.href = `/private/${eventName}`;
      }, 1000);
    } catch (err) {
      console.error(err);
      setStatus("❌ Error during upload.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white bg-opacity-10 p-4 rounded-xl">
      <h2 className="text-lg font-semibold mb-2 text-white">➕ Add New Event</h2>
      <p className="text-sm text-gray-300 mb-2 italic">
        You must upload at least one image to create a folder in Azure.
      </p>
      <input
        type="text"
        placeholder="Event name (e.g., Rome2025)"
        value={eventName}
        onChange={(e) => setEventName(e.target.value)}
        className="block w-full mb-2 p-2 rounded bg-black border border-gray-600 text-white"
      />
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files[0])}
        className="block w-full mb-2 text-white"
      />
      <button
        type="submit"
        className="bg-white text-black px-4 py-1 rounded hover:bg-gray-200 transition"
      >
        Upload
      </button>
      {status && <p className="text-sm mt-2 text-white">{status}</p>}
    </form>
  );
}
