import { BookOpen } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

const LoadingSpinner = ({ size = "md", text = "Loading..." }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  };

  const containerSizes = {
    sm: "p-2",
    md: "p-3",
    lg: "p-4"
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl"
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className={`${containerSizes[size]} bg-gradient-primary rounded-3xl shadow-glow animate-pulse`}>
        <BookOpen className={`${sizeClasses[size]} text-white`} />
      </div>
      <span className={`${textSizes[size]} font-medium bg-gradient-primary bg-clip-text text-transparent`}>
        {text}
      </span>
    </div>
  );
};

export default LoadingSpinner;