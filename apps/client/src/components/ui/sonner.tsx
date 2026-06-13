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
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "font-sans group toast rounded-md border border-border/70 bg-card p-4 text-card-foreground shadow-lg",
          title: "font-sans font-semibold text-card-foreground",
          description: "font-sans text-muted-foreground",
          content: "gap-1",
          closeButton:
            "border border-border/70 bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground",
          actionButton:
            "font-sans rounded-md bg-primary text-primary-foreground",
          cancelButton:
            "font-sans rounded-md bg-muted text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
