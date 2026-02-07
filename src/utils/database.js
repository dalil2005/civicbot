const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, '../../points.db'), (err) => {
            if (err) console.error('DB error:', err);
            else this.initDatabase();
        });
    }

    initDatabase() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS members (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                points INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    async upsertMember(id, username) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO members (id, username, points, last_updated) 
                 VALUES (?, ?, COALESCE((SELECT points FROM members WHERE id = ?), 0), CURRENT_TIMESTAMP)`,
                [id, username, id],
                (err) => err ? reject(err) : resolve()
            );
        });
    }

    async updatePoints(userId, pointsChange) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE members SET points = points + ?, last_updated = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [pointsChange, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    async getMember(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM members WHERE id = ?`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });
    }

    async getStandings() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM members ORDER BY points DESC`,
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });
    }

    async getRankPosition(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT COUNT(*) + 1 as rank FROM members 
                 WHERE points > (SELECT points FROM members WHERE id = ?)`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row ? row.rank : 1)
            );
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = new Database();
