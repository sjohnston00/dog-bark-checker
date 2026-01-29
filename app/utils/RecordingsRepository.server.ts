import { type Database } from 'better-sqlite3'

export default class RecordingsRepository {
  private db: Database
  constructor(args: { db: Database }) {
    this.db = args.db
  }

  getAll() {
    const stmt = this.db.prepare(
      'SELECT * FROM recordings ORDER BY date DESC, startTime DESC'
    )
    return stmt.all()
  }

  getById(id: number) {
    const stmt = this.db.prepare('SELECT * FROM recordings WHERE id = ?')
    return stmt.get(id)
  }

  create(recording: {
    date: string
    startTime: string
    deviceId: number
    endTime?: string | null
    filePath?: string | null
    notes?: string | null
    status?: 'pending' | 'completed' | 'failed'
    modelUsed?: string | null
  }) {
    const stmt = this.db.prepare(
      `INSERT INTO recordings (date, startTime, endTime, filePath, notes, status, modelUsed, deviceId) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const result = stmt.run(
      recording.date,
      recording.startTime,
      recording.endTime || null,
      recording.filePath || null,
      recording.notes || null,
      recording.status || 'pending',
      recording.modelUsed || null,
      recording.deviceId
    )
    return result.lastInsertRowid as number
  }

  update(
    id: number,
    updates: {
      endTime?: string | null
      filePath?: string | null
      notes?: string | null
      status?: 'pending' | 'completed' | 'cancelled'
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
    return this.getById(id)
  }

  delete(id: number) {
    const stmt = this.db.prepare('DELETE FROM recordings WHERE id = ?')
    stmt.run(id)
  }
}
