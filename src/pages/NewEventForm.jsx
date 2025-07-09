import { useState } from "react";

export default function NewEventForm({ onUpload }) {
  const [eventName, setEventName] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!eventName || !file) {
      setStatus("Please provide folder name and image.");
      return;
    }

    setStatus("Uploading...");

    const formData = new FormData();
    formData.append("event", eventName);
    formData.append("file", file);

    try {
      const res = await fetch("/api/uploadPhoto", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setStatus("✅ Uploaded: " + data.blobName);
      setEventName("");
      setFile(null);
      onUpload(); // odśwież listę folderów jeśli potrzeba
    } catch (err) {
      setStatus("❌ Error uploading photo");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 bg-white bg-opacity-10 p-6 rounded-xl text-white"
    >
      <h2 className="text-xl font-bold mb-4">➕ Add New Folder + Photo</h2>
      <p className="text-sm text-gray-300 mb-2 italic">
        The folder will only exist after at least one photo is uploaded.
      </p>
      <input
        type="text"
        placeholder="Folder name (e.g., Belgium)"
        value={eventName}
        onChange={(e) => setEventName(e.target.value)}
        className="block w-full mb-3 p-2 rounded bg-black border border-gray-600"
      />
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files[0])}
        className="block mb-3"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-white text-black rounded hover:bg-gray-200"
      >
        Upload
      </button>
      {status && <p className="mt-2 text-sm">{status}</p>}
    </form>
  );
}
