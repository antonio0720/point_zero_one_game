/**
 * MomentOverlay component for Point Zero One Digital's financial roguelike game.
 * Displays a full-screen overlay with large text of code and callout line during live game.
 */

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';

type Props = {
  /** The code to be displayed in the overlay */
  code: string;
  /** The callout line to be displayed in the overlay */
  calloutLine: string;
  /** A hint for camera angle adjustment during the moment */
  cameraAngleHint?: string;
};

const OverlayContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
`;

const Content = styled.div`
  font-size: 2rem;
  line-height: 1.5;
  text-align: center;
  max-width: 80%;
`;

const CameraAngleHint = styled.div`
  position: absolute;
  bottom: 10px;
  right: 10px;
  font-size: 1rem;
`;

/**
 * MomentOverlay component
 */
const MomentOverlay: React.FC<Props> = ({ code, calloutLine, cameraAngleHint }) => {
  const [isVisible, setIsVisible] = useState(false);

  const handleShow = () => {
    setIsVisible(true);
    setTimeout(() => setIsVisible(false), 4000);
  };

  return (
    <>
      {isVisible && (
        <OverlayContainer>
          <Content dangerouslySetInnerHTML={{ __html: `<p>${code}</p><br /><p>${calloutLine}</p>` }} />
          {cameraAngleHint && <CameraAngleHint>{cameraAngleHint}</CameraAngleHint>}
        </OverlayContainer>
      )}
    </>
  );
};

/**
 * Mount MomentOverlay to the document body when called with `ReactDOM.render`.
 */
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.render(<MomentOverlay />, rootElement);
}

export default MomentOverlay;
