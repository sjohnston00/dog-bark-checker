import { data } from 'react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '~/components/ui/card'
import type { Detection } from '~/types/db'
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
  }[] = [
      {
        start: new Date('2025-09-27T16:18'),
        end: new Date('2025-09-27T16:38'),
        detections: [],
        groupedDetectionsByConfidenceLevels: [],
        aggregatedByMinute: [],
        biggestGap: null
      },
      {
        start: new Date('2025-09-28T09:15'),
        end: new Date('2025-09-28T09:25'),
        detections: [],
        groupedDetectionsByConfidenceLevels: [],
        aggregatedByMinute: [],
        biggestGap: null
      },
      {
        start: new Date('2025-10-02T16:10'),
        end: new Date('2025-10-02T16:36'),
        detections: [],
        groupedDetectionsByConfidenceLevels: [],
        aggregatedByMinute: [],
        biggestGap: null
      },
      {
        start: new Date('2025-10-03T16:18'),
        end: new Date('2025-10-03T16:48'),
        detections: [],
        groupedDetectionsByConfidenceLevels: [],
        aggregatedByMinute: [],
        biggestGap: null
      }
    ]

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

export default function IndexPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className='p-4'>
      {loaderData.timePeriods.map((t) => {
        const duration = formatDuration(
          intervalToDuration({
            start: t.start,
            end: t.end
          })
        )
        return (
          <div key={`time-period-${t.start.toISOString()}`} className='mb-8'>
            <h1 className='text-4xl font-extrabold tracking-tight text-balance'>
              {formatDate(t.start, 'EEE do LLL HH:mm')} -{' '}
              {formatDate(t.end, 'HH:mm')}
            </h1>
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
    </div>
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
