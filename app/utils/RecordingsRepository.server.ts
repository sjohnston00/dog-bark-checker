import { type Database } from 'better-sqlite3'

export default class RecordingsRepository {
  private db: Database
  constructor(args: { db: Database }) {
    this.db = args.db
  }

  getAllRecordings() {
    const stmt = this.db.prepare(
      'SELECT * FROM recordings ORDER BY date DESC, startTime DESC'
    )
    return stmt.all()
  }

  getRecordingById(id: number) {
    const stmt = this.db.prepare('SELECT * FROM recordings WHERE id = ?')
    return stmt.get(id)
  }

  addRecording(recording: {
    date: string
    startTime: string
    endTime?: string | null
    filePath?: string | null
    notes?: string | null
    status?: 'pending' | 'completed' | 'failed'
    modelUsed?: string | null
  }) {
    const stmt = this.db.prepare(
      `INSERT INTO recordings (date, startTime, endTime, filePath, notes, status, modelUsed) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const result = stmt.run(
      recording.date,
      recording.startTime,
      recording.endTime || null,
      recording.filePath || null,
      recording.notes || null,
      recording.status || 'pending',
      recording.modelUsed || null
    )
    return this.getRecordingById(result.lastInsertRowid as number)
  }

  updateRecording(
    id: number,
    updates: {
      endTime?: string | null
      filePath?: string | null
      notes?: string | null
      status?: 'pending' | 'completed' | 'failed'
      modelUsed?: string | null
    }
  ) {
    const fields = []
    const values = []
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }
    values.push(id)
    const stmt = this.db.prepare(
      `UPDATE recordings SET ${fields.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`
    )
    stmt.run(...values)
    return this.getRecordingById(id)
  }

  deleteRecording(id: number) {
    const stmt = this.db.prepare('DELETE FROM recordings WHERE id = ?')
    stmt.run(id)
  }
}
