import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

export const useNativeApp = () => {
  const [isNative, setIsNative] = useState(() => Capacitor.isNativePlatform());

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  return isNative;
};
