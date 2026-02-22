/**
 * NightHistory component for displaying a table of past nights in Point Zero One Digital's financial roguelike game.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { Link } from 'react-router-dom';

type Night = {
  date: string;
  momentsCaptured: number;
  clipsPosted: number;
  nextDateBooked?: string | null;
};

type Props = {
  nights: Array<Night>;
};

const NightHistory: React.FC<Props> = ({ nights }) => {
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('asc');

  const sortedNights = [...nights].sort((a, b) => {
    const comparison = compare(a[sortColumn], b[sortColumn]);

    return sortDirection === 'desc' ? -comparison : comparison;
  });

  const handleSortClick = (column: keyof Night) => () => {
    setSortColumn(column);
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };

  return (
    <table>
      <thead>
        <tr>
          <th onClick={handleSortClick('date')}>Date</th>
          <th onClick={handleSortClick('momentsCaptured')}>Moments Captured</th>
          <th onClick={handleSortClick('clipsPosted')}>Clips Posted</th>
          {nights.some(night => night.nextDateBooked) && (
            <th>Next Date Booked</th>
          )}
        </tr>
      </thead>
      <tbody>
        {sortedNights.map((night, index) => (
          <tr key={index}>
            <td>{moment(night.date).format('YYYY-MM-DD')}</td>
            <td>{night.momentsCaptured}</td>
            <td>{night.clipsPosted}</td>
            {night.nextDateBooked && (
              <td>
                <Link to={`/dashboard/moment-log/${encodeURIComponent(
                  night.nextDateBooked
                )}`}>{night.nextDateBooked}</Link>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const compare = (a: any, b: any) => {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b);
  }

  return a < b ? -1 : (a > b ? 1 : 0);
};

NightHistory.propTypes = {
  nights: PropTypes.arrayOf(PropTypes.shape({
    date: PropTypes.string.isRequired,
    momentsCaptured: PropTypes.number.isRequired,
    clipsPosted: PropTypes.number.isRequired,
    nextDateBooked: PropTypes.string,
  })).isRequired,
};

export default NightHistory;
