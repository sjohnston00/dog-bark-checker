import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '~/lib/utils'

const buttonVariants = cva('btn', {
  variants: {
    variant: {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      accent: 'btn-accent',
      info: 'btn-info',
      neutral: 'btn-neutral',
      success: 'btn-success',
      warning: 'btn-warning',
      error: 'btn-error',
    },
    size: {
      xs: 'btn-xs',
      sm: 'btn-sm',
      lg: 'btn-lg',
      xl: 'btn-xl',
    },
    modifier: {
      wide: 'btn-wide',
      block: 'btn-block',
      square: 'btn-square',
      circle: 'btn-circle',
    },
    btnStyle: {
      outline: 'btn-outline',
      soft: 'btn-soft',
      dash: 'btn-dash',
      ghost: 'btn-ghost',
      link: 'btn-link',
    },
  },
})

function Button({
  className,
  variant,
  size,
  btnStyle,
  modifier,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      className={cn(
        buttonVariants({ variant, size, btnStyle, modifier, className })
      )}
      {...props}
    />
  )
}

export { Button, buttonVariants }
