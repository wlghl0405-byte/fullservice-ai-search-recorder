import type { NextApiRequest, NextApiResponse } from 'next';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { loadResults } from '../../lib/storage';

const ERROR_TYPE_LABEL: Record<string, string> = {
  '미공개_정보_확정_안내': '미공개 정보 확정 안내',
  '필수_문구_누락': '필수 문구 누락',
  '풀서비스_링크_누락': '풀서비스 링크 누락',
  '테이블_형식_누락': '테이블 형식 누락',
  '산출기준_누락': '산출기준 누락',
  '산출기준_불필요': '산출기준 불필요',
  '용어_오류': '용어 오류',
  '시험_범위_오류': '시험 범위 오류',
  '절대평가_오류': '절대평가 오류',
  '개인화_데이터_오류': '개인화 데이터 오류',
  '구조_불적절': '구조 불적절',
  '기타': '기타',
};

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2E75B6' },
};

const EVEN_ROW_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFDCE6F1' },
};

const BORDER_STYLE: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFB0BEC5' } };
const CELL_BORDER: Partial<ExcelJS.Borders> = {
  top: BORDER_STYLE,
  left: BORDER_STYLE,
  bottom: BORDER_STYLE,
  right: BORDER_STYLE,
};

function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.height = 24;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.border = CELL_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  }
}

function styleDataRow(row: ExcelJS.Row, colCount: number, isEven: boolean) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.border = CELL_BORDER;
    cell.alignment = { vertical: 'top', wrapText: true };
    if (isEven) {
      cell.fill = EVEN_ROW_FILL;
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { target, keys } = req.body as { target: 'all' | 'selected'; keys?: string[] };

  const allResults = loadResults();
  const keySet = target === 'selected' && keys ? new Set(keys) : null;

  const filteredResults = keySet
    ? allResults.filter((r) => keySet.has(`${r.run_id}|${r.query_id}`))
    : allResults;

  const examName = filteredResults[0]?.exam_name || '시험';
  const today = format(new Date(), 'yyyyMMdd');
  const fileName = `${examName}_풀서비스_AI 답변 검수_${today}.xlsx`;

  const correctionItems = filteredResults.filter((r) => r.verdict?.verdict_status === '수정 필요');
  const reviewItems = filteredResults.filter((r) => r.verdict?.verdict_status === '재검수 필요');

  const wb = new ExcelJS.Workbook();

  // ── 수정_요청 시트 ──────────────────────────────────────
  const ws1 = wb.addWorksheet('수정_요청');
  ws1.columns = [
    { header: '공개 단계',     key: 'stage',       width: 22 },
    { header: '질의 유형',     key: 'category',    width: 14 },
    { header: '사용자 질의',   key: 'query',       width: 32 },
    { header: '답변 본문',     key: 'answer',      width: 52 },
    { header: '오류 유형',     key: 'error_type',  width: 22 },
    { header: '문제 설명',     key: 'description', width: 36 },
    { header: '수정 요청 내용', key: 'correction',  width: 52 },
  ];
  styleHeaderRow(ws1.getRow(1), 7);

  let ws1RowIdx = 2;
  correctionItems.forEach((r, groupIdx) => {
    const issues = r.verdict?.issues || [];
    if (issues.length === 0) return;
    const isEven = groupIdx % 2 === 1;
    const startRow = ws1RowIdx;

    issues.forEach((issue, issueIdx) => {
      const row = ws1.addRow({
        stage:       issueIdx === 0 ? r.stage_name : '',
        category:    issueIdx === 0 ? r.category : '',
        query:       issueIdx === 0 ? r.query_text : '',
        answer:      issueIdx === 0 ? r.answer_text : '',
        error_type:  ERROR_TYPE_LABEL[issue.error_type] || issue.error_type,
        description: issue.description,
        correction:  issue.correction_request,
      });
      styleDataRow(row, 7, isEven);
      ws1RowIdx++;
    });

    if (issues.length > 1) {
      const endRow = ws1RowIdx - 1;
      for (let col = 1; col <= 4; col++) {
        ws1.mergeCells(startRow, col, endRow, col);
        const cell = ws1.getCell(startRow, col);
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = CELL_BORDER;
        if (isEven) cell.fill = EVEN_ROW_FILL;
      }
    }
  });

  // ── 재검수_대상 시트 ──────────────────────────────────────
  const ws2 = wb.addWorksheet('재검수_대상');
  ws2.columns = [
    { header: '공개 단계',   key: 'stage',    width: 22 },
    { header: '질의 유형',   key: 'category', width: 14 },
    { header: '사용자 질의', key: 'query',    width: 32 },
    { header: '답변 본문',   key: 'answer',   width: 52 },
    { header: '판정 메모',   key: 'note',     width: 42 },
  ];
  styleHeaderRow(ws2.getRow(1), 5);

  const reviewRows = reviewItems.map((r) => ({
    stage:    r.stage_name,
    category: r.category,
    query:    r.query_text,
    answer:   r.answer_text,
    note:     r.verdict?.verdict_note || '',
  }));

  reviewRows.forEach((rowData, i) => {
    const row = ws2.addRow(rowData);
    styleDataRow(row, 5, i % 2 === 1);
  });

  const buffer = await wb.xlsx.writeBuffer();

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.setHeader('Content-Length', buffer.byteLength);
  res.send(Buffer.from(buffer));
}
