import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin } from "iconoir-react";
import { useToast } from "@/hooks/use-toast";
import type { User, Profile } from "@/types";
import { fetchProfile, type PersonalInfoUpdate, upsertPersonalInfo } from "@/services/api";

interface PersonalInfoProps {
  user: User;
}

export const PersonalInfo = ({ user }: PersonalInfoProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    date_of_birth: "",
    city: "",
    country: "",
    latitude: "",
    longitude: "",
  });

  const locationIsHidden = profile?.show_location === false;

  const parseCoordinate = (value: string, label: string, min: number, max: number) => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new Error(`${label} must be between ${min} and ${max}.`);
    }

    return parsed;
  };

  const buildPayload = (data = formData): PersonalInfoUpdate => ({
    ...data,
    latitude: parseCoordinate(data.latitude, "Latitude", -90, 90),
    longitude: parseCoordinate(data.longitude, "Longitude", -180, 180),
    city: data.city.trim() || null,
    country: data.country.trim() || null,
  });

  const reverseGeocode = async (latitude: number, longitude: number) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 7000);

    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(latitude),
        lon: String(longitude),
        zoom: "10",
        addressdetails: "1",
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        signal: controller.signal,
      });

      if (!response.ok) return {};

      const result = await response.json();
      const address = result?.address ?? {};
      return {
        city:
          address.city ||
          address.town ||
          address.village ||
          address.municipality ||
          address.county ||
          address.state ||
          "",
        country: address.country || "",
      };
    } catch (error) {
      console.warn("Reverse geocoding failed", error);
      return {};
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const getCurrentPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 15_000,
      });
    });

  const savePersonalInfo = async (
    data = formData,
    success = {
      title: "Personal information updated",
      description: "Your personal information has been saved.",
    }
  ): Promise<boolean> => {
    if (!user) return false;

    setSaving(true);
    try {
      await upsertPersonalInfo(user.id, buildPayload(data));

      toast(success);

      loadProfile();
      return true;
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update personal information",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      const data = await fetchProfile(user.id);
      if (data) {
        setProfile(data);
        setFormData({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          phone_number: data.phone_number || "",
          date_of_birth: data.date_of_birth || "",
          city: data.city || "",
          country: data.country || "",
          latitude: data.latitude?.toString() || "",
          longitude: data.longitude?.toString() || "",
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    await savePersonalInfo();
  };

  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation",
      });
      return;
    }

    setLocating(true);
    try {
      toast({
        title: "Getting location...",
        description: "Please allow location access",
      });

      const position = await getCurrentPosition();
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const resolvedLocation = await reverseGeocode(latitude, longitude);
      const nextFormData = {
        ...formData,
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
        city: resolvedLocation.city || formData.city,
        country: resolvedLocation.country || formData.country,
      };

      setLocationAccuracy(position.coords.accuracy ?? null);
      setFormData(nextFormData);

      await savePersonalInfo(nextFormData, {
        title: "Location updated",
        description: resolvedLocation.city
          ? `Saved near ${resolvedLocation.city}${resolvedLocation.country ? `, ${resolvedLocation.country}` : ""}.`
          : "Saved your current coordinates for nearby reader discovery.",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String(error.message)
            : "Could not get your location.";
      toast({
        variant: "destructive",
        title: "Location error",
        description: message,
      });
    } finally {
      setLocating(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Personal Information</h2>
        <p className="font-sans text-muted-foreground mt-1">
          Manage your personal details and location
        </p>
      </div>

      {/* Name */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder="Enter your first name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                placeholder="Enter your last name"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input
              id="phone_number"
              type="tel"
              value={formData.phone_number}
              onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
              placeholder="Enter your phone number"
            />
          </div>
          <DatePicker
            id="date_of_birth"
            label="Date of Birth"
            value={formData.date_of_birth}
            onChange={(value) => setFormData(prev => ({ ...prev, date_of_birth: value ?? "" }))}
          />
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Location</CardTitle>
          <CardDescription className="font-sans">
            Add your location to discover readers near you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                placeholder="e.g., New York"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                placeholder="e.g., United States"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                placeholder="e.g., 40.7128"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                placeholder="e.g., -74.0060"
              />
            </div>
          </div>

          {locationAccuracy !== null && (
            <p className="font-sans text-xs text-muted-foreground">
              Browser accuracy estimate: within {Math.round(locationAccuracy)} meters.
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleGetCurrentLocation}
            disabled={locating || saving}
            className="flex items-center gap-2"
          >
            <MapPin className="h-4 w-4" />
            {locating ? "Getting location..." : "Use Current Location"}
          </Button>

          <div className="bg-muted/50 p-3 rounded-lg space-y-1">
            <p className="font-sans text-xs text-muted-foreground">
              <strong>Privacy Note:</strong> Your location data is used only for reader discovery features.
            </p>
            {locationIsHidden && (
              <p className="font-sans text-xs text-muted-foreground">
                Nearby discovery is currently hidden. Turn it back on in Privacy Settings when you want readers near you to find you.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};
