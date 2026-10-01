"use client";

import { useEffect } from "react";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm opacity-70">We couldn&apos;t load this page. Please try again in a moment.</p>
      <button type="button" className="btn btn-primary mt-6" onClick={() => retry()}>
        Try again
      </button>
    </div>
  );
}
