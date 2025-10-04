import { data, Form } from 'react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '~/components/ui/card'
import type { Detection, TimePeriod } from '~/types/db'
import db from '~/utils/db.server'
import {
  aggregateByDetectionsMinute,
  findBiggestGap,
  groupDetectionsByConfidenceLevel,
  type AggregatedByMinuteDetection,
  type DetectionConfidenceLevelData
} from '~/utils/detections-transforms.server'
import type { Route } from './+types/index'

import { formatDate, formatDuration, intervalToDuration } from 'date-fns'
import { useId } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  XAxis
} from 'recharts'
import type { BarRectangleItem } from 'recharts/types/cartesian/Bar'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '~/components/ui/chart'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Label } from '~/components/ui/label'
import { Input } from '~/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { EllipsisVerticalIcon } from 'lucide-react'
import { DropdownMenuGroup } from '@radix-ui/react-dropdown-menu'

const chartConfig = {
  count: {
    label: 'Barks',
    color: '#2563eb'
  }
} satisfies ChartConfig

export async function loader({ request }: Route.LoaderArgs) {
  const detections = db
    .prepare('SELECT * FROM detections ORDER BY created_at DESC')
    .all() as Detection[]

  const dbTimePeriods = db
    .prepare('SELECT * FROM time_periods ORDER BY date DESC, start_time DESC').all() as TimePeriod[]

  /**
   * These are time periods where the dog was known to be barking.
   */
  const timePeriods: {
    start: Date
    end: Date
    detections: Detection[]
    groupedDetectionsByConfidenceLevels: DetectionConfidenceLevelData[]
    aggregatedByMinute: AggregatedByMinuteDetection[]
    biggestGap: number | null
  }[] = dbTimePeriods.map(d => {
    return {
      start: new Date(`${d.date}T${d.start_time}`),
      end: new Date(`${d.date}T${d.end_time}`),
      detections: [],
      groupedDetectionsByConfidenceLevels: [],
      aggregatedByMinute: [],
      biggestGap: null
    }
  })

  for (let index = 0; index < timePeriods.length; index++) {
    const t = timePeriods[index]
    t.detections = detections.filter((d) => {
      const createdAt = new Date(d.created_at)
      return createdAt >= t.start && createdAt <= t.end
    })
    t.groupedDetectionsByConfidenceLevels = groupDetectionsByConfidenceLevel(
      t.detections
    )
    t.aggregatedByMinute = aggregateByDetectionsMinute(
      detections,
      t.start,
      t.end
    )
    t.biggestGap = findBiggestGap(t.detections)?.gapMs || null
  }

  timePeriods.sort((a, b) => b.start.getTime() - a.start.getTime())
  return data({ detections, timePeriods })
}

export const headers: Route.HeadersFunction = () => {
  const headers = new Headers()
  headers.append('Cache-Control', 'no-store')

  return headers
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()

  const action = formData.get('_action')

  switch (action) {
    case 'add-time-period':
      const date = formData.get('date') as string
      const startTime = formData.get('startTime') as string
      const endTime = formData.get('endTime') as string

      if (!date || !startTime || !endTime) {
        return null
      }

      // const start = new Date(`${date}T${startTime}`)
      // const end = new Date(`${date}T${endTime}`)

      // if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      //   return null
      // }

      db.prepare('INSERT INTO time_periods (date, start_time, end_time) VALUES (?, ?, ?)')
        .run(date, startTime, endTime)
      return null
    case 'delete-time-period':
      const dateToDelete = formData.get('date') as string
      if (!dateToDelete) {
        return null
      }
      db.prepare('DELETE FROM time_periods WHERE date = ?').run(dateToDelete)
      return null

    default:
      return null
  }
}

export default function IndexPage({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Dialog>
        <DialogTrigger className='mb-4'><Button>Add Times</Button></DialogTrigger>
        <DialogContent autoFocus={false}>
          <DialogHeader>
            <DialogTitle>Add New Time Period</DialogTitle>
          </DialogHeader>
          <Form method='post' preventScrollReset replace autoComplete='off' navigate={false}>
            <input type='hidden' name='_action' value='add-time-period' />
            <div className='grid mb-4'>
              <div className="flex flex-col gap-3">
                <Label htmlFor="date" className="px-1">
                  Date
                </Label>
                <Input
                  type="date"
                  id="date"
                  name='date'
                  step="1"
                  defaultValue={formatDate(new Date(), 'yyyy-MM-dd')}
                  className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
              </div>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div className="flex flex-col gap-3">
                <Label htmlFor="startTime" className="px-1">
                  Start
                </Label>
                <Input
                  type="time"
                  id="startTime"
                  name='startTime'
                  step="1"
                  defaultValue="00:00:00"
                  className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="endTime" className="px-1">
                  End
                </Label>
                <Input
                  type="time"
                  id="endTime"
                  name='endTime'
                  step="1"
                  defaultValue="00:00:00"
                  className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant={'outline'}>Close</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button type="submit" variant={'default'}>Save</Button>
              </DialogClose>
            </DialogFooter>
          </Form>
        </DialogContent>

      </Dialog>
      {loaderData.timePeriods.map((t) => {
        const duration = formatDuration(
          intervalToDuration({
            start: t.start,
            end: t.end
          })
        )
        return (
          <div key={`time-period-${t.start.toISOString()}`} className='mb-8'>
            <div className='flex items-center justify-between mx-2'>

              <h1 className='text-4xl font-extrabold tracking-tight text-balance'>
                {formatDate(t.start, 'EEE do LLL HH:mm')} -{' '}
                {formatDate(t.end, 'HH:mm')}
              </h1>
              <Dialog>
                <DropdownMenu>
                  <DropdownMenuTrigger ><Button variant={'outline'}><EllipsisVerticalIcon /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent side='left' align='start'>
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuLabel>Edit</DropdownMenuLabel>
                    <DialogTrigger asChild>
                      <DropdownMenuItem variant='destructive'>Delete</DropdownMenuItem>
                    </DialogTrigger>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DialogContent><DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. Are you sure you want to permanently
                    delete this time period?
                  </DialogDescription>
                </DialogHeader>
                  <Form method='post' replace preventScrollReset navigate={false}>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant={'outline'} type='button'>Cancel</Button>
                      </DialogClose>
                      <input type='hidden' name='_action' value='delete-time-period' />
                      <input type='hidden' name='date' value={formatDate(t.start, 'yyyy-MM-dd')} />
                      <DialogClose asChild>
                        <Button variant={'destructive'} type='submit'>Delete</Button>
                      </DialogClose>
                    </DialogFooter>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            <div className='grid grid-cols-1 lg:grid-cols-2 mt-4 gap-4'>
              <Card>
                <CardHeader>
                  <CardDescription>Barks Per Minute (<abbr title='Barks per minute'>BPM</abbr>)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={chartConfig}
                    className='min-h-[200px] w-full select-none'>
                    <BarChart accessibilityLayer data={t.aggregatedByMinute}>
                      <XAxis
                        dataKey='minute'
                        tickLine={false}
                        tickMargin={10}
                        axisType='xAxis'
                        minTickGap={16}
                        axisLine={false}
                        tickFormatter={(d) => {
                          return formatDate(new Date(d), 'HH:mm')
                        }}
                      />
                      <ChartTooltip
                        accessibilityLayer
                        content={
                          <ChartTooltipContent
                            labelFormatter={(_, payload) => {
                              return formatDate(
                                new Date(payload[0].payload.minute),
                                'HH:mm'
                              )
                            }}
                          />
                        }
                      />
                      <CartesianGrid vertical={false} strokeDasharray={4} />
                      <Bar
                        isAnimationActive={false}
                        dataKey='count'
                        fill='var(--color-count)'
                        radius={4}
                        shape={<BarGradient />}
                      />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              <div className='grid grid-cols-2 grid-rows-2 gap-4'>
                <Card>
                  <CardContent className='flex-1'>
                    <CardDescription>Total Duration</CardDescription>
                    <CardTitle className='h-full place-content-center text-center text-4xl lg:text-5xl font-semibold tabular-nums'>
                      {duration}
                    </CardTitle>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className='flex-1'>
                    <CardDescription>Total Barks</CardDescription>
                    <CardTitle className='h-full place-content-center text-center text-4xl lg:text-5xl font-semibold tabular-nums'>
                      {t.detections.length}
                    </CardTitle>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className='flex-1'>
                    <CardDescription>Average Barks Per Minute</CardDescription>
                    <CardTitle className='h-full place-content-center text-center text-4xl lg:text-5xl font-semibold tabular-nums'>
                      {(
                        t.aggregatedByMinute.reduce(
                          (acc, curr) => acc + curr.count,
                          0
                        ) / t.aggregatedByMinute.length
                      ).toLocaleString()}
                    </CardTitle>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className='flex-1'>
                    <CardDescription>Longest Gap</CardDescription>
                    <CardTitle className='h-full place-content-center text-center text-4xl lg:text-5xl font-semibold tabular-nums'>
                      {t.biggestGap
                        ? `${(t.biggestGap / 1000).toLocaleString()}s`
                        : 'No gap'}
                    </CardTitle>
                  </CardContent>
                </Card>
              </div>
            </div>
            <hr className='mt-4' />
          </div>
        )
      })}
    </>
  )
}

function BarGradient(props: BarRectangleItem) {
  const id = useId()
  const gradientId = `gradient-${id}`
  const clipPathId = `clipPath-${id}`

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='100%'>
          <stop offset='0%' stopColor='var(--color-count)' />
          <stop offset='100%' stopColor='#5D25EB' />
        </linearGradient>

        <clipPath id={clipPathId}>
          <Rectangle {...props} />
        </clipPath>
      </defs>

      <rect
        x={props.x}
        width={props.width}
        height={props.background?.height}
        fill={`url(#${gradientId})`}
        y={props.background?.y}
        clipPath={`url(#${clipPathId})`}
      />
    </>
  )
}
