import React, { useState } from 'react';
import { Exam } from '../lib/types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  exams: Exam[];
  selectedExamId: string;
  onSelect: (exam: Exam) => void;
  onExamsChange: (exams: Exam[]) => void;
}

const EXAM_TYPES: Exam['exam_type'][] = ['학력평가', '모의평가', '수능'];

export default function ExamSelector({ exams, selectedExamId, onSelect, onExamsChange }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Exam | null>(null);
  const [form, setForm] = useState<Partial<Exam>>({
    exam_name: '', exam_type: '학력평가', exam_month: 3, year: 2026, active_yn: true,
  });

  const handleApiChange = async (action: 'add' | 'update' | 'delete', exam: Exam) => {
    const res = await fetch('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, exam }),
    });
    const data = await res.json();
    onExamsChange(data.exams);
  };

  const openAdd = () => {
    setEditTarget(null);
    setForm({ exam_name: '', exam_type: '학력평가', exam_month: 3, year: 2026, active_yn: true });
    setShowForm(true);
  };

  const openEdit = (exam: Exam) => {
    setEditTarget(exam);
    setForm({ ...exam });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.exam_name?.trim()) return alert('시험명을 입력하세요.');
    const exam: Exam = {
      exam_id: editTarget?.exam_id || `exam_${form.year}_${String(form.exam_month).padStart(2, '0')}`,
      exam_name: form.exam_name!,
      exam_type: form.exam_type!,
      exam_month: Number(form.exam_month),
      year: Number(form.year),
      active_yn: form.active_yn ?? true,
    };
    await handleApiChange(editTarget ? 'update' : 'add', exam);
    setShowForm(false);
  };

  const handleDelete = async (exam: Exam) => {
    if (!confirm(`"${exam.exam_name}" 회차를 삭제하시겠습니까?`)) return;
    await handleApiChange('delete', exam);
    if (exam.exam_id === selectedExamId && exams.length > 1) {
      const remaining = exams.filter((e) => e.exam_id !== exam.exam_id);
      if (remaining.length > 0) onSelect(remaining[0]);
    }
  };

  return (
    <section className="section">
      <div className="section-header">
        <h2>1. 시험 회차 선택</h2>
        <button className="btn btn-primary" onClick={openAdd}>+ 회차 추가</button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>선택</th>
            <th>시험명</th>
            <th>유형</th>
            <th>연도</th>
            <th>월</th>
            <th>활성</th>
            <th>수정</th>
            <th>삭제</th>
          </tr>
        </thead>
        <tbody>
          {exams.map((exam) => (
            <tr
              key={exam.exam_id}
              className={exam.exam_id === selectedExamId ? 'row-selected' : ''}
            >
              <td>
                <input
                  type="radio"
                  name="exam"
                  checked={exam.exam_id === selectedExamId}
                  onChange={() => onSelect(exam)}
                />
              </td>
              <td><strong>{exam.exam_name}</strong></td>
              <td>{exam.exam_type}</td>
              <td>{exam.year}</td>
              <td>{exam.exam_month}월</td>
              <td>{exam.active_yn ? 'Y' : 'N'}</td>
              <td>
                <button className="btn btn-sm" onClick={() => openEdit(exam)}>수정</button>
              </td>
              <td>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(exam)}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editTarget ? '회차 수정' : '회차 추가'}</h3>
            <div className="form-row">
              <label>시험명</label>
              <input value={form.exam_name || ''} onChange={(e) => setForm({ ...form, exam_name: e.target.value })} />
            </div>
            <div className="form-row">
              <label>유형</label>
              <select value={form.exam_type} onChange={(e) => setForm({ ...form, exam_type: e.target.value as Exam['exam_type'] })}>
                {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>연도</label>
              <input type="number" value={form.year || 2026} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </div>
            <div className="form-row">
              <label>월</label>
              <input type="number" min={1} max={12} value={form.exam_month || 3} onChange={(e) => setForm({ ...form, exam_month: Number(e.target.value) })} />
            </div>
            <div className="form-row">
              <label>상태</label>
              <span className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="active_yn"
                    value="Y"
                    checked={form.active_yn !== false}
                    onChange={() => setForm({ ...form, active_yn: true })}
                  />
                  활성
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="active_yn"
                    value="N"
                    checked={form.active_yn === false}
                    onChange={() => setForm({ ...form, active_yn: false })}
                  />
                  비활성
                </label>
              </span>
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
