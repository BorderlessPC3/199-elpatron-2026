import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type ThemeType = "purple" | "blue" | "orange" | "green" | "red" | "pink";
export type ThemeMode = "light" | "dark" | "midnight";

interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  gradient: string;
  gradientLight: string;
  gradientDark: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  borderLight: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

interface ThemeContextType {
  theme: ThemeType;
  mode: ThemeMode;
  colors: ThemeColors;
  setTheme: (theme: ThemeType) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

type ThemeCorePalette = Pick<
  ThemeColors,
  "primary" | "primaryLight" | "primaryDark" | "secondary" | "secondaryLight" | "secondaryDark" | "accent" | "accentLight" | "accentDark" | "gradient" | "gradientLight" | "gradientDark"
>;
type ThemeSurfacePalette = Pick<
  ThemeColors,
  "background" | "surface" | "text" | "textSecondary" | "border" | "borderLight"
>;
type ThemeFeedbackPalette = Pick<ThemeColors, "success" | "warning" | "error" | "info">;

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const feedbackPalette: ThemeFeedbackPalette = {
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
};

const modeSurfaces: Record<ThemeMode, ThemeSurfacePalette> = {
  light: {
    background: "#eef2f6",
    surface: "#ffffff",
    text: "#1e293b",
    textSecondary: "#64748b",
    border: "#e2e8f0",
    borderLight: "#f1f5f9",
  },
  dark: {
    background: "#131a22",
    surface: "#1b2530",
    text: "#ffffff",
    textSecondary: "#b0b0b0",
    border: "#3a3a3a",
    borderLight: "#4a4a4a",
  },
  midnight: {
    background: "#0f172a",
    surface: "#1e293b",
    text: "#f1f5f9",
    textSecondary: "#94a3b8",
    border: "#334155",
    borderLight: "#475569",
  },
};

const lightPaletteCore: ThemeCorePalette = {
  primary: "#1f4e79",
  primaryLight: "#2f6f9f",
  primaryDark: "#143652",
  secondary: "#274f6d",
  secondaryLight: "#3f6f94",
  secondaryDark: "#1b3952",
  accent: "#b89b59",
  accentLight: "#ceb67e",
  accentDark: "#927a45",
  gradient: "linear-gradient(135deg, #10283f 0%, #1f4e79 100%)",
  gradientLight: "linear-gradient(135deg, #2f6f9f 0%, #5d8fb8 100%)",
  gradientDark: "linear-gradient(135deg, #0d2235 0%, #143652 100%)",
};

const themePalettes: Record<ThemeType, Record<ThemeMode, ThemeCorePalette>> = {
  purple: {
    light: lightPaletteCore,
    dark: {
      primary: "#4b86b8",
      primaryLight: "#74a4cb",
      primaryDark: "#2f5f86",
      secondary: "#3d6f98",
      secondaryLight: "#5f8fb4",
      secondaryDark: "#2b5070",
      accent: "#d4ba82",
      accentLight: "#e2cc9d",
      accentDark: "#aa915e",
      gradient: "linear-gradient(135deg, #14293d 0%, #2f5f86 100%)",
      gradientLight: "linear-gradient(135deg, #325f84 0%, #4b86b8 100%)",
      gradientDark: "linear-gradient(135deg, #102234 0%, #244865 100%)",
    },
    midnight: {
      primary: "#5d95c3",
      primaryLight: "#8ab4d5",
      primaryDark: "#3d6e99",
      secondary: "#4c7ea8",
      secondaryLight: "#6e9abf",
      secondaryDark: "#315b80",
      accent: "#d7c18d",
      accentLight: "#e6d4aa",
      accentDark: "#b39a63",
      gradient: "linear-gradient(135deg, #0f2438 0%, #315b80 100%)",
      gradientLight: "linear-gradient(135deg, #3d6e99 0%, #5d95c3 100%)",
      gradientDark: "linear-gradient(135deg, #0b1c2c 0%, #25445f 100%)",
    },
  },
  blue: {
    light: lightPaletteCore,
    dark: {
      primary: "#4b86b8",
      primaryLight: "#74a4cb",
      primaryDark: "#2f5f86",
      secondary: "#3d6f98",
      secondaryLight: "#5f8fb4",
      secondaryDark: "#2b5070",
      accent: "#d4ba82",
      accentLight: "#e2cc9d",
      accentDark: "#aa915e",
      gradient: "linear-gradient(135deg, #14293d 0%, #2f5f86 100%)",
      gradientLight: "linear-gradient(135deg, #325f84 0%, #4b86b8 100%)",
      gradientDark: "linear-gradient(135deg, #102234 0%, #244865 100%)",
    },
    midnight: {
      primary: "#5d95c3",
      primaryLight: "#8ab4d5",
      primaryDark: "#3d6e99",
      secondary: "#4c7ea8",
      secondaryLight: "#6e9abf",
      secondaryDark: "#315b80",
      accent: "#d7c18d",
      accentLight: "#e6d4aa",
      accentDark: "#b39a63",
      gradient: "linear-gradient(135deg, #0f2438 0%, #315b80 100%)",
      gradientLight: "linear-gradient(135deg, #3d6e99 0%, #5d95c3 100%)",
      gradientDark: "linear-gradient(135deg, #0b1c2c 0%, #25445f 100%)",
    },
  },
  orange: {
    light: {
      primary: "#f97316",
      primaryLight: "#fb923c",
      primaryDark: "#ea580c",
      secondary: "#c2410c",
      secondaryLight: "#f97316",
      secondaryDark: "#9a3412",
      accent: "#ea580c",
      accentLight: "#f97316",
      accentDark: "#c2410c",
      gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
      gradientLight: "linear-gradient(135deg, #fb923c 0%, #f97316 100%)",
      gradientDark: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
    },
    dark: {
      primary: "#fb923c",
      primaryLight: "#fdba74",
      primaryDark: "#f97316",
      secondary: "#ea580c",
      secondaryLight: "#fb923c",
      secondaryDark: "#c2410c",
      accent: "#f97316",
      accentLight: "#fb923c",
      accentDark: "#ea580c",
      gradient: "linear-gradient(135deg, #fb923c 0%, #f97316 100%)",
      gradientLight: "linear-gradient(135deg, #fdba74 0%, #fb923c 100%)",
      gradientDark: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    },
    midnight: {
      primary: "#fb923c",
      primaryLight: "#fdba74",
      primaryDark: "#f97316",
      secondary: "#ea580c",
      secondaryLight: "#fb923c",
      secondaryDark: "#c2410c",
      accent: "#f97316",
      accentLight: "#fb923c",
      accentDark: "#ea580c",
      gradient: "linear-gradient(135deg, #fb923c 0%, #f97316 100%)",
      gradientLight: "linear-gradient(135deg, #fdba74 0%, #fb923c 100%)",
      gradientDark: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    },
  },
  green: {
    light: {
      primary: "#10b981",
      primaryLight: "#34d399",
      primaryDark: "#059669",
      secondary: "#047857",
      secondaryLight: "#10b981",
      secondaryDark: "#065f46",
      accent: "#059669",
      accentLight: "#10b981",
      accentDark: "#047857",
      gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      gradientLight: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
      gradientDark: "linear-gradient(135deg, #059669 0%, #047857 100%)",
    },
    dark: {
      primary: "#34d399",
      primaryLight: "#6ee7b7",
      primaryDark: "#10b981",
      secondary: "#059669",
      secondaryLight: "#34d399",
      secondaryDark: "#047857",
      accent: "#10b981",
      accentLight: "#34d399",
      accentDark: "#059669",
      gradient: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
      gradientLight: "linear-gradient(135deg, #6ee7b7 0%, #34d399 100%)",
      gradientDark: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    },
    midnight: {
      primary: "#34d399",
      primaryLight: "#6ee7b7",
      primaryDark: "#10b981",
      secondary: "#059669",
      secondaryLight: "#34d399",
      secondaryDark: "#047857",
      accent: "#10b981",
      accentLight: "#34d399",
      accentDark: "#059669",
      gradient: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
      gradientLight: "linear-gradient(135deg, #6ee7b7 0%, #34d399 100%)",
      gradientDark: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    },
  },
  red: {
    light: {
      primary: "#ef4444",
      primaryLight: "#f87171",
      primaryDark: "#dc2626",
      secondary: "#b91c1c",
      secondaryLight: "#ef4444",
      secondaryDark: "#991b1b",
      accent: "#dc2626",
      accentLight: "#ef4444",
      accentDark: "#b91c1c",
      gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      gradientLight: "linear-gradient(135deg, #f87171 0%, #ef4444 100%)",
      gradientDark: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
    },
    dark: {
      primary: "#f87171",
      primaryLight: "#fca5a5",
      primaryDark: "#ef4444",
      secondary: "#dc2626",
      secondaryLight: "#f87171",
      secondaryDark: "#b91c1c",
      accent: "#ef4444",
      accentLight: "#f87171",
      accentDark: "#dc2626",
      gradient: "linear-gradient(135deg, #f87171 0%, #ef4444 100%)",
      gradientLight: "linear-gradient(135deg, #fca5a5 0%, #f87171 100%)",
      gradientDark: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    },
    midnight: {
      primary: "#f87171",
      primaryLight: "#fca5a5",
      primaryDark: "#ef4444",
      secondary: "#dc2626",
      secondaryLight: "#f87171",
      secondaryDark: "#b91c1c",
      accent: "#ef4444",
      accentLight: "#f87171",
      accentDark: "#dc2626",
      gradient: "linear-gradient(135deg, #f87171 0%, #ef4444 100%)",
      gradientLight: "linear-gradient(135deg, #fca5a5 0%, #f87171 100%)",
      gradientDark: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    },
  },
  pink: {
    light: {
      primary: "#ec4899",
      primaryLight: "#f472b6",
      primaryDark: "#db2777",
      secondary: "#be185d",
      secondaryLight: "#ec4899",
      secondaryDark: "#9d174d",
      accent: "#db2777",
      accentLight: "#ec4899",
      accentDark: "#be185d",
      gradient: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
      gradientLight: "linear-gradient(135deg, #f472b6 0%, #ec4899 100%)",
      gradientDark: "linear-gradient(135deg, #db2777 0%, #be185d 100%)",
    },
    dark: {
      primary: "#f472b6",
      primaryLight: "#f9a8d4",
      primaryDark: "#ec4899",
      secondary: "#db2777",
      secondaryLight: "#f472b6",
      secondaryDark: "#be185d",
      accent: "#ec4899",
      accentLight: "#f472b6",
      accentDark: "#db2777",
      gradient: "linear-gradient(135deg, #f472b6 0%, #ec4899 100%)",
      gradientLight: "linear-gradient(135deg, #f9a8d4 0%, #f472b6 100%)",
      gradientDark: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
    },
    midnight: {
      primary: "#f472b6",
      primaryLight: "#f9a8d4",
      primaryDark: "#ec4899",
      secondary: "#db2777",
      secondaryLight: "#f472b6",
      secondaryDark: "#be185d",
      accent: "#ec4899",
      accentLight: "#f472b6",
      accentDark: "#db2777",
      gradient: "linear-gradient(135deg, #f472b6 0%, #ec4899 100%)",
      gradientLight: "linear-gradient(135deg, #f9a8d4 0%, #f472b6 100%)",
      gradientDark: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
    },
  },
};

const validThemes: readonly ThemeType[] = [
  "purple",
  "blue",
  "orange",
  "green",
  "red",
  "pink",
];
const validModes: readonly ThemeMode[] = ["light", "dark", "midnight"];

const isThemeType = (value: unknown): value is ThemeType =>
  typeof value === "string" &&
  (validThemes as readonly string[]).includes(value);

const isThemeMode = (value: unknown): value is ThemeMode =>
  typeof value === "string" &&
  (validModes as readonly string[]).includes(value);

const buildThemeColors = (theme: ThemeType, mode: ThemeMode): ThemeColors => ({
  ...themePalettes[theme][mode],
  ...modeSurfaces[mode],
  ...feedbackPalette,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    const savedTheme = localStorage.getItem("elpatron-theme");
    if (!savedTheme || savedTheme === "purple") return "blue";
    return isThemeType(savedTheme) ? savedTheme : "blue";
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    const savedMode = localStorage.getItem("elpatron-mode");
    return isThemeMode(savedMode) ? savedMode : "light";
  });

  const colors = useMemo(() => buildThemeColors(theme, mode), [theme, mode]);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem("elpatron-theme", newTheme);
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem("elpatron-mode", newMode);
  };

  const toggleMode = () => {
    const modes: ThemeMode[] = ["light", "dark", "midnight"];
    const currentIndex = modes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMode(modes[nextIndex]);
  };

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    root.style.setProperty("--gradient-primary", colors.gradient);
    root.style.setProperty("--gradient-light", colors.gradientLight);
    root.style.setProperty("--gradient-dark", colors.gradientDark);
    root.style.setProperty("--theme-mode", mode);
  }, [colors, mode]);

  const value: ThemeContextType = {
    theme,
    mode,
    colors,
    setTheme,
    setMode,
    toggleMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}