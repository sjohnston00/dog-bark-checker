import db from '~/utils/db.server'
import type { Route } from './+types/index'
import type { Detection } from '~/types/db'
import { data } from 'react-router'
import {
  aggregateByDetectionsMinute,
  findBiggestGap,
  groupDetectionsByConfidenceLevel,
  type AggregatedByMinuteDetection,
  type DetectionConfidenceLevelData
} from '~/utils/detections-transforms.server'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "~/components/ui/chart"
import { Area, AreaChart, Bar, BarChart, Line, LineChart, Tooltip, XAxis } from 'recharts'
import { formatDate, formatDuration, intervalToDuration } from 'date-fns'

const chartConfig = {
  count: {
    label: "Barks",
    color: "#2563eb",
  },
} satisfies ChartConfig

export async function loader({ request }: Route.LoaderArgs) {
  const detections = db.prepare('SELECT * FROM detections ORDER BY created_at DESC').all() as Detection[]

  /**
   * These are time periods where the dog was known to be barking.
   */
  const timePeriods: {
    start: Date
    end: Date
    detections: Detection[]
    groupedDetectionsByConfidenceLevels: DetectionConfidenceLevelData[]
    aggregatedByMinute: AggregatedByMinuteDetection[],
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

const chartData = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
]

export default function IndexPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className='p-4'>
      {loaderData.timePeriods.map((t) => {
        const duration = formatDuration(intervalToDuration({
          start: t.start,
          end: t.end
        }))
        return (
          <div key={`time-period-${t.start.toISOString()}`} className='mb-8'>
            <h1 className='text-4xl font-extrabold tracking-tight text-balance'>
              {formatDate(t.start, 'EEEE do LLLL HH:mm')} - {formatDate(t.end, 'HH:mm')}
            </h1>
            <div className="grid grid-cols-2 mt-2 gap-4">
              <Card>
                <CardHeader>
                  <CardDescription><abbr title="Barks per minute">BPM</abbr></CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                    <BarChart accessibilityLayer data={t.aggregatedByMinute}>
                      <XAxis dataKey="minute" tickLine={false}
                        tickMargin={10}
                        axisLine={false} tickFormatter={(d) => {
                          return formatDate(new Date(d), 'HH:mm')
                        }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 grid-rows-2 gap-4">
                <Card>
                  <CardContent className='flex-1'>
                    <CardDescription>Total Duration</CardDescription>
                    <CardTitle className="h-full place-content-center text-center text-5xl font-semibold tabular-nums">{duration}</CardTitle>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className='flex-1'>

                    <CardDescription>Total Barks</CardDescription>
                    <CardTitle className="h-full place-content-center text-center text-5xl font-semibold tabular-nums">{t.detections.length}</CardTitle>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className='flex-1'>

                    <CardDescription>Average Barks Per Minute</CardDescription>
                    <CardTitle className="h-full place-content-center text-center text-5xl font-semibold tabular-nums">{(t.aggregatedByMinute.reduce((acc, curr) => acc + curr.count, 0) / t.aggregatedByMinute.length).toLocaleString()}</CardTitle>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className='flex-1'>

                    <CardDescription>Longest Gap</CardDescription>
                    <CardTitle className="h-full place-content-center text-center text-5xl font-semibold tabular-nums">{t.biggestGap ? `${(t.biggestGap / 1000).toLocaleString()}s` : 'No gap'}</CardTitle>
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
