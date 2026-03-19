import { data } from 'react-router'
import RecordingsRepository from '~/utils/RecordingsRepository.server'
import db from '~/utils/db.server'
import type { Route } from './+types/recordings.$id.sse'
import { recordingsMap } from '~/utils/recordingsMap.server'

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

  const logs = recordingsRepo.getLogs(recordingId)

  return new Response(
    logs.map((l) => `[${l.createdAt}] - [${l.level}] - ${l.text}`).join('\n'),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
      },
    }
  )
}
