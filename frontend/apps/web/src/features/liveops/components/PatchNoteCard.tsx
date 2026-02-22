/**
 * PatchNoteCard component for displaying patch notes in Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type Props = {
  /** The unique identifier of the patch note. */
  id: string;

  /** The title or heading of the patch note. */
  title: string;

  /** A brief description of the changes made in this patch note. */
  description: string;

  /** The reason for the changes made in this patch note. */
  reason: string;

  /** A call-to-action button to replay or try again after applying the patch. */
  cta: JSX.Element;
};

const PatchNoteCard: React.FC<Props> = ({ id, title, description, reason, cta }) => {
  return (
    <div className="patch-note-card">
      <h2>{title}</h2>
      <p>{description}</p>
      <p><strong>Why:</strong> {reason}</p>
      {cta}
    </div>
  );
};

export default PatchNoteCard;
