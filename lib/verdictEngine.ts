import Anthropic from '@anthropic-ai/sdk';
import { VerdictResult, VerdictIssue, VerdictErrorType } from './types';
import { getRulesForStageAndCategory } from './rubric';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `당신은 풀서비스 AI검색 답변 품질 검수 전문가입니다.
아래 루브릭 규칙과 실제 답변을 비교하여 답변의 적절성을 판정합니다.

판정 기준:
- "통과": 모든 루브릭 기준을 충족한 적절한 답변
- "수정 필요": 루브릭 위반이 명확하여 자동 분류 가능한 경우 (미공개 정보 제공, 필수 문구 누락 등)
- "재검수 필요": 판단이 모호하거나 컨텍스트 데이터가 없어 인간 검토가 필요한 경우

collection_failure 판단:
- 답변이 비어 있거나, 테이블 헤더만 있고 실제 데이터 행이 없거나, 의미 있는 내용 없이 단순 구조만 존재하는 경우 → collection_failure: true
- 이 경우 수집 자체가 실패한 것으로 간주하여 수집 상태를 소급 수정합니다.

오류 유형:
- 미공개_정보_확정_안내: 아직 공개되지 않은 정보를 확정값으로 제공
- 필수_문구_누락: "표본 집계 중", "준비 중" 등 단계별 필수 안내 문구 없음
- 풀서비스_링크_누락: 답변 하단에 풀서비스 바로가기 링크 없음
- 테이블_형식_누락: 다수 항목 제공 시 테이블 형식을 사용하지 않음
- 산출기준_누락: 변동 데이터(등급컷, 정오답률 등)에 산출 기준 시각 없음
- 산출기준_불필요: 고정 데이터(정답, 배점 등)에 불필요한 업데이트 기준 문구 포함
- 용어_오류: "해설강좌" 등 잘못된 용어 사용
- 시험_범위_오류: 제공하지 않는 시험 데이터를 현재 시험처럼 안내
- 절대평가_오류: 영어·한국사 등 절대평가 과목에 등급컷 숫자 제공
- 개인화_데이터_오류: 개인 성적/채점 결과를 확정적으로 답변
- 구조_불적절: 답변 구조가 루브릭 기준에 맞지 않음
- 기타: 위 분류에 해당하지 않는 오류

중요: 답변에 실제 데이터(점수, 비율 등)가 없어서 판단이 불가능한 경우 "재검수 필요"로 분류하세요.
답변이 수집 실패이거나 비어있는 경우 verdict_status를 "재검수 필요"로 반환하고 collection_failure를 true로 반환하세요.`;

interface VerdictInput {
  stage_name: string;
  category: string;
  query_text: string;
  answer_text: string;
  source_links: string;
  collection_status: '수집 성공' | '수집 실패';
}

export async function runVerdict(input: VerdictInput): Promise<VerdictResult> {
  const verdict_at = new Date().toISOString();

  if (input.collection_status === '수집 실패' || !input.answer_text.trim()) {
    return {
      verdict_status: '재검수 필요',
      issues: [],
      verdict_at,
      verdict_note: '수집 실패 또는 답변 없음 — 수동 확인 필요',
      collection_failure: true,
    };
  }

  const rules = getRulesForStageAndCategory(input.stage_name, input.category);

  if (rules.length === 0) {
    return {
      verdict_status: '재검수 필요',
      issues: [],
      verdict_at,
      verdict_note: `해당 단계(${input.stage_name})/유형(${input.category})에 대한 루브릭 규칙 없음 — 수동 확인 필요`,
    };
  }

  const rulesText = rules.map((r, i) =>
    `[규칙 ${i + 1}] 검수 포인트: ${r.inspection_point}\n답변 기준: ${r.answer_standard}\n참조 예시 문구: ${r.reference_phrase}`
  ).join('\n\n');

  let parsedLinks: { text: string; href: string }[] = [];
  try { parsedLinks = JSON.parse(input.source_links || '[]'); } catch { /* ignore */ }
  const linksSection = parsedLinks.length > 0
    ? `\n## 답변에 포함된 링크 (source_links)\n${parsedLinks.map((l) => `- [${l.text}](${l.href})`).join('\n')}\n※ 위 링크가 답변 본문과 함께 제공됩니다. 풀서비스 링크 존재 여부 판정 시 source_links도 함께 참고하세요.`
    : '';

  const userPrompt = `
## 검수 대상 정보
- 공개 단계: ${input.stage_name}
- 질의 유형: ${input.category}
- 사용자 질의: ${input.query_text}

## 적용 루브릭 규칙
${rulesText}

## 실제 답변
${input.answer_text}${linksSection}

## 판정 요청
위 루브릭 규칙을 기반으로 답변을 평가하고, 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "verdict_status": "통과" | "수정 필요" | "재검수 필요",
  "collection_failure": true | false,
  "verdict_note": "전체 판정 요약 (1-2문장)",
  "issues": [
    {
      "error_type": "<오류유형>",
      "rubric_point": "<위반된 검수 포인트>",
      "description": "<구체적 문제 설명>",
      "correction_request": "<수정 요청 내용>"
    }
  ]
}

통과인 경우 issues는 빈 배열([])로 반환하세요.
collection_failure는 답변이 비어 있거나 실제 내용이 없어 수집 실패로 봐야 하는 경우에만 true로 반환하세요. 그 외에는 false로 반환하세요.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패: ' + raw.slice(0, 200));

    const parsed = JSON.parse(jsonMatch[0]) as {
      verdict_status: string;
      collection_failure?: boolean;
      verdict_note?: string;
      issues: Array<{
        error_type: string;
        rubric_point: string;
        description: string;
        correction_request: string;
      }>;
    };

    const validStatuses = ['통과', '수정 필요', '재검수 필요'];
    const verdict_status = validStatuses.includes(parsed.verdict_status)
      ? (parsed.verdict_status as VerdictResult['verdict_status'])
      : '재검수 필요';

    const issues: VerdictIssue[] = (parsed.issues || []).map((issue) => ({
      error_type: (issue.error_type as VerdictErrorType) || '기타',
      rubric_point: issue.rubric_point || '',
      description: issue.description || '',
      correction_request: issue.correction_request || '',
    }));

    return {
      verdict_status,
      issues,
      verdict_at,
      verdict_note: parsed.verdict_note,
      collection_failure: parsed.collection_failure === true,
    };
  } catch (err) {
    return {
      verdict_status: '재검수 필요',
      issues: [],
      verdict_at,
      verdict_note: `판정 오류: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
