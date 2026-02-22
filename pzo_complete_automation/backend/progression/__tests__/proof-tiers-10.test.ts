import { createMockInstance } from '@jest-mock/react';
import { ProofTier10 } from '../../proof-tiers/ProofTier10';
import { ProofType } from '../../../types/achievements';
import { useAchievements } from '../../../../hooks/useAchievements';
import { Achievement } from '../../../types/achievements';
import { mockAchievementsData } from '../../../__mocks__/mock-data';

jest.mock('../../../../hooks/useAchievements');

describe('ProofTier10', () => {
const mockUseAchievements = useAchievements as jest.Mock;

beforeEach(() => {
mockUseAchievements.mockReturnValue({
achievements: mockAchievementsData,
loadAchievements: jest.fn(),
});
});

it('renders correctly with no progress', () => {
const { container } = render(<ProofTier10 proofType={ProofType.BASIC} />);
expect(container).toMatchSnapshot();
});

it('renders correctly with basic proof progress', () => {
const mockAchievements: Achievement[] = [
// Add sample achievement data with basic proof progress
];
mockUseAchievements.mockReturnValue({
achievements: mockAchievements,
loadAchievements: jest.fn(),
});

const { container } = render(<ProofTier10 proofType={ProofType.BASIC} />);
expect(container).toMatchSnapshot();
});

it('renders correctly with intermediate proof progress', () => {
const mockAchievements: Achievement[] = [
// Add sample achievement data with intermediate proof progress
];
mockUseAchievements.mockReturnValue({
achievements: mockAchievements,
loadAchievements: jest.fn(),
});

const { container } = render(<ProofTier10 proofType={ProofType.INTERMEDIATE} />);
expect(container).toMatchSnapshot();
});

it('renders correctly with expert proof progress', () => {
const mockAchievements: Achievement[] = [
// Add sample achievement data with expert proof progress
];
mockUseAchievements.mockReturnValue({
achievements: mockAchievements,
loadAchievements: jest.fn(),
});

const { container } = render(<ProofTier10 proofType={ProofType.EXPERT} />);
expect(container).toMatchSnapshot();
});
});
