import { useState } from "react";
import { Camera, CameraResultType, CameraSource, Photo } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";

export interface ImagePickerOptions {
  source?: 'camera' | 'photos' | 'prompt';
  quality?: number; // 0-100
  allowEditing?: boolean;
  width?: number;
  height?: number;
}

export interface PickedImage {
  dataUrl: string;
  format: string;
  base64?: string;
  webPath?: string;
}

export const useImagePicker = () => {
  const [picking, setPicking] = useState(false);
  const { toast } = useToast();

  const pickImage = async (options: ImagePickerOptions = {}): Promise<PickedImage | null> => {
    setPicking(true);
    
    try {
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor Camera plugin
        let source: CameraSource;
        
        if (options.source === 'camera') {
          source = CameraSource.Camera;
        } else if (options.source === 'photos') {
          source = CameraSource.Photos;
        } else {
          // Prompt user to choose
          source = CameraSource.Prompt;
        }

        const photo: Photo = await Camera.getPhoto({
          quality: options.quality ?? 90,
          allowEditing: options.allowEditing ?? false,
          resultType: CameraResultType.DataUrl,
          source,
          width: options.width,
          height: options.height,
        });

        if (!photo.dataUrl) {
          throw new Error('No image data received');
        }

        // Extract format from data URL
        const formatMatch = photo.dataUrl.match(/data:image\/(\w+);base64/);
        const format = formatMatch ? formatMatch[1] : 'jpeg';

        return {
          dataUrl: photo.dataUrl,
          format,
          base64: photo.dataUrl.split(',')[1],
          webPath: photo.webPath,
        };
      } else {
        // Web fallback using file input
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.style.display = 'none';
          
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) {
              resolve(null);
              return;
            }

            // Validate file type
            if (!file.type.startsWith('image/')) {
              toast({
                variant: 'destructive',
                title: 'Invalid file type',
                description: 'Please select an image file',
              });
              resolve(null);
              return;
            }

            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
              toast({
                variant: 'destructive',
                title: 'File too large',
                description: 'Please select an image smaller than 5MB',
              });
              resolve(null);
              return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              const format = file.type.split('/')[1] || 'jpeg';
              
              resolve({
                dataUrl,
                format,
                base64: dataUrl.split(',')[1],
              });
            };
            reader.onerror = () => {
              toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to read image file',
              });
              resolve(null);
            };
            reader.readAsDataURL(file);
          };

          input.oncancel = () => {
            resolve(null);
          };

          document.body.appendChild(input);
          input.click();
          document.body.removeChild(input);
        });
      }
    } catch (error: unknown) {
      console.error('Error picking image:', error);
      
      // Handle permission denied
      if (error instanceof Error && (error.message?.includes('permission') || error.message?.includes('denied'))) {
        toast({
          variant: 'destructive',
          title: 'Permission denied',
          description: 'Please grant camera/photo library access in settings',
        });
      } else if (error instanceof Error && error.message !== 'User cancelled') {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to pick image',
        });
      }
      
      return null;
    } finally {
      setPicking(false);
    }
  };

  const pickFromCamera = () => pickImage({ source: 'camera' });
  const pickFromPhotos = () => pickImage({ source: 'photos' });
  const pickWithPrompt = () => pickImage({ source: 'prompt' });

  return {
    pickImage,
    pickFromCamera,
    pickFromPhotos,
    pickWithPrompt,
    picking,
  };
};
