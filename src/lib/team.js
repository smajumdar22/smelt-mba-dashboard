import { createContext, useContext } from 'react';
import { TEAMS } from './constants';

export const TeamContext = createContext(TEAMS[0]);

// Active team: { id, name, members }
export function useTeam() {
  return useContext(TeamContext);
}
