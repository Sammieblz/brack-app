import { useLayoutEffect, useRef, type RefObject } from "react";
import { MobileDialog } from "@/components/ui/mobile-dialog";
import { Button } from "@/components/ui/button";
import { Camera, MediaImage } from "iconoir-react";
import { useImagePicker } from "@/hooks/useImagePicker";

interface ImagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImagePicked: (image: { dataUrl: string; format: string; base64?: string }) => void;
  title?: string;
  description?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export const ImagePickerDialog = ({
  open,
  onOpenChange,
  onImagePicked,
  title = "Choose Image Source",
  description = "Select where you'd like to get your image from",
  returnFocusRef,
}: ImagePickerDialogProps) => {
  const { pickFromCamera, pickFromPhotos, picking } = useImagePicker();
  const generation = useRef(0);
  const selecting = useRef(false);
  useLayoutEffect(() => {
    generation.current += 1;
    selecting.current = false;
    return () => { generation.current += 1; };
  }, [open]);
  const select = async (pick: typeof pickFromCamera) => {
    if (!open || selecting.current) return;
    selecting.current = true;
    const current = generation.current;
    try {
      const image = await pick();
      if (current !== generation.current) return;
      if (image) {
        onImagePicked(image);
        onOpenChange(false);
      }
    } finally {
      if (current === generation.current) selecting.current = false;
    }
  };

  return (
    <MobileDialog open={open} onOpenChange={next => { if (!selecting.current) onOpenChange(next); }}
      title={title} description={description} showClose={!picking} returnFocusRef={returnFocusRef}>

        <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          <Button
            onClick={() => void select(pickFromCamera)}
            disabled={picking}
            variant="outline"
            className="flex h-auto flex-col gap-2 whitespace-normal py-6"
          >
            <Camera className="h-8 w-8" />
            <span className="font-sans">Camera</span>
          </Button>
          <Button
            onClick={() => void select(pickFromPhotos)}
            disabled={picking}
            variant="outline"
            className="flex h-auto flex-col gap-2 whitespace-normal py-6"
          >
            <MediaImage className="h-8 w-8" />
            <span className="font-sans">Photo Library</span>
          </Button>
        </div>

        {picking && (
          <p role="status" className="font-sans text-sm text-muted-foreground text-center">
            Processing image...
          </p>
        )}
    </MobileDialog>
  );
};
