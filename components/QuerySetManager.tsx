import React, { useState, useRef, useEffect } from 'react';
import { TestQuery, Exam } from '../lib/types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  queries: TestQuery[];
  exams: Exam[];
  examId: string;
  selectedStage: string;
  selectedQueryIds: Set<string>;
  onQueriesChange: (queries: TestQuery[]) => void;
  onSelectionChange: (ids: Set<string>) => void;
}

const BASE_CATEGORIES = [
  '정답', '배점', '등급컷', '정오답률', '난이도',
  '선지별 선택비율', '해설강의', '총평', '라이브 설명회',
  '다시보기', '풀서비스 경로', '예외/방어',
];

const EMPTY_QUERY = (examId: string): TestQuery => ({
  query_id: uuidv4(),
  exam_id: examId,
  category: '정답',
  sub_category: '',
  query_text: '',
  note: '',
});

export default function QuerySetManager({
  queries, exams, examId, selectedStage, selectedQueryIds, onQueriesChange, onSelectionChange,
}: Props) {
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [filterCat, setFilterCat] = useState('');
  const [filterExam, setFilterExam] = useState(true);
  const [filterExamId, setFilterExamId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<TestQuery | null>(null);
  const [form, setForm] = useState<TestQuery>(EMPTY_QUERY(examId));
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [previewQueries, setPreviewQueries] = useState<TestQuery[] | null>(null);
  const [showGSheetInput, setShowGSheetInput] = useState(false);
  const [gsheetUrl, setGsheetUrl] = useState('');
  const [gsheetLoading, setGsheetLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const masterCheckRef = useRef<HTMLInputElement>(null);

  const extraCategories = Array.from(new Set(queries.map((q) => q.category).filter((c) => c && !BASE_CATEGORIES.includes(c)))).sort();
  const categoryOptions = [...BASE_CATEGORIES, ...extraCategories];

  const apiPost = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/save-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const filtered = queries.filter((q) => {
    if (filterExam) {
      if (q.exam_id !== examId) return false;
    } else if (filterExamId) {
      if (q.exam_id !== filterExamId) return false;
    }
    if (filterCat && q.category !== filterCat) return false;
    return true;
  });

  const handleFilterExamChange = (checked: boolean) => {
    setFilterExam(checked);
    setCurrentPage(1);
    if (checked) {
      setFilterExamId(examId);
    }
  };

  const handleFilterExamIdChange = (value: string) => {
    setFilterExamId(value);
    setFilterExam(value === examId);
    setCurrentPage(1);
  };

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_QUERY(examId));
    setShowForm(true);
  };

  const openEdit = (q: TestQuery) => {
    setEditTarget(q);
    setForm({ ...q });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.category) return alert('유형을 선택하세요.');
    if (!form.query_text.trim()) return alert('질의 내용을 입력하세요.');
    const data = await apiPost({ action: editTarget ? 'update' : 'add', query: form });
    onQueriesChange(data.queries);
    setShowForm(false);
  };

  const handleDelete = async (q: TestQuery) => {
    if (!confirm(`질의를 삭제하시겠습니까?\n"${q.query_text}"`)) return;
    const data = await apiPost({ action: 'delete', query: q });
    onQueriesChange(data.queries);
  };

  const normalizeExamIds = (parsedQueries: TestQuery[]) =>
    parsedQueries.map((q) => {
      const matched = exams.find((ex) => ex.exam_name === q.exam_id || ex.exam_id === q.exam_id);
      return matched ? { ...q, exam_id: matched.exam_id } : q;
    });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErrors([]);
    setPreviewQueries(null);
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const base64 = btoa(Array.from(uint8).map((b) => String.fromCharCode(b)).join(''));
    const data = await apiPost({ action: 'upload', fileBase64: base64, exam_id: examId });
    if (data.errors?.length > 0 && !data.queries?.length) {
      setUploadErrors(data.errors);
      return;
    }
    setPreviewQueries(normalizeExamIds(data.queries || []));
    setUploadErrors(data.errors || []);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleGSheetImport = async () => {
    if (!gsheetUrl.trim()) return alert('구글 시트 URL을 입력하세요.');
    setGsheetLoading(true);
    setUploadErrors([]);
    setPreviewQueries(null);
    const data = await apiPost({ action: 'import_gsheet', url: gsheetUrl.trim(), exam_id: examId });
    setGsheetLoading(false);
    if (data.errors?.length > 0 && !data.queries?.length) {
      setUploadErrors(data.errors);
      return;
    }
    setPreviewQueries(normalizeExamIds(data.queries || []));
    setUploadErrors(data.errors || []);
    setShowGSheetInput(false);
    setGsheetUrl('');
  };

  const handleSavePreview = async () => {
    if (!previewQueries) return;
    const data = await apiPost({ action: 'bulk', queries: previewQueries });
    onQueriesChange(data.queries);
    setPreviewQueries(null);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const allPageSelected = paginated.length > 0 && paginated.every((q) => selectedQueryIds.has(q.query_id));
  const somePageSelected = paginated.some((q) => selectedQueryIds.has(q.query_id));

  useEffect(() => {
    if (masterCheckRef.current) {
      masterCheckRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedQueryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const selectAll = () => {
    const allIds = new Set(filtered.map((q) => q.query_id));
    onSelectionChange(allIds);
  };

  const clearAll = () => onSelectionChange(new Set());

  const handleDeleteSelected = async () => {
    const targets = filtered.filter((q) => selectedQueryIds.has(q.query_id));
    if (targets.length === 0) return;
    if (!confirm(`선택한 ${targets.length}건의 질의를 삭제하시겠습니까?`)) return;
    const data = await apiPost({
      action: 'delete_selected',
      query_ids: targets.map((q) => q.query_id),
    });
    onQueriesChange(data.queries);
    onSelectionChange(new Set());
  };

  const handleDeleteAll = async () => {
    if (!confirm(`질의 전체 ${queries.length}건을 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    const data = await apiPost({ action: 'delete_all' });
    onQueriesChange(data.queries);
    onSelectionChange(new Set());
  };

  return (
    <section className="section">
      <div className="section-header">
        <h2>3. 테스트 질의 세트 관리</h2>
        <div className="btn-group">
          <button className="btn" onClick={() => fileRef.current?.click()}>엑셀/CSV 업로드</button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
          <button
            className={`btn${showGSheetInput ? ' btn-primary' : ''}`}
            onClick={() => { setShowGSheetInput((v) => !v); setUploadErrors([]); }}
          >
            구글 시트
          </button>
          <button className="btn btn-primary" onClick={openAdd}>+ 직접 추가</button>
        </div>
      </div>

      {showGSheetInput && (
        <div className="gsheet-input-bar">
          <input
            type="text"
            className="gsheet-url-input"
            placeholder="구글 시트 URL을 붙여넣으세요 (공개 공유 상태여야 합니다)"
            value={gsheetUrl}
            onChange={(e) => setGsheetUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGSheetImport()}
          />
          <button className="btn btn-primary btn-sm" onClick={handleGSheetImport} disabled={gsheetLoading}>
            {gsheetLoading ? '가져오는 중...' : '가져오기'}
          </button>
          <button className="btn btn-sm" onClick={() => { setShowGSheetInput(false); setGsheetUrl(''); }}>취소</button>
        </div>
      )}

      {uploadErrors.length > 0 && (
        <div className="alert alert-error">
          <strong>업로드 오류</strong>
          <ul>{uploadErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      {previewQueries && (
        <div className="preview-box">
          <h4>업로드 미리보기 ({previewQueries.length}건)</h4>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>query_id</th><th>category</th><th>질의</th>
                </tr>
              </thead>
              <tbody>
                {previewQueries.map((q) => (
                  <tr key={q.query_id}>
                    <td>{q.query_id}</td>
                    <td>{q.category}</td>
                    <td>{q.query_text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={handleSavePreview}>저장</button>
            <button className="btn" onClick={() => setPreviewQueries(null)}>취소</button>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <label>
          현재 회차만
          <input
            type="checkbox"
            checked={filterExam}
            onChange={(e) => handleFilterExamChange(e.target.checked)}
          />
        </label>
        <select
          value={filterExam ? examId : filterExamId}
          onChange={(e) => handleFilterExamIdChange(e.target.value)}
        >
          <option value="">전체 회차</option>
          {exams.map((ex) => (
            <option key={ex.exam_id} value={ex.exam_id}>{ex.exam_name}</option>
          ))}
        </select>
        <select value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setCurrentPage(1); }}>
          <option value="">전체 유형</option>
          {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn btn-sm" onClick={selectAll}>전체 선택</button>
        <button className="btn btn-sm" onClick={clearAll}>선택 해제</button>
        <span className="count-badge">{selectedQueryIds.size}건 선택 / {filtered.length}건 표시</span>
        <div className="filter-bar-actions">
          <button
            className="btn btn-sm btn-danger"
            onClick={handleDeleteSelected}
            disabled={filtered.filter((q) => selectedQueryIds.has(q.query_id)).length === 0}
          >
            선택 삭제{filtered.filter((q) => selectedQueryIds.has(q.query_id)).length > 0 && ` (${filtered.filter((q) => selectedQueryIds.has(q.query_id)).length}건)`}
          </button>
          <button
            className="btn btn-sm btn-danger-outline"
            onClick={handleDeleteAll}
            disabled={queries.length === 0}
          >
            전체 삭제
          </button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  ref={masterCheckRef}
                  checked={allPageSelected}
                  onChange={() => {
                    const next = new Set(selectedQueryIds);
                    if (allPageSelected) {
                      paginated.forEach((q) => next.delete(q.query_id));
                    } else {
                      paginated.forEach((q) => next.add(q.query_id));
                    }
                    onSelectionChange(next);
                  }}
                  title={allPageSelected ? '이 페이지 해제' : '이 페이지 선택'}
                />
              </th>
              <th>시험 회차</th>
              <th>유형</th>
              <th>세부유형</th>
              <th>질의</th>
              <th>비고</th>
              <th>수정</th>
              <th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((q) => (
              <tr key={q.query_id} className={selectedQueryIds.has(q.query_id) ? 'row-selected' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedQueryIds.has(q.query_id)}
                    onChange={() => toggleSelect(q.query_id)}
                  />
                </td>
                <td>{exams.find((ex) => ex.exam_id === q.exam_id)?.exam_name ?? q.exam_id}</td>
                <td>{q.category}</td>
                <td>{q.sub_category}</td>
                <td className="cell-query">{q.query_text}</td>
                <td>{q.note}</td>
                <td><button className="btn btn-sm" onClick={() => openEdit(q)}>수정</button></td>
                <td><button className="btn btn-sm btn-danger" onClick={() => handleDelete(q)}>삭제</button></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="no-data">질의가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>이전</button>
          <span className="pagination-info">{currentPage} / {totalPages} 페이지 (총 {filtered.length}건)</span>
          <button className="btn btn-sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>다음</button>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal modal-wide">
            <h3>{editTarget ? '질의 수정' : '질의 추가'}</h3>
            <div className="form-row">
              <label>유형 *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>세부유형</label>
              <input value={form.sub_category} onChange={(e) => setForm({ ...form, sub_category: e.target.value })} />
            </div>
            <div className="form-row">
              <label>질의 내용 *</label>
              <textarea rows={3} value={form.query_text} onChange={(e) => setForm({ ...form, query_text: e.target.value })} />
            </div>
            <div className="form-row">
              <label>비고</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleSubmit}>저장</button>
              <button className="btn" onClick={() => setShowForm(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
