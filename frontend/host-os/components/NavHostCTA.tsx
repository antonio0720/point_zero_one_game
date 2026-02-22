/**
 * NavHostCTA component for Point Zero One Digital's financial roguelike game.
 * Displays a sticky nav bar with a 'Host a Night' link that navigates to /host.
 * Appears on all game pages after the user plays the first run.
 */

import React, { useEffect } from 'react';
import { Link } from 'gatsby';
import { useLocation } from '@reach/router';

interface Props {}

const NavHostCTA: React.FC<Props> = () => {
  const location = useLocation();
  const isGamePage = /\/game/.test(location.pathname);
  const hasPlayedFirstRun = localStorage.getItem('firstRun') === 'true';

  useEffect(() => {
    if (isGamePage && hasPlayedFirstRun) {
      localStorage.setItem('hasSeenNav', 'true');
    }
  }, [isGamePage, hasPlayedFirstRun]);

  return (
    <nav className="sticky top-0 z-10 bg-black text-white">
      {localStorage.getItem('hasSeenNav') === 'true' ? null : (
        <div className="container mx-auto px-4 py-2">
          <Link to="/host" className="text-lg font-bold no-underline hover:underline">
            Host a Night
          </Link>
        </div>
      )}
    </nav>
  );
};

export default NavHostCTA;
