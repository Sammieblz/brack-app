import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      duration={2500}
      closeButton
      visibleToasts={2}
      swipeDirections={["up", "right"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "font-sans group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "font-sans group-[.toast]:text-muted-foreground",
          actionButton:
            "font-sans group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "font-sans group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
