import { type Database } from 'better-sqlite3'
import { type Device } from '~/utils/db.server'

export default class DevicesRepository {
  private db: Database
  constructor(args: { db: Database }) {
    this.db = args.db
  }

  create(args: { name: string; rtspUrl: string }) {
    const stmt = this.db.prepare(
      'INSERT INTO devices (name, rtspUrl) VALUES (?, ?)'
    )
    const info = stmt.run(args.name, args.rtspUrl)
    return info.lastInsertRowid as number
  }

  getAll() {
    const stmt = this.db.prepare<[], Device>('SELECT * FROM devices')
    return stmt.all()
  }

  getById(id: number) {
    const stmt = this.db.prepare<[number], Device>(
      'SELECT * FROM devices WHERE id = ?'
    )
    return stmt.get(id)
  }

  updateById(
    id: number,
    args: { name?: string; rtspUrl?: string; enabled?: boolean }
  ) {
    const fields = []
    const values = []
    if (args.name !== undefined) {
      fields.push('name = ?')
      values.push(args.name)
    }
    if (args.rtspUrl !== undefined) {
      fields.push('rtspUrl = ?')
      values.push(args.rtspUrl)
    }
    if (args.enabled !== undefined) {
      fields.push('enabled = ?')
      values.push(args.enabled ? 1 : 0)
    }
    if (fields.length === 0) {
      return 0
    }
    values.push(id)
    const stmt = this.db.prepare<any[], Device>(
      `UPDATE devices SET ${fields.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`
    )
    const info = stmt.run(...values)
    return info.changes
  }

  deleteById(id: number) {
    const stmt = this.db.prepare('DELETE FROM devices WHERE id = ?')
    const info = stmt.run(id)
    return info.changes
  }
}
