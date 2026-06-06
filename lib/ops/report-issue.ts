import "server-only";

/**
 * 운영 이상 → GitHub Issue 자동 생성 (베스트에포트 · 중복 방지).
 *
 * 게이트: OPS_GITHUB_TOKEN(PAT, 해당 repo의 issues write) + OPS_GITHUB_REPO("owner/name").
 *   둘 중 하나라도 없으면 **no-op** → 로컬·미구성 환경·테스트에 영향 없음
 *   (lib/firebase의 isPushConfigured 패턴과 동일).
 *
 * 중복 방지: 본문에 숨긴 fingerprint 마커로 열린 이슈를 찾아, 같은 이상이면
 *   새 이슈 대신 "재발생" 댓글만 단다(노이즈 억제).
 */
const API = "https://api.github.com";

function config(): { token: string; repo: string } | null {
  const token = process.env.OPS_GITHUB_TOKEN;
  const repo = process.env.OPS_GITHUB_REPO;
  if (!token || !repo) return null;
  return { token, repo };
}

export function isOpsIssueConfigured(): boolean {
  return config() !== null;
}

export type OpsIssue = {
  title: string;
  body: string;
  /** 같은 이상은 같은 값 → 중복 억제 (예: "system_error:push_delivery_exhausted") */
  fingerprint: string;
  labels?: string[];
};

const marker = (fp: string) => `<!-- ops-fingerprint:${fp} -->`;

async function gh(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export async function reportOpsIssue(issue: OpsIssue): Promise<void> {
  const cfg = config();
  if (!cfg) return; // 미구성 → no-op
  const { token, repo } = cfg;
  const fp = marker(issue.fingerprint);
  const labels = issue.labels ?? ["ops-auto"];

  try {
    // 열린 이슈 중 같은 fingerprint가 있으면 댓글, 없으면 새로 생성.
    // (검색 인덱스 지연 회피를 위해 list 후 본문 매칭)
    const list = await gh(`/repos/${repo}/issues?state=open&per_page=100`, token);
    if (list.ok) {
      const items = (await list.json()) as { number: number; body: string | null }[];
      const existing = items.find((it) => typeof it.body === "string" && it.body.includes(fp));
      if (existing) {
        await gh(`/repos/${repo}/issues/${existing.number}/comments`, token, {
          method: "POST",
          body: JSON.stringify({ body: `🔁 재발생\n\n${issue.body}` }),
        });
        return;
      }
    }
    await gh(`/repos/${repo}/issues`, token, {
      method: "POST",
      body: JSON.stringify({
        title: issue.title,
        body: `${issue.body}\n\n${fp}`,
        labels,
      }),
    });
  } catch {
    // 이슈 생성 실패가 본 처리(알림·cron)를 막지 않도록 삼킨다.
  }
}
