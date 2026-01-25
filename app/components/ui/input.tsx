import * as React from 'react'

import { cn } from '~/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn('input w-full', className)} {...props} />
}

export { Input }
