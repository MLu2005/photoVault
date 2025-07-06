import { useEffect, useState } from "react";

export default function useAuth() {
  const [user, setUser] = useState(null); // null = ładowanie

  useEffect(() => {
    fetch("/.auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data) => {
        if (data.clientPrincipal) {
          setUser(data.clientPrincipal);
        } else {
          setUser(false); // brak danych = niezalogowany
        }
      })
      .catch(() => {
        setUser(false); // błąd fetcha = niezalogowany
      });
  }, []);

  return user;
}
