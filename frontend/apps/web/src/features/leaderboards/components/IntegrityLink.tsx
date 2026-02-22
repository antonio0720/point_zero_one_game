/**
 * IntegrityLink component for leaderboards page. Deep links to /integrity.
 */
import React from 'react';
import { Link } from 'react-router-dom';

type Props = {};

const IntegrityLink: React.FC<Props> = () => (
  <Link to="/integrity" className="text-blue-500 hover:underline">Integrity</Link>
);

export default IntegrityLink;
