import * as React from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface StepperProps {
  active: number
  onStepClick?: (step: number) => void
  children: React.ReactNode
  className?: string
}

interface StepperStepProps {
  label: string
  description?: string
  children?: React.ReactNode
  className?: string
  step?: number
  active?: boolean
  completed?: boolean
  onStepClick?: () => void
}

const Stepper = ({ active, onStepClick, children, className }: StepperProps) => {
  return (
    <div className={cn("w-full", className)}>
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement<StepperStepProps>(child)) {
          return React.cloneElement(child, {
            ...child.props,
            step: index,
            active: active === index,
            completed: active > index,
            onStepClick: onStepClick ? () => onStepClick(index) : undefined,
          })
        }
        return child
      })}
    </div>
  )
}

const StepperStep = ({
  label,
  description,
  children,
  step,
  active,
  completed,
  onStepClick,
  className,
}: StepperStepProps) => {
  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center gap-4",
          onStepClick && "cursor-pointer"
        )}
        onClick={onStepClick}
      >
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
            active && "border-primary bg-primary text-white",
            completed && "border-primary bg-primary text-white",
            !active && !completed && "border-neutral-300 bg-white text-neutral-500"
          )}
        >
          {completed ? (
            <Check className="h-5 w-5" />
          ) : (
            <span className="text-sm font-semibold">{step !== undefined ? step + 1 : ""}</span>
          )}
        </div>
        <div className="flex-1">
          <div
            className={cn(
              "text-sm font-medium",
              active && "text-primary",
              completed && "text-primary",
              !active && !completed && "text-neutral-500"
            )}
          >
            {label}
          </div>
          {description && (
            <div className="text-xs text-neutral-500">{description}</div>
          )}
        </div>
      </div>
      {children && (
        <div className={cn("mt-4", !active && "hidden")}>{children}</div>
      )}
    </div>
  )
}

Stepper.Step = StepperStep

export { Stepper, StepperStep }



