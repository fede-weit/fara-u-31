export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <p>&copy; {year} fara u. 31. School project.</p>
    </footer>
  );
}

