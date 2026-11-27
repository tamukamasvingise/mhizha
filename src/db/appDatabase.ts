// Opens the app's own records on the phone.
import Constants from 'expo-constants';
import { getRandomBytes } from 'expo-crypto';
import { openDatabase, type OpenResult } from './database';
import { expoPlatform } from './expo';

export const appVersion = Constants.expoConfig?.version ?? '0.0.0';

export function openAppDatabase(): OpenResult {
  return openDatabase({ platform: expoPlatform(), appVersion, random: getRandomBytes });
}
