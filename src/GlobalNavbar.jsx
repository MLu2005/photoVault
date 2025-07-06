import useAuth from "./hooks/useAuth";

export default function GlobalNavbar() {
  const user = useAuth();

  return (
    <nav className="bg-white bg-opacity-10 text-white px-6 py-4 mb-6 rounded-xl flex justify-between">
      <div>📸 Photo Vault</div>
      <div className="space-x-4">
        {user ? (
          <>
            <span className="italic">Hi, {user.userDetails?.name || "user"}</span>
            <a href="/.auth/logout" className="hover:underline">Logout</a>
          </>
        ) : (
          <>
            <a
              href={`/.auth/login/github?post_login_redirect_uri=${window.location.pathname}`}
              className="hover:underline"
            >
              Login with GitHub
            </a>
            <a
              href={`/.auth/login/aad?post_login_redirect_uri=${window.location.pathname}`}
              className="hover:underline"
            >
              Login with Microsoft
            </a>
          </>
        )}
      </div>
    </nav>
  );
}
