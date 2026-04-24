import { getDoc, setDoc } from "firebase/firestore";
import {
  defaultUserSettings,
  type UserSettings,
} from "../types/userSettings";
import { userSettingsDocument } from "./firestorePaths";

const mergeDefaults = (data: Partial<UserSettings>): UserSettings => ({
  ...defaultUserSettings,
  ...data,
  autoNotifications:
    data.autoNotifications ?? defaultUserSettings.autoNotifications,
});

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const ref = userSettingsDocument(userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { ...defaultUserSettings };
  }
  return mergeDefaults(snap.data() as Partial<UserSettings>);
}

export async function setUserSettings(
  userId: string,
  partial: Partial<UserSettings>,
): Promise<void> {
  const current = await getUserSettings(userId);
  const next: UserSettings = { ...current, ...partial };
  await setDoc(userSettingsDocument(userId), next, { merge: true });
}
