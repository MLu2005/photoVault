import { useEffect, useState } from "react";

export default function useAuth() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/.auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.clientPrincipal) {
          setUser(data.clientPrincipal);
        }
      })
      .catch((err) => {
        console.error("Auth check failed", err);
      });
  }, []);

  return user;
}
