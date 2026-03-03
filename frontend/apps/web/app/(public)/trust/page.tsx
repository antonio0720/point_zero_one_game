'use client';
import React from 'react';
import Link from 'next/link';

export default function TrustPage() {
  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold mb-6">Our Commitment to Trust</h1>
      <p className="text-gray-400 mb-4">
        Every transaction is encrypted, server-verified, and audited for integrity before it is recorded.
      </p>
      <p className="text-gray-400 mb-8">
        All run outcomes are deterministic and provably fair — seeded at start, replayed at end, stamped with a cryptographic proof card you own forever.
      </p>
      <Link href="/integrity" className="inline-block bg-white text-black font-semibold px-6 py-2.5 rounded-lg hover:bg-gray-200 transition">
        Visit Integrity Page →
      </Link>
    </main>
  );
}
