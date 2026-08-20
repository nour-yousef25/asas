"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AppearanceSettings {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
}

export default function AppearanceSettingsPage() {
  const [settings, setSettings] = useState<AppearanceSettings>({
    logoUrl: "",
    primaryColor: "",
    secondaryColor: "",
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

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">رابط الشعار</label>
          <Input
            placeholder="رابط الشعار"
            value={settings.logoUrl}
            onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
          />
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

        <Button onClick={handleSave}>حفظ التغييرات</Button>
      </div>
    </div>
  );
}