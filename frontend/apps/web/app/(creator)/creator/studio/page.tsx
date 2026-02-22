/**
 * Creator Studio 6-screen flow: Create → Build (scenario DSL editor) → Preview (sim widget + budget meters) → Package → Submit → Track (pipeline + fix checklist)
 */

import React, { useState } from 'react';
import ScenarioDslEditor from './ScenarioDslEditor';
import SimWidget from './SimWidget';
import BudgetMeters from './BudgetMeters';
import PackageButton from './PackageButton';
import SubmitButton from './SubmitButton';
import TrackPipeline from './TrackPipeline';
import FixChecklist from './FixChecklist';

type Props = {};

const CreatorStudioPage: React.FC<Props> = () => {
  const [currentScreen, setCurrentScreen] = useState(0);

  const handleNextScreen = () => {
    setCurrentScreen((prevScreen) => prevScreen + 1);
  };

  // ... (other screen handling functions)

  return (
    <div>
      {currentScreen === 0 && <ScenarioDslEditor onNext={handleNextScreen} />}
      {currentScreen === 1 && <SimWidget />}
      {currentScreen === 2 && <BudgetMeters />}
      {currentScreen === 3 && <PackageButton onSubmit={() => setCurrentScreen(4)} />}
      {currentScreen === 4 && <SubmitButton />}
      {currentScreen === 5 && <TrackPipeline />}
      {currentScreen === 6 && <FixChecklist />}
    </div>
  );
};

export default CreatorStudioPage;
