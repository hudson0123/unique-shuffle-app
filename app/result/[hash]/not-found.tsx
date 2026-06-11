import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold mb-2">Shuffle not found</h1>
      <p className="text-zinc-600 mb-6">
        We couldn&rsquo;t find a shuffle with that hash.
      </p>
      <Link href="/" className="text-zinc-900 underline">
        Submit a new shuffle
      </Link>
    </main>
  );
}
