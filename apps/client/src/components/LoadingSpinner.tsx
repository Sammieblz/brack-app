import { LogoSpinner } from "@/components/animations/LogoSpinner";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

const LoadingSpinner = ({ size = "md", text = "Loading..." }: LoadingSpinnerProps) => {
  return <LogoSpinner size={size} text={text} />;
};

export default LoadingSpinner;