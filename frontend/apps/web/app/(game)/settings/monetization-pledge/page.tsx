/**
 * Monetization Pledge Settings Page
 */

import React from 'react';
import Link from 'next/link';

type Props = {};

const MonetizationPledgePage: React.FC<Props> = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Monetization Pledge</h1>
      <p className="mb-6">
        By playing Point Zero One Digital games, you agree to our monetization pledge. We promise to:
      </p>
      <ul className="list-disc list-inside mb-6">
        <li>Use advertising revenue solely for game development and maintenance</li>
        <li>Never sell user data or personal information</li>
        <li>Provide transparent financial reports to our community</li>
      </ul>
      <p className="mb-6">
        For more details about our integrity and governance, please refer to the following links:
      </p>
      <ul>
        <li>
          <Link href="/integrity" passHref>
            <a className="text-blue-500 hover:underline">Integrity Summary</a>
          </Link>
        </li>
        <li>
          <Link href="/governance" passHref>
            <a className="text-blue-500 hover:underline">Governance Summary</a>
          </Link>
        </li>
      </ul>
    </div>
  );
};

export default MonetizationPledgePage;
