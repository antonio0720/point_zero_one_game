import React from 'react';
import { connect } from 'react-redux';
import { Dispatch } from 'redux';
import { AppState } from '../store';
import { setOnboardingStep } from '../actions/onboardingActions';
import { Button, Text } from '@ui-kitten/components';

interface MapStateToProps {
onboardingStep: number;
}

const mapStateToProps = (state: AppState): MapStateToProps => ({
onboardingStep: state.onboarding.step,
});

interface DispatchProps {
setOnboardingStep: typeof setOnboardingStep;
}

type Props = Readonly<ReturnType<typeof mapStateToProps>> & Readonly<DispatchProps>;

const ProgressiveDisclosure4: React.FC<Props> = ({ onboardingStep, setOnboardingStep }) => {
const handleNextClick = () => {
if (onboardingStep === 4) {
setOnboardingStep(5);
}
};

return (
<>
<Text category="h6">Progressive Disclosure Step 4</Text>
<Text style={{ marginTop: 10 }}>Welcome to the fourth step of our onboarding process.</Text>
<Button style={{ marginTop: 20 }} onPress={handleNextClick}>
Next
</Button>
</>
);
};

const connectedProgressiveDisclosure4 = connect(mapStateToProps, { setOnboardingStep })(ProgressiveDisclosure4);
export default connectedProgressiveDisclosure4;
