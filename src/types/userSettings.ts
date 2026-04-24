export interface UserSettings {
  autoNotifications: boolean;
  /** Número padrão para lembretes (formato E.164 ou local, conforme integração) */
  defaultWhatsappNumber?: string;
}

export const defaultUserSettings: UserSettings = {
  autoNotifications: false,
  defaultWhatsappNumber: "",
};
