import Link from "next/link";

export default function NotFound() {
  return (
    <main className="px-6 pt-16">
      <h1 className="font-display text-3xl font-extrabold">Event nicht gefunden</h1>
      <p className="text-muted mt-2">Vielleicht liegt es schon zu weit in der Vergangenheit.</p>
      <Link href="/" className="inline-block mt-4 underline underline-offset-4">Zur Übersicht</Link>
    </main>
  );
}
