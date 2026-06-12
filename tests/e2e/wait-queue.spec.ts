import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  OPERATOR_BUSAN_STATE,
  OPERATOR_DAEJEON_STATE,
  STUDENT_STATE,
} from "./support/auth-paths";
import {
  createWaitQueueSupplyScenario,
  purgeWaitQueueRequests,
  type WaitQueueSupplyScenario,
} from "./support/db";

// 버스 미배정 대기큐(#region-wait-queue) E2E — 세 세션이 한 흐름을 이어간다(파일 내 순차 실행).
//   ① 수요 간사(박부산): 위저드에서 버스 없는 지구(대전) 선택 → 대기 안내 → 명단 입력 →
//      대기 신청 생성 → 본인 신청 목록에 '버스 미배정' 표시.
//   ② 학생(최학생): 동일 흐름 + 같은 지구·방향 중복 신청 차단.
//   ③ 공급 간사(김대전): /operator/wait-queue에 ①②가 표시 → ①을 본인 published trip으로
//      이동 → trip 상세 시간순 큐에 기존 신청과 시간순으로 섞여 합류 → 승인 1회(기존 체인).
// 대전(2401)은 seed에서 버스를 올리지 않는 지구 — ①②의 "차량 0대" 전제가 항상 성립.
// (③의 공급 trip 픽스처는 ①② 이후에 생성하므로 위저드 조회를 오염시키지 않는다.)

const tag = randomUUID().replace(/-/g, "").slice(0, 6);
const WAIT_PAX_NAME = `대기E2E${tag}`;
const WAIT_REGION_NAME = "대전지구";
const STUDENT_NAME = "최학생"; // seed-dev의 CCC 학생 (STUDENT_STATE 세션 주인)

// 이전 실행 잔재(특히 학생 중복 가드에 걸리는 미배정 대기 신청) 제거 — 멱등 보장.
test.beforeAll(async () => {
  await purgeWaitQueueRequests();
});

// ───────────────────────── ① 수요 간사 — 위저드 대기 신청 ─────────────────────────

test.describe("수요 간사 대기 신청", () => {
  test.use({ storageState: OPERATOR_BUSAN_STATE });

  test("버스 없는 지구 → 대기 안내 → 명단 입력 → 신청 목록 '버스 미배정' 표시", async ({
    page,
  }) => {
    await page.goto("/operator/requests/new");

    // Step1: 대상 지구 = 대전(버스 없음), 방향 기본 가는편(up), 동의 후 조회.
    await page.getByLabel("지구 선택").selectOption(WAIT_REGION_NAME);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "버스 조회" }).click();

    // Step2: 차량 0대 → 대기큐 안내 박스 + 신청 진입 버튼.
    await expect(
      page.getByText(`「${WAIT_REGION_NAME}」는 아직 가는편 버스를 올리지 않았어요.`),
    ).toBeVisible();
    await page
      .getByRole("button", { name: `${WAIT_REGION_NAME} 대기큐에 신청 넣기` })
      .click();

    // Step3: 대기 신청 안내 + 희망일(선택) + 명단 1명 입력 → 제출.
    await expect(
      page.getByText(`버스 미배정 대기 신청 — ${WAIT_REGION_NAME} 대기큐`),
    ).toBeVisible();
    await page.locator('input[type="date"]').fill("2026-08-15"); // 희망 출발일(선택)
    await page.getByPlaceholder("이름 *").fill(WAIT_PAX_NAME);
    await page.getByPlaceholder("전화번호 *").fill("010-9200-0001");
    await page.getByRole("button", { name: "대기큐 신청하기" }).click();

    // 성공 → 기존 신청과 동일하게 /operator/requests 로 redirect.
    await page.waitForURL(/\/operator\/requests$/);

    // 신청 목록 카드: '버스 미배정' 뱃지 + 대기 대상 지구·희망일 + 학생 이름 미리보기.
    const card = page
      .locator("li")
      .filter({ has: page.getByRole("link") })
      .filter({ hasText: WAIT_PAX_NAME });
    await expect(card.getByText("버스 미배정")).toBeVisible();
    await expect(card.getByText(new RegExp(`${WAIT_REGION_NAME} 대기큐 · 희망일`))).toBeVisible();
  });
});

// ───────────────────────── ② 학생 — 동일 흐름 + 중복 차단 ─────────────────────────

test.describe("학생 대기 신청 + 중복 차단", () => {
  test.use({ storageState: STUDENT_STATE });

  // 위저드: 대전(버스 없음) 조회 → 대기 안내 → Step3(본인 확인 + 동의) → 제출 직전까지.
  async function applyToWaitQueue(page: Page) {
    await page.goto("/s/apply");
    await page.getByLabel("지구 선택").selectOption(WAIT_REGION_NAME);
    await page.getByRole("button", { name: "버스 조회" }).click();
    await expect(
      page.getByText(`「${WAIT_REGION_NAME}」는 아직 가는편 버스를 올리지 않았어요.`),
    ).toBeVisible();
    await page
      .getByRole("button", { name: `${WAIT_REGION_NAME} 대기큐에 신청 넣기` })
      .click();
    // Step3: 대기 신청 확인 — 본인 정보(CCC 계정) 표시 + 동의.
    await expect(
      page.getByText(`버스 미배정 대기 신청 — ${WAIT_REGION_NAME} 대기큐`),
    ).toBeVisible();
    await expect(page.getByText(STUDENT_NAME)).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "대기큐 신청하기" }).click();
  }

  test("학생 대기 신청 → /s '버스 배정 대기 중' + 같은 지구·방향 재신청 차단", async ({
    page,
  }) => {
    // 1차 신청 → /s 허브에 대기큐 카드 표시.
    await applyToWaitQueue(page);
    await page.waitForURL(/\/s$/);
    await expect(
      page.getByText(`버스 배정 대기 중 — ${WAIT_REGION_NAME} 대기큐`),
    ).toBeVisible();

    // 2차 신청(같은 지구·같은 방향) → 서버 중복 가드가 막고 Step3에 에러 표면화(redirect 안 됨).
    await applyToWaitQueue(page);
    await expect(page.getByText(/이미 이 지구 대기큐에 신청했어요/)).toBeVisible();

    // 중복 저장 안 됨 — 허브의 대기큐 카드는 1건만.
    await page.goto("/s");
    await expect(
      page.getByText(`버스 배정 대기 중 — ${WAIT_REGION_NAME} 대기큐`),
    ).toHaveCount(1);
  });
});

// ───────────────── ③ 공급 간사 — 대기큐 표시 → trip 이동 → 승인 체인 ─────────────────

test.describe("공급 간사 대기큐 → 배정 → 승인", () => {
  test.use({ storageState: OPERATOR_DAEJEON_STATE });

  // 대전 소유 published trip(가는편) + 기존 큐 신청(early -3h / late +30m) — 시간순 섞임 검증용.
  // ①②의 대기 신청(now께) 이후에 생성하므로 위 위저드들의 "차량 0대" 전제를 깨지 않는다.
  let scn: WaitQueueSupplyScenario;
  test.beforeAll(async () => {
    scn = await createWaitQueueSupplyScenario();
  });
  test.afterAll(async () => {
    await scn?.cleanup(); // trip 기반 정리 + 남은 미배정 대기 신청(학생 건) purge
  });

  test("대기큐에 ①② 표시 → ①을 trip으로 이동 → 시간순 합류 → 승인 1회", async ({
    page,
  }) => {
    await page.goto("/operator/wait-queue");

    // ① 간사 대기 신청 + ② 학생 직접 신청(배지)이 우리 지구 대기큐에 표시.
    await expect(page.getByText(WAIT_PAX_NAME)).toBeVisible();
    await expect(page.getByText("학생 직접 신청")).toBeVisible();
    await expect(page.getByText(STUDENT_NAME)).toBeVisible();

    // ①의 카드에서 본인 published trip 선택 → '버스로 이동' (trip_id UPDATE).
    const card = page
      .locator("li")
      .filter({ has: page.locator('select[name="tripId"]') })
      .filter({ hasText: WAIT_PAX_NAME });
    await card.locator('select[name="tripId"]').selectOption(scn.tripId);
    await card.getByRole("button", { name: "버스로 이동" }).click();

    // 성공 → 그 trip 상세로 redirect. 시간순 큐(기본 뷰)에 기존 신청과 섞여 합류.
    await page.waitForURL(new RegExp(`/operator/trips/${scn.tripId}$`));
    const queueSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "대기 신청" }) });
    const rows = queueSection.locator("ol > li");
    await expect(rows.filter({ hasText: WAIT_PAX_NAME })).toHaveCount(1);

    // 시간순 단언: early(-3h) < 대기 신청(now께) < late(+30m).
    const texts = await rows.allTextContents();
    const idxEarly = texts.findIndex((t) => t.includes(scn.earlyName));
    const idxWait = texts.findIndex((t) => t.includes(WAIT_PAX_NAME));
    const idxLate = texts.findIndex((t) => t.includes(scn.lateName));
    expect(idxEarly).toBeGreaterThanOrEqual(0);
    expect(idxEarly).toBeLessThan(idxWait);
    expect(idxWait).toBeLessThan(idxLate);

    // 승인 1회 — 이동된 학생만 선택 → 원자 승인(기존 체인) → 매칭 현황에 입금 확인 등장.
    await rows
      .filter({ hasText: WAIT_PAX_NAME })
      .locator('input[type="checkbox"]')
      .check();
    await page.getByRole("button", { name: "1명 승인" }).click();
    await expect(page.getByText(/입금 확정 후에는 공급 지구/)).toBeVisible();
    await page.getByRole("button", { name: "승인 확정" }).click();

    await expect(page.getByRole("button", { name: "입금 확인" }).first()).toBeVisible();
    // 승인된 학생은 큐에서 빠지고 매칭 현황으로 — 카드(큐)에는 더 이상 없음.
    await expect(rows.filter({ hasText: WAIT_PAX_NAME })).toHaveCount(0);
  });
});
