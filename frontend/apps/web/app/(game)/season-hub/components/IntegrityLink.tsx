/**
 * IntegrityLink component for Season Hub in Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type Props = {
  /**
   * Callback function to navigate to the Integrity page.
   */
  onClick: () => void;
};

/**
 * IntegrityLink component that renders a link to the Integrity page.
 *
 * @param props - Props object containing the callback function for navigation.
 */
const IntegrityLink: React.FC<Props> = ({ onClick }) => (
  <a href="#" onClick={onClick}>This season’s ladder rules → Integrity</a>
);

export { IntegrityLink };
