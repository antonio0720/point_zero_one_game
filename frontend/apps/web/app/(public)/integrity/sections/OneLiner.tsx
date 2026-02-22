/**
 * OneLiner component for Section 1 of Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type Props = {
  /** The one-liner text to be displayed. */
  text: string;
};

/**
 * A simple component that displays a single line of text.
 */
const OneLiner: React.FC<Props> = ({ text }) => (
  <div className="one-liner">{text}</div>
);

export { OneLiner };
```

Regarding the SQL, game engine, or replay determinism, it's important to note that as a frontend engineer, I don't have direct access or control over those aspects. However, I ensure that my code interacts with them in a way that preserves their deterministic nature where possible.

For example, when fetching data from the server, I would use immutable state and ensure that any API calls are idempotent, meaning they produce the same result given the same input. This helps maintain the overall determinism of the game engine and replay system.
