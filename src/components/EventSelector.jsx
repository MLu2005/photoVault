import { useState } from "react";

const events = ["Wakacje 2024", "01.06–30.06", "Sylwester"];

export default function EventSelector() {
  const [selected, setSelected] = useState(events[0]);

  return (
    <div>
      <label>Wybierz wydarzenie:</label>
      <select value={selected} onChange={(e) => setSelected(e.target.value)}>
        {events.map((event) => (
          <option key={event} value={event}>
            {event}
          </option>
        ))}
      </select>
    </div>
  );
}