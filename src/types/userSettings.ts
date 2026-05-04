export interface UserSettings {
  autoNotifications: boolean;
  /** Número padrão para lembretes (formato E.164 ou local, conforme integração) */
  defaultWhatsappNumber?: string;
  /** Número usado na tela Notificações para testar envios manuais de WhatsApp */
  notificationsWhatsappNumber?: string;
}

export const defaultUserSettings: UserSettings = {
  autoNotifications: false,
  defaultWhatsappNumber: "",
  notificationsWhatsappNumber: "",
};
