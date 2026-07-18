import React from 'react';

const ThemeContext = React.createContext(null);

const STORAGE_THEME = 'sivacad_theme';

function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_THEME);

  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  const systemPrefersDark =
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  return systemPrefersDark ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = React.useState(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      return getInitialTheme();
    } catch {
      return 'dark';
    }
  });

  React.useEffect(() => {
    const root = document.documentElement;

    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    localStorage.setItem(STORAGE_THEME, theme);
  }, [theme]);

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setThemeSafe = React.useCallback((nextTheme) => {
    const normalized = String(nextTheme || '').trim().toLowerCase();
    if (normalized === 'light' || normalized === 'dark') {
      setTheme(normalized);
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: setThemeSafe,
        toggleTheme,
        isDark: theme === 'dark',
        isLight: theme === 'light'
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }

  return context;
}