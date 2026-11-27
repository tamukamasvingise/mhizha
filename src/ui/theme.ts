import { useColorScheme } from 'react-native';
import { themes, type Colours } from './tokens';

/** The colours for the phone's light or dark setting. There is no in-app switch. */
export function useColours(): Colours {
  return useColorScheme() === 'dark' ? themes.dark : themes.light;
}
