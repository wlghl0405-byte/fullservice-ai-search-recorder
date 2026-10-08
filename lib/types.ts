export interface Exam {
  exam_id: string;
  exam_name: string;
  exam_type: '학력평가' | '모의평가' | '수능';
  exam_month: number;
  year: number;
  active_yn: boolean;
}

export interface TimelineStage {
  timeline_id: string;
  exam_id: string;
  stage_order: number;
  stage_name: string;
  expected_time: string;
  actual_time: string;
  note: string;
  active_yn: boolean;
}

export interface TestQuery {
  query_id: string;
  exam_id: string;
  category: QueryCategory;
  sub_category: string;
  query_text: string;
  note: string;
  target_stage?: string;
  poc_yn?: boolean;
}

export type QueryCategory = string;

export interface SourceLink {
  text: string;
  href: string;
}

export type VerdictStatus = '통과' | '수정 필요' | '재검수 필요' | '미판정';

export type VerdictErrorType =
  | '미공개_정보_확정_안내'
  | '필수_문구_누락'
  | '풀서비스_링크_누락'
  | '테이블_형식_누락'
  | '산출기준_누락'
  | '산출기준_불필요'
  | '용어_오류'
  | '시험_범위_오류'
  | '절대평가_오류'
  | '개인화_데이터_오류'
  | '구조_불적절'
  | '기타';

export interface VerdictIssue {
  error_type: VerdictErrorType;
  rubric_point: string;
  description: string;
  correction_request: string;
}

export interface VerdictResult {
  verdict_status: VerdictStatus;
  issues: VerdictIssue[];
  verdict_at: string;
  verdict_note?: string;
  collection_failure?: boolean;
}

export interface SearchResult {
  run_id: string;
  exam_id: string;
  exam_name: string;
  stage_name: string;
  query_id: string;
  category: string;
  query_text: string;
  answer_title: string;
  answer_text: string;
  answer_html: string;
  source_links: string;
  executed_at: string;
  collection_status: '수집 성공' | '수집 실패';
  error_message: string;
  elapsed_seconds: number;
  verdict?: VerdictResult;
}

export interface ExecutionLog {
  run_id: string;
  query_id: string;
  query_text: string;
  execution_order: number;
  started_at: string;
  ended_at: string;
  elapsed_seconds: number;
  collection_status: '수집 성공' | '수집 실패';
  error_message: string;
}

export interface SearchRunRequest {
  exam_id: string;
  exam_name: string;
  stage_name: string;
  queries: TestQuery[];
}

export interface SearchRunResponse {
  success: boolean;
  results: SearchResult[];
  logs: ExecutionLog[];
  error?: string;
}

export interface SavedData {
  exam_timelines: Record<string, TimelineStage[]>;
  test_queries: TestQuery[];
  search_results: SearchResult[];
  execution_logs: ExecutionLog[];
}
