import { cn } from "@/lib/utils"
import "./skeleton.css"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn("brack-skeleton rounded-md", className)}
      data-skeleton=""
      aria-hidden="true"
      tabIndex={-1}
      // React 18 does not type the native inert attribute yet. An empty string
      // emits the boolean HTML attribute and protects any accidental children.
      {...{ inert: "" }}
    />
  )
}

export { Skeleton }
