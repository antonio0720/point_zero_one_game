/**
 * PatchNoteCard component for displaying in-client patch notes.
 */

import React from 'react';

type PatchNote = {
  /** Unique identifier for the patch note */
  id: string;

  /** Title of the patch note */
  title: string;

  /** Description of the changes in the patch note */
  description: string;

  /** Old value before the change */
  oldValue?: string | number | boolean;

  /** New value after the change */
  newValue?: string | number | boolean;

  /** Impact or effect of the change */
  impact: string;
};

type Props = {
  patchNote: PatchNote;
};

/**
 * PatchNoteCard component.
 *
 * @param {PatchNote} patchNote - The patch note data to be displayed.
 *
 * @returns {JSX.Element} A JSX element representing the patch note card.
 */
const PatchNoteCard: React.FC<Props> = ({ patchNote }) => (
  <div className="patch-note-card">
    <h3>{patchNote.title}</h3>
    <ul>
      {patchNote.oldValue && patchNote.newValue && (
        <>
          <li>
            Previous: {patchNote.oldValue}
          </li>
          <li>
            New: {patchNote.newValue}
          </li>
        </>
      )}
      {!patchNote.oldValue && !patchNote.newValue && (
        <li>{patchNote.description}</li>
      )}
      <li>Impact: {patchNote.impact}</li>
    </ul>
  </div>
);

export default PatchNoteCard;
