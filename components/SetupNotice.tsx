export function SetupNotice() {
  return (
    <div className="m-4 rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-xl font-bold mb-2">Datenbank noch nicht verbunden</h2>
      <p className="text-muted">
        Verbinde in Vercel unter „Storage“ deine Neon-Datenbank mit diesem Projekt und stelle die App danach neu bereit.
        Die Tabellen legt die App beim ersten Aufruf selbst an.
      </p>
    </div>
  );
}
