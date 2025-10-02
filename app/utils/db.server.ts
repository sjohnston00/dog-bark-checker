import Database from "better-sqlite3";

const db = new Database("bark_detections.db", {
  verbose: console.log,
});
db.pragma("journal_mode = WAL");
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
        )`);

export default db;
