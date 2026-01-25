import * as React from 'react'

import { cn } from '~/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('card', className)} {...props} />
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='card-title'
      className={cn('leading-none font-semibold', className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('card-actions', className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot='card-body' className={cn('px-6', className)} {...props} />
  )
}

export { Card, CardTitle, CardAction, CardContent }
