import * as React from 'react'
import type { JSX } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '~/lib/utils'

const headingVariants = cva('font-bold tracking-tight', {
  variants: {
    size: {
      h1: 'text-5xl',
      h2: 'text-4xl',
      h3: 'text-3xl',
      h4: 'text-2xl',
      h5: 'text-xl',
      h6: 'text-lg',
    },
  },
  defaultVariants: {
    size: 'h1',
  },
})

function Heading({
  className,
  size,
  ...props
}: React.ComponentProps<'h1'> & VariantProps<typeof headingVariants>) {
  const Tag = `h${size?.slice(1) || 1}` as
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
  //render either h1, h2, h3, h4, h5, or h6 based on size prop

  return <Tag className={cn(headingVariants({ size, className }))} {...props} />
}

export { Heading, headingVariants }
