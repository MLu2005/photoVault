import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-black bg-opacity-60 text-white">
      <h1 className="text-4xl font-bold mb-6">Welcome to Photo Vault</h1>
      <div className="space-x-6">
        <Link to="/public" className="px-6 py-3 bg-blue-500 rounded hover:bg-blue-600">Public Gallery</Link>
        <Link to="/private" className="px-6 py-3 bg-purple-500 rounded hover:bg-purple-600">Private Gallery</Link>
      </div>
    </div>
  );
}