import Database from 'better-sqlite3'

const db = new Database('bark_detections.db', {})
db.pragma('journal_mode = WAL')
db.exec(`CREATE TABLE IF NOT EXISTS detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            confidence REAL NOT NULL,
            duration REAL,
            source TEXT NOT NULL,
            model_used TEXT,
            audio_features TEXT,
            ensemble_info TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)

db.exec(`CREATE TABLE IF NOT EXISTS time_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)

db.exec(`CREATE TABLE IF NOT EXISTS recordings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            startTime TEXT NOT NULL,
            endTime TEXT,
            filePath TEXT,
            notes TEXT,
            status TEXT DEFAULT 'pending',
            modelUsed TEXT,
            deviceId INTEGER NOT NULL,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)

db.exec(`CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            rtspUrl TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            enabled INTEGER DEFAULT 1
        )`)

db.exec(`CREATE TABLE IF NOT EXISTS recording_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recordingId INTEGER NOT NULL,
            text TEXT NOT NULL,
            level TEXT NOT NULL DEFAULT 'stdout',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY(recordingId) REFERENCES recordings(id)
        )`)

export type RecordingStatus = 'pending' | 'completed' | 'failed' | 'cancelled'

export type Recording = {
  id: number
  date: string
  startTime: string
  endTime: string | null
  filePath: string | null
  notes: string | null
  status: RecordingStatus
  modelUsed: string | null
  deviceId: number
  updatedAt: string
  createdAt: string
}

export type Device = {
  id: number
  name: string
  rtspUrl: string
  createdAt: string
  updatedAt: string
  enabled: number
}

export type RecordingLog = {
  id: number;
  recordingId: number;
  text: string;
  level: 'stdout' | 'stderr';
  createdAt: string;

}

export default db
