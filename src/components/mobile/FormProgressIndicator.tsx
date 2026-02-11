import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormProgressIndicatorProps {
  steps: string[];
  currentStep: number;
  completedSteps?: number[];
  className?: string;
}

export const FormProgressIndicator = ({
  steps,
  currentStep,
  completedSteps = [],
  className,
}: FormProgressIndicatorProps) => {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-2">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = completedSteps.includes(stepNumber) || stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;

          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  isUpcoming && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  stepNumber
                )}
              </div>
              <div
                className={cn(
                  "text-xs mt-1 text-center max-w-[80px]",
                  isCurrent && "font-medium text-primary",
                  isUpcoming && "text-muted-foreground"
                )}
              >
                {step}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Progress bar */}
      <div className="relative">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-muted -translate-y-1/2" />
        <div
          className="absolute top-1/2 left-0 h-0.5 bg-primary transition-all duration-300 -translate-y-1/2"
          style={{
            width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
          }}
        />
      </div>
    </div>
  );
};
