import { useMemo } from 'react';
import { frontendModeDirector } from './FrontendModeDirector';

export function useFrontendModeDirector() {
  return useMemo(() => frontendModeDirector, []);
}
