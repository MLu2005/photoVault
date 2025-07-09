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

    const formData = new FormData();
    formData.append("event", event);
    formData.append("file", file);

    setStatus("uploading");

    try {
      const res = await fetch("/api/uploadPhoto", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setStatus("success");
        setEvent("");
        setFile(null);
        e.target.reset(); // czyści formularz
      } else {
        const text = await res.text();
        console.error("Upload failed:", text);
        setStatus("error");
      }
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
      {status === "uploading" && (
        <p className="text-blue-300">Uploading...</p>
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
