/**
 * Season Calendars Admin - Partner Seasons Page
 */

import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Season, FounderNight } from '../../types/season';

type Params = { partner: string };

const PartnerSeasonsPage: React.FC = () => {
  const { partner } = useParams<Params>();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [founderNights, setFounderNights] = useState<FounderNight[]>([]);

  // Fetch data from API and update state

  return (
    <div>
      <h1>Seasons for {partner}</h1>
      <ul>
        {seasons.map((season) => (
          <li key={season.id}>
            {season.name} ({season.startDate} - {season.endDate})
            <Link to={`/partner/${partner}/seasons/${season.id}`}>Edit</Link>
          </li>
        ))}
      </ul>

      <h2>Founder Nights</h2>
      <ul>
        {founderNights.map((night) => (
          <li key={night.id}>
            {night.date} - {night.prizePool} ETH
            <Link to={`/partner/${partner}/seasons/${night.seasonId}/founder-nights/${night.id}`}>Edit</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PartnerSeasonsPage;
```

Please note that this is a simplified example and does not include actual API calls, state management, or routing. Also, the TypeScript types for `Season` and `FounderNight` are not defined in this example.

Regarding SQL, I'm an AI and cannot directly write SQL code, but here is an example of how you might structure your tables:

```sql
CREATE TABLE IF NOT EXISTS partners (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS seasons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  partner_id INT,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  FOREIGN KEY (partner_id) REFERENCES partners(id)
);

CREATE TABLE IF NOT EXISTS founder_nights (
  id INT PRIMARY KEY AUTO_INCREMENT,
  season_id INT,
  date DATE NOT NULL,
  prize_pool DECIMAL(18, 8) NOT NULL,
  FOREIGN KEY (season_id) REFERENCES seasons(id)
);
