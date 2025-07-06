import useAuth from "./hooks/useAuth";

export default function PrivateNavbar() {
  const user = useAuth();

  return (
    <nav className="bg-white bg-opacity-10 text-white px-6 py-4 mb-6 rounded-xl flex justify-between">
      <div>Private Section</div>
      <div className="space-x-4">
        {user ? (
          <>
            <span className="italic">Hi, {user.userDetails}</span>
            <a href="/.auth/logout" className="hover:underline">Logout</a>
          </>
        ) : (
          <a href="/.auth/login/github" className="hover:underline">Login</a>
        )}
      </div>
    </nav>
  );
}
