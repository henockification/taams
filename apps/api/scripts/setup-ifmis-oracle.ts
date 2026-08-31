import 'dotenv/config';
import { ensureIfmisAttendanceTable } from '../lib/ifmis/oracle';

try {
  const result = await ensureIfmisAttendanceTable();
  console.log(result.created ? `Created Oracle table ${result.table}` : `Oracle table ${result.table} is ready`);
} catch (error) {
  console.error('IFMIS Oracle setup failed');
  process.exitCode = 1;
}
