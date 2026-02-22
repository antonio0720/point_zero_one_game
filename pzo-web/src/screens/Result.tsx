import React from 'react';
import { useTranslation } from 'next-export-i18n';
import { useGameContext } from '../context/GameContext';
import { useMLModel } from '../hooks/useMLModel';
import { ScoreCard, ROIChart, DrawdownChart, ProofCard, CTAButton } from '../components';

export function Result() {
  const { t } = useTranslation();
  const gameContext = useGameContext();
  const mlModel = useMLModel();

  if (!gameContext || !mlModel) return null;

  const score = mlModel.score;
  const roi = mlModel.ROI;
  const drawdown = mlModel.drawdown;
  const moment1 = mlModel.moment1;
  const moment2 = mlModel.moment2;
  const moment3 = mlModel.moment3;
  const auditHash = mlModel.auditHash;

  return (
    <div className="result-screen">
      <ScoreCard score={score} />
      <ROIChart roi={roi} />
      <DrawdownChart drawdown={drawdown} />
      <ProofCard moment1={moment1} moment2={moment2} moment3={moment3} auditHash={auditHash} />
      <CTAButton />
    </div>
  );
}

export default Result;
