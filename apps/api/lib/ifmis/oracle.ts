import oracledb, { type Connection, type Pool } from 'oracledb';
import type { IfmisAttendanceRow } from './attendance';

let poolPromise: Promise<Pool> | null = null;

export type IfmisOracleConfig = ReturnType<typeof getIfmisOracleConfig>;

export function getIfmisOracleConfig() {
  const username = requiredEnv('IFMIS_ORACLE_USERNAME');
  const password = requiredEnv('IFMIS_ORACLE_PASSWORD');
  const host = requiredEnv('IFMIS_ORACLE_HOST');
  const port = Number(requiredEnv('IFMIS_ORACLE_PORT'));
  const serviceName = requiredEnv('IFMIS_ORACLE_SERVICE_NAME');
  const table = (process.env.IFMIS_ORACLE_TABLE?.trim() || 'TAMS_ATTENDANCE').toUpperCase();
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('IFMIS Oracle configuration is invalid');
  if (!/^[A-Z][A-Z0-9_$#]*$/.test(table)) throw new Error('IFMIS Oracle configuration is invalid');
  return { username, password, host, port, serviceName, table, connectString: `${host}:${port}/${serviceName}` };
}

export async function getIfmisOraclePool() {
  if (!poolPromise) {
    const config = getIfmisOracleConfig();
    poolPromise = oracledb.createPool({
      user: config.username,
      password: config.password,
      connectString: config.connectString,
      poolMin: 0,
      poolMax: 4,
      poolIncrement: 1,
      poolTimeout: 60,
      queueTimeout: 15_000,
    }).catch((error) => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}

export async function pushIfmisAttendanceRows(rows: IfmisAttendanceRow[], providedPool?: Pick<Pool, 'getConnection'>) {
  const config = getIfmisOracleConfig();
  const pool = providedPool ?? await getIfmisOraclePool();
  const connection = await pool.getConnection();
  try {
    await mergeRows(connection, config.table, rows);
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function ensureIfmisAttendanceTable(connection?: Connection) {
  const config = getIfmisOracleConfig();
  const ownedConnection = connection ?? await oracledb.getConnection({
    user: config.username,
    password: config.password,
    connectString: config.connectString,
  });
  try {
    const found = await ownedConnection.execute<{ TABLE_NAME: string }>(
      'SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME = :tableName',
      { tableName: config.table },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    if (!found.rows?.length) {
      await ownedConnection.execute(`
        CREATE TABLE ${config.table} (
          IFMIS_NO NUMBER,
          NATIONAL_ID VARCHAR2(100 BYTE),
          ORG_ID VARCHAR2(100 BYTE),
          FIRSTNAME VARCHAR2(100 BYTE) NOT NULL,
          FATHERNAME VARCHAR2(100 BYTE),
          GRANDNAME VARCHAR2(100 BYTE) NOT NULL,
          FIRSTNAME_AMHARIC NVARCHAR2(100),
          FATHERNAME_AMHARIC NVARCHAR2(100),
          GRANDNAME_AMHARIC NVARCHAR2(100),
          ABSENTEEISM NUMBER(10,2),
          LATE NUMBER(10,2),
          CURRENT_STATUS VARCHAR2(100 BYTE),
          APPROVED VARCHAR2(100 BYTE),
          PAY_MONTH NUMBER,
          PAY_YEAR NUMBER
        )
      `);
    }
    const indexName = uniqueIndexName(config.table);
    const indexFound = await ownedConnection.execute<{ INDEX_NAME: string }>(
      'SELECT INDEX_NAME FROM USER_INDEXES WHERE INDEX_NAME = :indexName',
      { indexName },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    if (!indexFound.rows?.length) {
      await ownedConnection.execute(`
        CREATE UNIQUE INDEX ${indexName} ON ${config.table} (
          UPPER(FIRSTNAME), NVL(UPPER(FATHERNAME), '~'), UPPER(GRANDNAME), PAY_MONTH, PAY_YEAR
        )
      `);
    }
    await ownedConnection.commit();
    return { table: config.table, created: !found.rows?.length };
  } finally {
    if (!connection) await ownedConnection.close();
  }
}

async function mergeRows(connection: Connection, table: string, rows: IfmisAttendanceRow[]) {
  const sql = `
    MERGE INTO ${table} target
    USING (
      SELECT :IFMIS_NO IFMIS_NO, :NATIONAL_ID NATIONAL_ID, :ORG_ID ORG_ID,
        :FIRSTNAME FIRSTNAME, :FATHERNAME FATHERNAME, :GRANDNAME GRANDNAME,
        :FIRSTNAME_AMHARIC FIRSTNAME_AMHARIC, :FATHERNAME_AMHARIC FATHERNAME_AMHARIC,
        :GRANDNAME_AMHARIC GRANDNAME_AMHARIC, :ABSENTEEISM ABSENTEEISM, :LATE LATE,
        :CURRENT_STATUS CURRENT_STATUS, :APPROVED APPROVED, :PAY_MONTH PAY_MONTH, :PAY_YEAR PAY_YEAR
      FROM DUAL
    ) source
    ON (
      UPPER(target.FIRSTNAME) = UPPER(source.FIRSTNAME)
      AND NVL(UPPER(target.FATHERNAME), '~') = NVL(UPPER(source.FATHERNAME), '~')
      AND UPPER(target.GRANDNAME) = UPPER(source.GRANDNAME)
      AND target.PAY_MONTH = source.PAY_MONTH AND target.PAY_YEAR = source.PAY_YEAR
    )
    WHEN MATCHED THEN UPDATE SET
      target.IFMIS_NO = source.IFMIS_NO, target.NATIONAL_ID = source.NATIONAL_ID, target.ORG_ID = source.ORG_ID,
      target.FIRSTNAME_AMHARIC = source.FIRSTNAME_AMHARIC, target.FATHERNAME_AMHARIC = source.FATHERNAME_AMHARIC,
      target.GRANDNAME_AMHARIC = source.GRANDNAME_AMHARIC, target.ABSENTEEISM = source.ABSENTEEISM,
      target.LATE = source.LATE, target.CURRENT_STATUS = source.CURRENT_STATUS, target.APPROVED = source.APPROVED
    WHEN NOT MATCHED THEN INSERT (
      IFMIS_NO, NATIONAL_ID, ORG_ID, FIRSTNAME, FATHERNAME, GRANDNAME, FIRSTNAME_AMHARIC,
      FATHERNAME_AMHARIC, GRANDNAME_AMHARIC, ABSENTEEISM, LATE, CURRENT_STATUS, APPROVED, PAY_MONTH, PAY_YEAR
    ) VALUES (
      source.IFMIS_NO, source.NATIONAL_ID, source.ORG_ID, source.FIRSTNAME, source.FATHERNAME,
      source.GRANDNAME, source.FIRSTNAME_AMHARIC, source.FATHERNAME_AMHARIC, source.GRANDNAME_AMHARIC,
      source.ABSENTEEISM, source.LATE, source.CURRENT_STATUS, source.APPROVED, source.PAY_MONTH, source.PAY_YEAR
    )`;
  await connection.executeMany(sql, rows.map(toOracleBinds), {
    autoCommit: false,
    bindDefs: {
      IFMIS_NO: { type: oracledb.DB_TYPE_NUMBER },
      NATIONAL_ID: { type: oracledb.DB_TYPE_VARCHAR, maxSize: 100 },
      ORG_ID: { type: oracledb.DB_TYPE_VARCHAR, maxSize: 100 },
      FIRSTNAME: { type: oracledb.DB_TYPE_VARCHAR, maxSize: 100 },
      FATHERNAME: { type: oracledb.DB_TYPE_VARCHAR, maxSize: 100 },
      GRANDNAME: { type: oracledb.DB_TYPE_VARCHAR, maxSize: 100 },
      FIRSTNAME_AMHARIC: { type: oracledb.DB_TYPE_NVARCHAR, maxSize: 400 },
      FATHERNAME_AMHARIC: { type: oracledb.DB_TYPE_NVARCHAR, maxSize: 400 },
      GRANDNAME_AMHARIC: { type: oracledb.DB_TYPE_NVARCHAR, maxSize: 400 },
      ABSENTEEISM: { type: oracledb.DB_TYPE_NUMBER },
      LATE: { type: oracledb.DB_TYPE_NUMBER },
      CURRENT_STATUS: { type: oracledb.DB_TYPE_VARCHAR, maxSize: 100 },
      APPROVED: { type: oracledb.DB_TYPE_VARCHAR, maxSize: 100 },
      PAY_MONTH: { type: oracledb.DB_TYPE_NUMBER },
      PAY_YEAR: { type: oracledb.DB_TYPE_NUMBER },
    },
  });
}

function toOracleBinds(row: IfmisAttendanceRow) {
  return {
    IFMIS_NO: row.ifmisNo,
    NATIONAL_ID: row.nationalId,
    ORG_ID: row.orgId,
    FIRSTNAME: row.firstName,
    FATHERNAME: row.fatherName,
    GRANDNAME: row.grandName,
    FIRSTNAME_AMHARIC: row.firstNameAmharic,
    FATHERNAME_AMHARIC: row.fatherNameAmharic,
    GRANDNAME_AMHARIC: row.grandNameAmharic,
    ABSENTEEISM: row.absenteeism,
    LATE: row.late,
    CURRENT_STATUS: row.currentStatus,
    APPROVED: row.approved,
    PAY_MONTH: row.payMonth,
    PAY_YEAR: row.payYear,
  };
}

function uniqueIndexName(table: string) {
  return `UX_${table}_PERIOD_NAME`.slice(0, 128);
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('IFMIS Oracle configuration is incomplete');
  return value;
}
