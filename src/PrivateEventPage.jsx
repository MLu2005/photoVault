import { useParams } from "react-router-dom";

export default function PrivateEventPage() {
  const { eventName } = useParams();

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold">Event: {eventName}</h1>
      <p>Tu w przyszłości pojawią się zdjęcia z kontenera Azure.</p>
    </div>
  );
}
