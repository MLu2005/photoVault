export default function UploadForm() {
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <h3>Dodaj zdjęcie</h3>
      <input type="file" accept="image/*" />
      <br />
      <input type="text" placeholder="Opis" />
      <br />
      <button type="submit">Wyślij</button>
    </form>
  );
}