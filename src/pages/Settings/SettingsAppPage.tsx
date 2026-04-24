import {
  Alert,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserSettings } from "../../hooks/useUserSettings";
import { userProfileDocument } from "../../services/firestorePaths";
import type { ThemeMode, ThemeType } from "../../contexts/ThemeContext";
import "./SettingsAppPage.css";

const themeTypeOptions: { value: ThemeType; label: string }[] = [
  { value: "purple", label: "Roxo" },
  { value: "blue", label: "Azul" },
  { value: "orange", label: "Laranja" },
  { value: "green", label: "Verde" },
  { value: "red", label: "Vermelho" },
  { value: "pink", label: "Rosa" },
];

const modeOptions: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "midnight", label: "Meia-noite" },
];

function SettingsAppPage() {
  const { user, logout } = useAuth();
  const { theme, mode, setTheme, setMode } = useTheme();
  const { settings, loading: settingsLoading, save, error: settingsError } =
    useUserSettings(user?.uid);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileLoad, setProfileLoad] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (!user) {
      setProfileLoad(false);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(userProfileDocument(user.uid));
        if (snap.exists()) {
          const d = snap.data() as { name?: string; displayName?: string };
          setDisplayName(d.displayName || d.name || user.displayName || "");
        } else {
          setDisplayName(user.displayName || "");
        }
      } catch {
        setDisplayName(user.displayName || "");
      } finally {
        setProfileLoad(false);
      }
    })();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(
        userProfileDocument(user.uid),
        { displayName, email: user.email, updatedAt: new Date() },
        { merge: true },
      );
      setMessage({ type: "success", text: "Perfil salvo com sucesso." });
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Falha ao salvar perfil.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNotifChange = (auto: boolean) => {
    void save({ autoNotifications: auto });
  };

  const handleWhatsappChange = (value: string) => {
    void save({ defaultWhatsappNumber: value });
  };

  if (!user || profileLoad || settingsLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography>Carregando configurações…</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" className="settings-app-page" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
        Configurações
      </Typography>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}
      {settingsError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {settingsError}
        </Alert>
      )}

      <Stack spacing={3}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Perfil
            </Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Nome"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={saving}
              />
              <TextField
                fullWidth
                label="E-mail"
                value={user.email ?? ""}
                disabled
                helperText="O e-mail vem da sua conta e não pode ser alterado aqui."
              />
              <Button variant="contained" onClick={handleSaveProfile} disabled={saving}>
                Salvar perfil
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Notificações
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.autoNotifications}
                  onChange={(_, c) => handleNotifChange(c)}
                />
              }
              label="Enviar mensagens automáticas (WhatsApp / SMS via servidor)"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Quando ativado, o backend pode enviar lembretes e confirmações para os
              contatos dos clientes, conforme regras de negócio.
            </Typography>
            <TextField
              fullWidth
              label="Número WhatsApp padrão (opcional)"
              placeholder="Ex: 5511999998888"
              value={settings.defaultWhatsappNumber ?? ""}
              onChange={(e) => handleWhatsappChange(e.target.value)}
              helperText="Usado como fallback se o cliente não tiver telefone cadastrado."
            />
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Sistema
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel id="theme-palette">Tema de cores</InputLabel>
                <Select
                  labelId="theme-palette"
                  label="Tema de cores"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as ThemeType)}
                >
                  {themeTypeOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="theme-mode">Modo de exibição</InputLabel>
                <Select
                  labelId="theme-mode"
                  label="Modo de exibição"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ThemeMode)}
                >
                  {modeOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Preferências de aparência são salvas no navegador (local).
            </Typography>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Segurança
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Encerre remotamente o acesso noutros dispositivos. Em produção, isto
              requer tokens revogados no backend.
            </Typography>
            <Button
              variant="outlined"
              color="warning"
              onClick={() => {
                window.alert(
                  "Simulado: em produção, chamaria a API de revogação de refresh tokens (Firebase / Identity).",
                );
              }}
            >
              Encerrar sessão em todos dispositivos
            </Button>
            <Divider sx={{ my: 2 }} />
            <Button
              variant="outlined"
              color="error"
              onClick={async () => {
                try {
                  await logout();
                } catch {
                  /* */
                }
              }}
            >
              Sair deste dispositivo
            </Button>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}

export default SettingsAppPage;
