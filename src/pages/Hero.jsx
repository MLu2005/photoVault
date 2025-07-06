import { Link } from "react-router-dom";
import GlobalNavbar from "../GlobalNavbar";

export default function Hero() {
  return (
    <div className="min-h-screen bg-black text-white">
      <GlobalNavbar />
      <div className="flex items-center justify-center h-[80%] px-4 text-center">
        <div>
          <h1 className="text-5xl font-bold mb-6">Hi, I am Micheal and this is my website about me</h1>
          <div className="space-x-4">
            <Link
              to="/public"
              className="bg-white text-black px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition"
            >
              Public Gallery
            </Link>
            <Link
              to="/private"
              className="bg-transparent border border-white px-6 py-3 rounded-xl font-semibold hover:bg-white hover:text-black transition"
            >
              Private Gallery
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
