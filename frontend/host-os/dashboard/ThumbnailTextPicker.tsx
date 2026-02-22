/**
 * ThumbnailTextPicker component for displaying and copying thumbnail text options from a CSV file.
 */

import React, { useState } from 'react';
import csvParser from 'csv-parser';
import fs from 'fs';
import ClipboardJS from 'clipboardjs';

type ThumbnailText = {
  id: number;
  text: string;
};

interface Props {}

const ThumbnailTextPicker: React.FC<Props> = () => {
  const [thumbnailTexts, setThumbnailTexts] = useState<ThumbnailText[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleData = (data: ThumbnailText[]) => {
    setThumbnailTexts(data);
    setIsLoading(false);
  };

  const loadThumbnailTexts = () => {
    fs.createReadStream('thumbnail_text.csv').pipe(csvParser()).on('data', handleData);
  };

  const copyToClipboard = (id: number) => {
    const text = thumbnailTexts.find((t) => t.id === id)?.text || '';
    new ClipboardJS('.copy-button').on('success', () => {
      alert(`Copied ${text} to clipboard!`);
    });
  };

  React.useEffect(() => {
    loadThumbnailTexts();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const thumbnailTextOptions = thumbnailTexts.slice(0, 3).map(({ id, text }) => (
    <div key={id}>
      <p>{text}</p>
      <button className="copy-button" data-clipboard-text={text} onClick={() => copyToClipboard(id)}>
        Copy
      </button>
    </div>
  ));

  return (
    <div>
      {thumbnailTextOptions.length > 0 ? (
        thumbnailTextOptions
      ) : (
        <div>No thumbnail text options found.</div>
      )}
    </div>
  );
};

export default ThumbnailTextPicker;
