import * as XLSX from 'xlsx';
import { SearchResult, ExecutionLog, TestQuery, TimelineStage } from './types';
import { format } from 'date-fns';

export function buildExcelBuffer(
  results: SearchResult[],
  logs: ExecutionLog[],
  queries: TestQuery[],
  timelines: Record<string, TimelineStage[]>,
): Buffer {
  const wb = XLSX.utils.book_new();

  // 수집_결과
  const resultRows = results.map((r) => ({
    run_id: r.run_id,
    exam_id: r.exam_id,
    exam_name: r.exam_name,
    stage_name: r.stage_name,
    query_id: r.query_id,
    category: r.category,
    query_text: r.query_text,
    answer_title: r.answer_title,
    answer_text: r.answer_text,
    answer_html: r.answer_html,
    source_links: r.source_links,
    executed_at: r.executed_at,
    collection_status: r.collection_status,
    error_message: r.error_message,
    elapsed_seconds: r.elapsed_seconds,
  }));
  const ws1 = XLSX.utils.json_to_sheet(resultRows);
  XLSX.utils.book_append_sheet(wb, ws1, '수집_결과');

  // 실행_로그
  const logRows = logs.map((l) => ({
    run_id: l.run_id,
    query_id: l.query_id,
    query_text: l.query_text,
    execution_order: l.execution_order,
    started_at: l.started_at,
    ended_at: l.ended_at,
    elapsed_seconds: l.elapsed_seconds,
    collection_status: l.collection_status,
    error_message: l.error_message,
  }));
  const ws2 = XLSX.utils.json_to_sheet(logRows);
  XLSX.utils.book_append_sheet(wb, ws2, '실행_로그');

  // 테스트_질의세트
  const queryRows = queries.map((q) => ({
    query_id: q.query_id,
    exam_id: q.exam_id,
    category: q.category,
    sub_category: q.sub_category,
    query_text: q.query_text,
    note: q.note,
  }));
  const ws3 = XLSX.utils.json_to_sheet(queryRows);
  XLSX.utils.book_append_sheet(wb, ws3, '테스트_질의세트');

  // 시험별_타임라인
  const timelineRows: Record<string, unknown>[] = [];
  for (const stages of Object.values(timelines)) {
    for (const s of stages) {
      timelineRows.push({
        exam_id: s.exam_id,
        stage_order: s.stage_order,
        stage_name: s.stage_name,
        expected_time: s.expected_time,
        actual_time: s.actual_time,
        active_yn: s.active_yn ? 'Y' : 'N',
        note: s.note,
      });
    }
  }
  const ws4 = XLSX.utils.json_to_sheet(timelineRows);
  XLSX.utils.book_append_sheet(wb, ws4, '시험별_타임라인');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buf;
}

export function generateFileName(): string {
  return `fullservice_ai_search_results_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
}
