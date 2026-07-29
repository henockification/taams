import * as XLSX from 'xlsx';
import type { CreateEmployeeInput, EmploymentStatus } from '../../types/core.types';

export type ExcelEmployeeRow = Record<string, unknown>;

export type PermanentEmployeeImportInput = CreateEmployeeInput & {
  sourceDepartmentName: string;
  sourcePositionName?: string | null;
  sourcePositionCode?: string | null;
};

export type MappedEmployeeRow = {
  rowNumber: number;
  input?: PermanentEmployeeImportInput;
  errors: string[];
};

type FieldKey =
  | 'department'
  | 'fullNameEn'
  | 'idNo'
  | 'employeeStatus'
  | 'gender'
  | 'date'
  | 'position'
  | 'code'
  | 'salary'
  | 'step'
  | 'mobile'
  | 'email';

export const EMPLOYEE_EXCEL_HEADER_ALIASES: Record<FieldKey, string[]> = {
  department: ['department', 'dept', 'department name'],
  fullNameEn: ['full name < english', 'full name english', 'full name', 'fullname', 'fullName', 'full_name', 'name english', 'employee name'],
  idNo: ['employee id no', 'employee id no.', 'employee id number', 'employee id', 'id no', 'id no.', 'id number', 'employee no'],
  employeeStatus: ['employee status', 'employment status', 'status'],
  gender: ['gender', 'sex'],
  date: ['date', 'hire date', 'employment date', 'start date'],
  position: ['position', 'job title', 'job position'],
  code: ['code', 'position code', 'employee code'],
  salary: ['salary', 'monthly salary', 'base salary'],
  step: ['step', 'salary step', 'grade step'],
  mobile: ['mobile', 'mobile number', 'phone', 'phone number'],
  email: ['email', 'email address', 'work email'],
};

const ACTIVE_STATUS_VALUES = new Set(['active', 'permanent', 'working', 'on duty', 'employed']);
const INACTIVE_STATUS_VALUES = new Set(['inactive', 'not active']);
const TERMINATED_STATUS_VALUES = new Set(['terminated', 'termination', 'separated', 'resigned', 'retired']);
const SUSPENDED_STATUS_VALUES = new Set(['suspended', 'suspension']);

export function parseEmployeeWorkbook(fileBuffer: Buffer, fileName: string): ExcelEmployeeRow[] {
  if (!/\.(xlsx|xls)$/i.test(fileName)) {
    throw new Error('Only .xls and .xlsx files are supported');
  }

  const workbook = XLSX.read(fileBuffer, {
    type: 'buffer',
    cellDates: true,
    raw: true,
  });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('Workbook does not contain any worksheets');
  }

  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<ExcelEmployeeRow>(sheet, {
    defval: null,
    raw: true,
  });
}

export function mapExcelRowToEmployeeInput(row: ExcelEmployeeRow, rowNumber: number): MappedEmployeeRow {
  const errors: string[] = [];
  const sourceIdNo = readString(row, 'idNo');
  const fullName = readString(row, 'fullNameEn');
  const departmentName = readString(row, 'department');
  const sourceStatus = readString(row, 'employeeStatus');
  const sourceEmployeeCode = readString(row, 'code');
  const positionName = readString(row, 'position');
  const salary = readSalary(row, errors);
  const hireDate = readDate(row, errors);
  const employmentStatus = mapEmploymentStatus(sourceStatus);
  const nameParts = splitFullName(fullName, errors);

  if (!sourceIdNo) errors.push('Employee Id No is required');
  if (!departmentName) errors.push('Department is required');

  if (errors.length > 0 || !sourceIdNo || !departmentName || !nameParts) {
    return { rowNumber, errors };
  }

  return {
    rowNumber,
    errors: [],
    input: {
      employeeCode: sourceIdNo,
      payrollId: null,
      biometricId: null,
      firstNameEn: nameParts.firstNameEn,
      middleNameEn: nameParts.middleNameEn,
      lastNameEn: nameParts.lastNameEn,
      gender: readString(row, 'gender') || null,
      phoneNumber: readString(row, 'mobile') || null,
      email: readString(row, 'email') || null,
      departmentId: '',
      positionId: null,
      positionName: positionName || null,
      employmentStatus,
      employmentType: 'PERMANENT',
      hireDate,
      terminationDate: null,
      sourceIdNo,
      sourceEmployeeCode: sourceEmployeeCode || null,
      sourceEmploymentStatus: sourceStatus || null,
      sourceDepartmentName: departmentName,
      sourcePositionName: positionName || null,
      sourcePositionCode: sourceEmployeeCode || null,
      salary,
      salaryStep: readString(row, 'step') || null,
      sourceImportedAt: new Date(),
      sourceRawPayload: normalizeRawPayload(row),
      isActive: employmentStatus === 'ACTIVE',
    },
  };
}

function readString(row: ExcelEmployeeRow, field: FieldKey) {
  const normalizedEntries = Object.entries(row).map(([header, value]) => ({
    header: normalizeHeader(header),
    value,
  }));

  for (const alias of EMPLOYEE_EXCEL_HEADER_ALIASES[field]) {
    const normalizedAlias = normalizeHeader(alias);
    const found = normalizedEntries.find((entry) => entry.header === normalizedAlias);
    if (found) {
      return stringifyCell(found.value);
    }
  }

  return '';
}

function readSalary(row: ExcelEmployeeRow, errors: string[]) {
  const value = readString(row, 'salary').replace(/,/g, '');
  if (!value) return null;

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    errors.push('Salary must be a valid non-negative number');
    return null;
  }

  return numericValue.toFixed(2);
}

function readDate(row: ExcelEmployeeRow, errors: string[]) {
  const rawValue = readRaw(row, 'date');
  if (rawValue === null || rawValue === undefined || rawValue === '') return null;

  if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
    return formatIsoDate(rawValue);
  }

  if (typeof rawValue === 'number') {
    const parsed = XLSX.SSF.parse_date_code(rawValue);
    if (parsed) {
      return formatIsoDate(new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)));
    }
  }

  const value = stringifyCell(rawValue);
  if (!value) return null;

  const parsedDate = parseDateString(value);
  if (!parsedDate) {
    errors.push('Date must be a valid date');
    return null;
  }

  return parsedDate;
}

function readRaw(row: ExcelEmployeeRow, field: FieldKey) {
  const normalizedEntries = Object.entries(row).map(([header, value]) => ({
    header: normalizeHeader(header),
    value,
  }));

  for (const alias of EMPLOYEE_EXCEL_HEADER_ALIASES[field]) {
    const normalizedAlias = normalizeHeader(alias);
    const found = normalizedEntries.find((entry) => entry.header === normalizedAlias);
    if (found) {
      return found.value;
    }
  }

  return null;
}

function mapEmploymentStatus(value: string): EmploymentStatus {
  const normalized = value.trim().toLowerCase();
  if (!normalized || ACTIVE_STATUS_VALUES.has(normalized) || normalized.includes('active')) return 'ACTIVE';
  if (INACTIVE_STATUS_VALUES.has(normalized)) return 'INACTIVE';
  if (TERMINATED_STATUS_VALUES.has(normalized)) return 'TERMINATED';
  if (SUSPENDED_STATUS_VALUES.has(normalized)) return 'SUSPENDED';

  return 'ACTIVE';
}

function splitFullName(fullName: string, errors: string[]) {
  const parts = fullName.split(/\s+/).map((part) => part.trim()).filter(Boolean);

  if (parts.length === 0) {
    errors.push('Full Name < English is required');
    return null;
  }

  if (parts.length === 1) {
    return { firstNameEn: parts[0], middleNameEn: null, lastNameEn: parts[0] };
  }

  if (parts.length === 2) {
    return { firstNameEn: parts[0], middleNameEn: null, lastNameEn: parts[1] };
  }

  return {
    firstNameEn: parts[0],
    middleNameEn: parts.slice(1, -1).join(' '),
    lastNameEn: parts[parts.length - 1],
  };
}

function parseDateString(value: string) {
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return formatDateParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const yearValue = Number(slashMatch[3]);
    const year = yearValue < 100 ? 2000 + yearValue : yearValue;
    return formatDateParts(year, month, day);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatIsoDate(parsed);
}

function formatDateParts(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return formatIsoDate(date);
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeHeader(header: string) {
  return header
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatIsoDate(value);
  return String(value).trim();
}

function normalizeRawPayload(row: ExcelEmployeeRow) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])
  );
}
