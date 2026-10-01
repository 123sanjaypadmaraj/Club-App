import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm opacity-70">That page doesn&apos;t exist, or it&apos;s no longer available.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/" className="btn btn-primary">Home</Link>
        <Link href="/events" className="btn">Browse events</Link>
      </div>
    </div>
  );
}
