import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Palette } from "lucide-react";
import { ThemeSelector } from "@/components/ThemeSelector";
import { DarkModeToggle } from "@/components/DarkModeToggle";

export const AppPreferences = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">App Preferences</h2>
        <p className="text-muted-foreground mt-1">
          Customize your app experience
        </p>
      </div>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Choose between light mode, dark mode, or follow your system preference
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-sm font-medium mb-2 block">Theme Mode</Label>
            <DarkModeToggle />
          </div>
          
          <div>
            <Label className="text-sm font-medium mb-2 block">Color Palette</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Choose your preferred color palette. Changes are applied instantly.
            </p>
            <ThemeSelector />
          </div>
        </CardContent>
      </Card>

      {/* More preferences can be added here */}
    </div>
  );
};
