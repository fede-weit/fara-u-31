export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <p>&copy; {year} Relata Tales. Progetto scolastico.</p>
    </footer>
  );
}

