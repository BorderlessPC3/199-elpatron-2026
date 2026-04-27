import { onSnapshot, type Unsubscribe } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { userSettingsDocument } from "../services/firestorePaths";
import { getUserSettings, setUserSettings } from "../services/userSettingsService";
import { getErrorMessage } from "../utils/error";
import {
  defaultUserSettings,
  type UserSettings,
} from "../types/userSettings";
function merge(s: Partial<UserSettings> | undefined): UserSettings {
  if (!s) return { ...defaultUserSettings };
  return {
    ...defaultUserSettings,
    ...s,
  };
}

export function useUserSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) {
      setSettings(defaultUserSettings);
      setLoading(false);
      return;
    }
    setLoading(true);
    let unsub: Unsubscribe | undefined;
    const ref = userSettingsDocument(userId);
    unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setSettings(defaultUserSettings);
        } else {
          setSettings(merge(snap.data() as Partial<UserSettings>));
        }
        setLoading(false);
        setError("");
      },
      (err) => {
        setError(getErrorMessage(err, "Erro ao carregar preferências."));
        setLoading(false);
      },
    );
    return () => unsub?.();
  }, [userId]);

  const save = useCallback(
    async (partial: Partial<UserSettings>) => {
      if (!userId) return;
      try {
        setError("");
        await setUserSettings(userId, partial);
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Erro ao salvar preferências."));
      }
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const s = await getUserSettings(userId);
      setSettings(s);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Erro ao carregar"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { settings, loading, error, save, refresh };
}
