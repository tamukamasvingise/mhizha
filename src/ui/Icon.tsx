import Svg, { Circle, Path } from 'react-native-svg';
import { size } from './tokens';

// Lucide-style outline icons from the Main screens prototype: viewBox 24,
// stroke 2, round caps and joins. Icons are decoration: the control that holds
// one carries the accessible name.

export type IconName = 'home' | 'people' | 'doc' | 'wallet' | 'plus' | 'back' | 'gear' | 'close';

const paths: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <Path d="M3 10.5 12 3l9 7.5" />
      <Path d="M5 9.5V21h14V9.5" />
      <Path d="M10 21v-6h4v6" />
    </>
  ),
  people: (
    <>
      <Circle cx="9" cy="8" r="3.5" />
      <Path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <Path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.5 3.6 5.2" />
    </>
  ),
  doc: (
    <>
      <Path d="M6 3h8l5 5v13H6z" />
      <Path d="M14 3v5h5M9 13h7M9 17h5" />
    </>
  ),
  wallet: (
    <>
      <Path d="M3 7a2 2 0 0 1 2-2h13v4" />
      <Path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z" />
      <Circle cx="16" cy="14.5" r="1.2" />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  back: <Path d="M15 5l-7 7 7 7" />,
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  gear: (
    <>
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
};

export function Icon({ name, colour, px = size.icon }: { name: IconName; colour: string; px?: number }) {
  return (
    <Svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colour}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {paths[name]}
    </Svg>
  );
}

/** The Mhizha mark: a house outline in the brand colour. */
export function Mark({ colour }: { colour: string }) {
  return (
    <Svg
      width={size.mark}
      height={size.mark}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colour}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Path d="M3 20h18" />
      <Path d="M5 20V10l7-6 7 6v10" />
      <Path d="M9.5 20v-5h5v5" />
    </Svg>
  );
}
