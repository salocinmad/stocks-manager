import sequelize from '../config/database.js'

const run = async () => {
  const dbName = sequelize.config.database
  const [rows] = await sequelize.query(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = :db
     ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
    { replacements: { db: dbName } }
  )

  const grouped = new Map()
  for (const r of rows) {
    const key = `${r.TABLE_NAME}::${r.INDEX_NAME}`
    const list = grouped.get(key) || []
    list.push(r)
    grouped.set(key, list)
  }

  const sigsByTable = new Map()
  for (const [key, list] of grouped.entries()) {
    const table = list[0].TABLE_NAME
    const idx = list[0].INDEX_NAME
    const nonUnique = list[0].NON_UNIQUE
    const cols = list.sort((a,b)=>a.SEQ_IN_INDEX-b.SEQ_IN_INDEX).map(x=>x.COLUMN_NAME).join(',')
    const sig = `${cols}::${nonUnique}`
    const tmap = sigsByTable.get(table) || new Map()
    const arr = tmap.get(sig) || []
    arr.push(idx)
    tmap.set(sig, arr)
    sigsByTable.set(table, tmap)
  }

  const toDrop = []
  for (const [table, tmap] of sigsByTable.entries()) {
    for (const [sig, arr] of tmap.entries()) {
      const keep = arr[0]
      for (let i = 1; i < arr.length; i++) {
        const idx = arr[i]
        if (idx !== 'PRIMARY') toDrop.push({ table, idx })
      }
    }
  }

  const dupUsersUsername = []
  const [userIdxRows] = await sequelize.query(
    `SELECT INDEX_NAME, NON_UNIQUE
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'Users'
     GROUP BY INDEX_NAME, NON_UNIQUE`,
    { replacements: { db: dbName } }
  )
  for (const r of userIdxRows) {
    if (r.NON_UNIQUE === 0 && r.INDEX_NAME.toLowerCase().includes('username')) {
      dupUsersUsername.push(r.INDEX_NAME)
    }
  }

  const hasUsernameUnique = dupUsersUsername.length > 0
  const apply = process.argv.includes('--apply')

  console.log(`Database: ${dbName}`)
  console.log(`Planned drops: ${toDrop.length}`)
  for (const d of toDrop) console.log(`DROP INDEX ${d.idx} ON ${d.table}`)
  console.log(`Users.username hasUnique: ${hasUsernameUnique}`)

  if (!apply) return

  for (const d of toDrop) {
    await sequelize.query(`ALTER TABLE \`${d.table}\` DROP INDEX \`${d.idx}\``)
  }

  if (!hasUsernameUnique) {
    await sequelize.query(`ALTER TABLE \`Users\` ADD UNIQUE \`users_username_unique\` (\`username\`)`)
  }

  console.log('Done')
}

run().then(()=>process.exit(0)).catch((e)=>{ console.error(e); process.exit(1) })

