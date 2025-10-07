import { BrowserRouter, Routes, Route } from "react-router-dom";
import Hero from "./pages/Hero";
import PublicLayout from "./pages/PublicLayout";
import PrivateLayout from "./pages/PrivateLayout";
import EventGallery from "./pages/EventGallery";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="/public" element={<PublicLayout />} />
          <Route path="/public/:event" element={<EventGallery isPrivate={false} />} />
          <Route path="/private/:event" element={<EventGallery isPrivate={true}  />} />
          <Route path="/private" element={<PrivateLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
