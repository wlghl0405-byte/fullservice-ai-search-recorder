import fs from 'fs';
import path from 'path';
import { TimelineStage, TestQuery, SearchResult, ExecutionLog } from './types';

const DATA_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'saved')
  : path.join(process.cwd(), 'data', 'saved');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON<T>(filename: string, fallback: T): T {
  ensureDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(filename: string, data: unknown) {
  ensureDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Timeline
export function loadTimelines(): Record<string, TimelineStage[]> {
  return readJSON<Record<string, TimelineStage[]>>('exam_timelines.json', {});
}

export function saveTimelines(data: Record<string, TimelineStage[]>) {
  writeJSON('exam_timelines.json', data);
}

// Queries
export function loadQueries(): TestQuery[] {
  return readJSON<TestQuery[]>('test_queries.json', []);
}

export function saveQueries(data: TestQuery[]) {
  writeJSON('test_queries.json', data);
}

// Results
export function loadResults(): SearchResult[] {
  return readJSON<SearchResult[]>('search_results.json', []);
}

export function saveResults(data: SearchResult[]) {
  writeJSON('search_results.json', data);
}

// Logs
export function loadLogs(): ExecutionLog[] {
  return readJSON<ExecutionLog[]>('execution_logs.json', []);
}

export function saveLogs(data: ExecutionLog[]) {
  writeJSON('execution_logs.json', data);
}

// Verdict: run_id+query_id 기준으로 판정 결과를 업데이트
export function saveVerdictForResult(
  run_id: string,
  query_id: string,
  verdict: import('./types').VerdictResult,
  collectionStatus?: '수집 성공' | '수집 실패',
) {
  const results = loadResults();
  const idx = results.findIndex((r) => r.run_id === run_id && r.query_id === query_id);
  if (idx >= 0) {
    results[idx] = {
      ...results[idx],
      verdict,
      ...(collectionStatus !== undefined ? { collection_status: collectionStatus } : {}),
    };
    saveResults(results);
  }
}
