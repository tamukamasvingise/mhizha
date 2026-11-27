// The App lock uses the phone's own screen lock (fingerprint, face, PIN,
// pattern or password). Mhizha has no password of its own.
import * as LocalAuthentication from 'expo-local-authentication';

/** True if the phone has a screen lock set. */
export async function phoneHasLock(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Asks for the phone's lock. True when the User unlocked. */
export async function unlockWithPhone(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Mhizha' });
    return r.success;
  } catch {
    return false;
  }
}
