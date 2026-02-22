/**
 * ProofGallery component for displaying proof cards minted gallery with stamp badges and tap-to-verify authenticity panel.
 */

import React, { useState } from 'react';
import { Card, Button, Image } from 'react-bootstrap';
import QRCode from 'qrcode.react';
import { useTranslation } from 'react-i18next';

interface ProofCardProps {
  proofId: string;
  imageUrl: string;
  stampUrl: string;
  verificationUrl: string;
}

const ProofCard: React.FC<ProofCardProps> = ({ proofId, imageUrl, stampUrl, verificationUrl }) => {
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifyClick = () => {
    setIsVerifying(true);
    // Implement the logic to verify the proof here.
    // Once verified, navigate to a new page or show a success message.
  };

  return (
    <Card>
      <Card.Body>
        <Card.Title>{proofId}</Card.Title>
        <Image src={imageUrl} alt="Proof Image" />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Image src={stampUrl} alt="Stamp" />
          <Button variant="primary" onClick={handleVerifyClick} disabled={isVerifying}>
            {isVerifying ? 'Verifying...' : 'Verify'}
          </Button>
        </div>
      </Card.Body>
      {isVerifying && <QRCode value={verificationUrl} />}
    </Card>
  );
};

export default ProofCard;
