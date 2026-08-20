"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface OrganizationTheme {
  name: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

const ThemeContext = createContext<OrganizationTheme | null>(null);

export function DynamicThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: OrganizationTheme;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    // تحديث متغيرات CSS ديناميكياً في الـ root
    const root = document.documentElement;
    root.style.setProperty("--primary", theme.primaryColor);
    root.style.setProperty("--secondary", theme.secondaryColor);
    root.style.setProperty("--accent", theme.accentColor);
    
    // تحديث عنوان الصفحة إذا لم يكن مخصصاً
    if (theme.name) {
      document.title = `${theme.name} | منصة أساس`;
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within DynamicThemeProvider");
  return context;
}
