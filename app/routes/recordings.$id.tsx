import { formatDate } from 'date-fns'
import { data, isRouteErrorResponse, Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { twMerge } from 'tailwind-merge'
import { Card, CardContent, CardTitle } from '~/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'
import { Heading } from '~/components/ui/heading'
import type { Detection } from '~/types/db'
import db from '~/utils/db.server'
import {
  aggregateByDetectionsMinute,
  type AggregatedByMinuteDetection,
} from '~/utils/detections-transforms.server'
import RecordingsRepository from '~/utils/RecordingsRepository.server'
import type { Route } from './+types/recordings.$id'

export async function loader({ params }: Route.LoaderArgs) {
  const recordingId = Number(params.id)

  if (!recordingId || recordingId < 0) {
    throw data({ message: 'Invalid recording ID' }, { status: 400 })
  }
  const recordingsRepo = new RecordingsRepository({ db: db })
  const recording = recordingsRepo.getById(recordingId)

  if (!recording) {
    throw data({ message: 'Recording not found' }, { status: 404 })
  }

  let barks: (Detection & { recordingId: number })[] = []

  let barksAggregatedByMinute: AggregatedByMinuteDetection[] = []

  if (recording.status === 'completed' || recording.status === 'pending') {
    barks = db
      .prepare<
        [number],
        Detection & { recordingId: number }
      >('SELECT * FROM recording_barks WHERE recordingId = ? ORDER BY timestamp DESC')
      .all(recordingId)

    barksAggregatedByMinute = aggregateByDetectionsMinute(
      barks,
      new Date(recording.startTime!),
      recording.endTime ? new Date(recording.endTime) : new Date()
    )
  }

  return data({
    recording,
    barks,
    barksAggregatedByMinute,
  })
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const formAction = formData.get('_action')?.toString()

  return data({})
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { recording, barksAggregatedByMinute, barks } = loaderData

  //TODO: create a hook for revalidating the data from an SSE event
  return (
    <div className='pb-24'>
      <Heading>Recording {recording.id}</Heading>
      <div className='alert alert-soft my-4'>
        <span>View a recordings details.</span>
      </div>

      <div className='grid grid-cols-2 my-4 gap-4'>
        <span className='text-base-content/60'>status</span>
        <span
          className={twMerge(
            'badge font-mono',
            recording.status === 'completed' ? 'badge-success' : 'badge-warning'
          )}
        >
          {loaderData.recording.status}
        </span>
        <span className='text-base-content/60'>device</span>
        <span>device-name</span>
        <span className='text-base-content/60'>created</span>
        <span>{recording.startTime}</span>
        <span className='text-base-content/60'>ended</span>
        <span>{recording.endTime}</span>
      </div>

      <div className='grid grid-cols-3 gap-8 my-4'>
        <Card className='bg-base-200'>
          <CardContent>
            <CardTitle>Barks</CardTitle>
            <span>{barks.length}</span>
          </CardContent>
        </Card>
        <Card className='bg-base-200'>
          <CardContent>
            <CardTitle>Last Barked</CardTitle>
            <span>3 minutes ago</span>
          </CardContent>
        </Card>
        <Card className='bg-base-200'>
          <CardContent>
            <CardTitle>Time To First Bark</CardTitle>
            <span>10 seconds</span>
          </CardContent>
        </Card>
      </div>

      <code>This will be a live chart of the recording with SSE updates</code>
      <Card className='bg-base-200'>
        <CardContent>
          <div className='flex items-center gap-4'>
            <CardTitle>
              Barks Per Minute (<abbr title='Barks per minute'>BPM</abbr>)
            </CardTitle>
            <span className='text-sm text-base-content/60'>
              Last Updated 1 minute ago
            </span>
          </div>
          <ChartContainer
            config={{
              count: {
                label: 'Barks',
                color: '#2563eb',
              },
            }}
            className='h-96 select-none'
          >
            <BarChart accessibilityLayer data={barksAggregatedByMinute}>
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
                cursor={{
                  fillOpacity: 0.1,
                }}
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
              <CartesianGrid
                vertical={false}
                strokeOpacity={0.3}
                strokeDasharray={4}
              />
              <Bar
                isAnimationActive={false}
                dataKey='count'
                fill='var(--color-count)'
                radius={4}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Heading size={'h2'} className='mt-4'>
        Logs
      </Heading>
      <pre className='p-4 rounded shadow bg-base-200 min-h-100 h-full mt-4 w-full overflow-auto'>
        {recording.logs.map((l) => (
          <span key={l.id} className='bg-error/20 p-1 block mt-px w-full'>
            [{l.createdAt}] - {l.text}
          </span>
        ))}
      </pre>
    </div>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Error with recording ID'
  if (isRouteErrorResponse(error)) {
    message = error.data.message
  }
  return (
    <div className=''>
      <Heading>Recordings ID</Heading>
      <Link to={'/recordings'} className='btn'>
        Back
      </Link>
      <div className='alert alert-error my-4'>{message}</div>
    </div>
  )
}
