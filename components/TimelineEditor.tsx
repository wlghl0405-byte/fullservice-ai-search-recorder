import React, { useState, useEffect } from 'react';
import { TimelineStage } from '../lib/types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  examId: string;
  examName: string;
  selectedStage: string;
  onStageSelect: (stage: string) => void;
}

export default function TimelineEditor({ examId, examName, selectedStage, onStageSelect }: Props) {
  const [stages, setStages] = useState<TimelineStage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!examId) return;
    setLoading(true);
    fetch(`/api/save-timeline?exam_id=${examId}`)
      .then((r) => r.json())
      .then((data) => setStages(data.stages || []))
      .finally(() => setLoading(false));
  }, [examId]);

  const persist = async (nextStages: TimelineStage[]) => {
    await fetch('/api/save-timeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exam_id: examId, stages: nextStages }),
    });
  };

  const updateStage = (index: number, field: keyof TimelineStage, value: unknown) => {
    const next = [...stages];
    next[index] = { ...next[index], [field]: value };
    setStages(next);
  };

  const saveStageOnBlur = (nextStages: TimelineStage[]) => {
    persist(nextStages);
  };

  const addStage = async () => {
    const maxOrder = stages.reduce((m, s) => Math.max(m, s.stage_order), 0);
    const next = [
      ...stages,
      {
        timeline_id: uuidv4(),
        exam_id: examId,
        stage_order: maxOrder + 1,
        stage_name: '새 단계',
        expected_time: '',
        actual_time: '',
        note: '',
        active_yn: true,
      },
    ];
    setStages(next);
    await persist(next);
  };

  const deleteStage = async (index: number) => {
    if (!confirm('이 단계를 삭제하시겠습니까?')) return;
    const next = stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, stage_order: i + 1 }));
    setStages(next);
    await persist(next);
  };

  const moveStage = async (index: number, dir: -1 | 1) => {
    const next = [...stages];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const reordered = next.map((s, i) => ({ ...s, stage_order: i + 1 }));
    setStages(reordered);
    await persist(reordered);
  };

  const handleReset = async () => {
    if (!confirm('기본 타임라인으로 초기화하시겠습니까?')) return;
    await fetch('/api/save-timeline', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exam_id: examId }),
    });
    const res = await fetch(`/api/save-timeline?exam_id=${examId}`);
    const data = await res.json();
    setStages(data.stages || []);
  };

  if (loading) return <section className="section"><p>타임라인 불러오는 중...</p></section>;

  return (
    <section className="section">
      <div className="section-header">
        <h2>2. 타임라인 관리 — {examName}</h2>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={addStage}>+ 단계 추가</button>
          <button className="btn" onClick={handleReset}>기본값 초기화</button>
        </div>
      </div>
      <p className="hint">현재 실행 단계를 선택하면 이후 검색 실행 시 해당 단계로 기록됩니다.</p>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>실행 단계</th>
              <th>순서</th>
              <th>단계명</th>
              <th>예상 시각</th>
              <th>실제 반영 시각</th>
              <th>비고</th>
              <th>이동</th>
              <th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, i) => (
              <tr key={stage.timeline_id} className={stage.stage_name === selectedStage ? 'row-selected' : ''}>
                <td>
                  <input
                    type="radio"
                    name="active-stage"
                    checked={stage.stage_name === selectedStage}
                    onChange={() => onStageSelect(stage.stage_name)}
                  />
                </td>
                <td>{stage.stage_order}</td>
                <td>
                  <input
                    className="input-inline"
                    value={stage.stage_name}
                    onChange={(e) => updateStage(i, 'stage_name', e.target.value)}
                    onBlur={() => saveStageOnBlur(stages)}
                  />
                </td>
                <td>
                  <input
                    className="input-inline"
                    type="time"
                    value={stage.expected_time.includes('T') ? '' : stage.expected_time}
                    onChange={(e) => updateStage(i, 'expected_time', e.target.value)}
                    onBlur={() => saveStageOnBlur(stages)}
                  />
                </td>
                <td>
                  <input
                    className="input-inline"
                    type="time"
                    value={stage.actual_time.includes('T') ? '' : stage.actual_time}
                    onChange={(e) => updateStage(i, 'actual_time', e.target.value)}
                    onBlur={() => saveStageOnBlur(stages)}
                  />
                </td>
                <td>
                  <input
                    className="input-inline"
                    value={stage.note}
                    onChange={(e) => updateStage(i, 'note', e.target.value)}
                    onBlur={() => saveStageOnBlur(stages)}
                  />
                </td>
                <td>
                  <button className="btn btn-sm" onClick={() => moveStage(i, -1)} disabled={i === 0}>▲</button>
                  <button className="btn btn-sm" onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1}>▼</button>
                </td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteStage(i)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
