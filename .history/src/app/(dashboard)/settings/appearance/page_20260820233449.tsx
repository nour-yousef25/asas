"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AppearanceSettings {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export default function AppearanceSettingsPage() {
  const [settings, setSettings] = useState<AppearanceSettings>({
    logoUrl: "",
    primaryColor: "#0d9488",
    secondaryColor: "#115e59",
    accentColor: "#f59e0b",
  });

  const handleSave = async () => {
    try {
      const response = await fetch("/api/settings/appearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      alert("Settings saved successfully");
    } catch (error) {
      console.error(error);
      alert("Error while saving settings");
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">إعدادات المظهر</h1>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">رابط الشعار</label>
          <Input
            placeholder="رابط الشعار"
            value={settings.logoUrl}
            onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
          />
          <div className="mt-4">
            {settings.logoUrl && <img src={settings.logoUrl} alt="Preview" className="h-12" />}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">اللون الأساسي</label>
          <Input
            type="color"
            value={settings.primaryColor}
            onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">اللون الثانوي</label>
          <Input
            type="color"
            value={settings.secondaryColor}
            onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">اللون المكمل</label>
          <Input
            type="color"
            value={settings.accentColor}
            onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
          />
        </div>

        <div
          className="h-24 w-full mt-6 border rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: settings.primaryColor,
            color: settings.accentColor,
            borderColor: settings.secondaryColor,
          }}
        >
          <span className="text-lg font-bold">معاينة المباشرة</span>
        </div>

        <Button onClick={handleSave}>حفظ التغييرات</Button>
      </div>
    </div>
  );
}