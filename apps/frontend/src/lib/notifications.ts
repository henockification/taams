import { toast } from "@/components/ui/use-toast"

export const notifications = {
  show: (options: {
    title?: string
    message?: string
    color?: 'green' | 'red' | 'blue' | 'yellow'
    icon?: React.ReactNode
  }) => {
    toast({
      title: options.title,
      description: options.message,
      variant: options.color === 'red' ? 'destructive' : 'default',
    })
  },
}



