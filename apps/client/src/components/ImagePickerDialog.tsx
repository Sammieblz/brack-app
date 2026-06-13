import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, MediaImage } from "iconoir-react";
import { useImagePicker } from "@/hooks/useImagePicker";

interface ImagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImagePicked: (image: { dataUrl: string; format: string; base64?: string }) => void;
  title?: string;
  description?: string;
}

export const ImagePickerDialog = ({
  open,
  onOpenChange,
  onImagePicked,
  title = "Choose Image Source",
  description = "Select where you'd like to get your image from",
}: ImagePickerDialogProps) => {
  const { pickFromCamera, pickFromPhotos, picking } = useImagePicker();

  const handleCamera = async () => {
    const image = await pickFromCamera();
    if (image) {
      onImagePicked(image);
      onOpenChange(false);
    }
  };

  const handlePhotos = async () => {
    const image = await pickFromPhotos();
    if (image) {
      onImagePicked(image);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription className="font-sans">{description}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <Button
            onClick={handleCamera}
            disabled={picking}
            variant="outline"
            className="flex flex-col h-auto py-6 gap-2"
          >
            <Camera className="h-8 w-8" />
            <span className="font-sans">Camera</span>
          </Button>
          <Button
            onClick={handlePhotos}
            disabled={picking}
            variant="outline"
            className="flex flex-col h-auto py-6 gap-2"
          >
            <MediaImage className="h-8 w-8" />
            <span className="font-sans">Photo Library</span>
          </Button>
        </div>

        {picking && (
          <p className="font-sans text-sm text-muted-foreground text-center">
            Processing image...
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
