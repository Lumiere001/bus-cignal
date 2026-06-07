import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * Firestore Rules 검증 — 에뮬레이터 필요. `pnpm test:rules`로 실행.
 * Custom Token 발급/Admin SDK 없이, claim을 직접 주입해 Rules allow/deny만 검증한다.
 */

const TRIP_1 = "trip-0000-0000-0000-000000000001";
const TRIP_2 = "trip-0000-0000-0000-000000000002";

// 정상 메시지 payload (serverTimestamp 포함)
function validMessage(senderRole: "passenger" | "operator", senderId: string) {
  return {
    text: "안녕하세요",
    senderRole,
    senderId,
    displayName: "홍길동",
    createdAt: serverTimestamp(),
  };
}

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const [h, p] = host.split(":");
  testEnv = await initializeTestEnvironment({
    projectId: "demo-bus-cignal",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: h,
      port: Number(p),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// passenger:p1 이 trip-1 claim 보유
function passengerP1() {
  return testEnv
    .authenticatedContext("passenger:p1", {
      role: "passenger",
      tripId: TRIP_1,
      subjectId: "p1",
    })
    .firestore();
}

// operator:op1 이 trip-1 claim 보유
function operatorOp1() {
  return testEnv
    .authenticatedContext("operator:op1", {
      role: "operator",
      tripId: TRIP_1,
      subjectId: "op1",
    })
    .firestore();
}

describe("Firestore Rules — channels/{tripId}/messages", () => {
  describe("read", () => {
    it("본인 trip claim → 자기 trip 메시지 읽기 허용", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), "channels", TRIP_1, "messages", "m1"),
          { text: "hi", senderRole: "passenger", senderId: "p1", displayName: "홍" },
        );
      });
      const db = passengerP1();
      await assertSucceeds(
        getDoc(doc(db, "channels", TRIP_1, "messages", "m1")),
      );
    });

    it("다른 trip(claim 불일치) 메시지 읽기 거부", async () => {
      const db = passengerP1();
      await assertFails(
        getDocs(collection(db, "channels", TRIP_2, "messages")),
      );
    });

    it("미인증 사용자 읽기 거부", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        getDocs(collection(db, "channels", TRIP_1, "messages")),
      );
    });
  });

  describe("create", () => {
    it("claim 일치 + 정상 본문 → 학생 생성 허용", async () => {
      const db = passengerP1();
      await assertSucceeds(
        addDoc(collection(db, "channels", TRIP_1, "messages"), validMessage("passenger", "p1")),
      );
    });

    it("claim 일치 → 간사 생성 허용", async () => {
      const db = operatorOp1();
      await assertSucceeds(
        addDoc(collection(db, "channels", TRIP_1, "messages"), validMessage("operator", "op1")),
      );
    });

    it("senderId 위조(토큰 subjectId 불일치) → 거부", async () => {
      const db = passengerP1();
      await assertFails(
        addDoc(collection(db, "channels", TRIP_1, "messages"), validMessage("passenger", "다른사람")),
      );
    });

    it("senderRole 위조(토큰 role 불일치) → 거부", async () => {
      const db = passengerP1();
      await assertFails(
        addDoc(collection(db, "channels", TRIP_1, "messages"), {
          ...validMessage("passenger", "p1"),
          senderRole: "operator",
        }),
      );
    });

    it("다른 trip 채널에 쓰기(claim 불일치) → 거부", async () => {
      const db = passengerP1();
      await assertFails(
        addDoc(collection(db, "channels", TRIP_2, "messages"), validMessage("passenger", "p1")),
      );
    });

    it("빈 본문 → 거부", async () => {
      const db = passengerP1();
      await assertFails(
        addDoc(collection(db, "channels", TRIP_1, "messages"), {
          ...validMessage("passenger", "p1"),
          text: "",
        }),
      );
    });

    it("500자 초과 본문 → 거부", async () => {
      const db = passengerP1();
      await assertFails(
        addDoc(collection(db, "channels", TRIP_1, "messages"), {
          ...validMessage("passenger", "p1"),
          text: "가".repeat(501),
        }),
      );
    });

    it("createdAt이 serverTimestamp 아님(클라이언트 시간) → 거부", async () => {
      const db = passengerP1();
      await assertFails(
        addDoc(collection(db, "channels", TRIP_1, "messages"), {
          ...validMessage("passenger", "p1"),
          createdAt: Timestamp.fromDate(new Date("2020-01-01")),
        }),
      );
    });

    it("허용되지 않은 추가 필드 → 거부", async () => {
      const db = passengerP1();
      await assertFails(
        addDoc(collection(db, "channels", TRIP_1, "messages"), {
          ...validMessage("passenger", "p1"),
          isAdmin: true,
        }),
      );
    });

    it("미인증 사용자 생성 거부", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        addDoc(collection(db, "channels", TRIP_1, "messages"), validMessage("passenger", "p1")),
      );
    });
  });

  describe("create — 시스템 입장/퇴장 (B)", () => {
    function joinMsg(senderId: string, displayName: string) {
      return {
        text: `${displayName}님이 들어왔어요`,
        senderRole: "system",
        senderId,
        displayName,
        createdAt: serverTimestamp(),
      };
    }

    it("본인 입장 안내(displayName 파생 텍스트) → 허용 (학생)", async () => {
      const db = passengerP1();
      await assertSucceeds(
        addDoc(collection(db, "channels", TRIP_1, "messages"), joinMsg("p1", "이지은")),
      );
    });

    it("본인 퇴장 안내 → 허용 (간사)", async () => {
      const db = operatorOp1();
      await assertSucceeds(
        addDoc(collection(db, "channels", TRIP_1, "messages"), {
          text: "김간사님이 나갔어요",
          senderRole: "system",
          senderId: "op1",
          displayName: "김간사",
          createdAt: serverTimestamp(),
        }),
      );
    });

    it("displayName 파생이 아닌 임의 시스템 텍스트 → 거부(위조 차단)", async () => {
      const db = passengerP1();
      await assertFails(
        addDoc(collection(db, "channels", TRIP_1, "messages"), {
          ...joinMsg("p1", "이지은"),
          text: "공지: 운행이 취소되었습니다",
        }),
      );
    });

    it("senderId 위조한 시스템 메시지 → 거부", async () => {
      const db = passengerP1();
      await assertFails(
        addDoc(collection(db, "channels", TRIP_1, "messages"), joinMsg("다른사람", "이지은")),
      );
    });

    it("텍스트와 displayName 불일치(접두 이름 위조) → 거부", async () => {
      const db = passengerP1();
      await assertFails(
        addDoc(collection(db, "channels", TRIP_1, "messages"), {
          text: "이지은님이 들어왔어요",
          senderRole: "system",
          senderId: "p1",
          displayName: "다른이름", // 규칙은 text == displayName+'님이…' 강제 → 불일치 거부
          createdAt: serverTimestamp(),
        }),
      );
    });

    it("시스템 메시지에 추가 필드 → 거부", async () => {
      const db = passengerP1();
      await assertFails(
        addDoc(collection(db, "channels", TRIP_1, "messages"), {
          ...joinMsg("p1", "이지은"),
          event: "join",
        }),
      );
    });
  });

  describe("update / delete", () => {
    it("메시지 수정 거부", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), "channels", TRIP_1, "messages", "m1"),
          { text: "hi", senderRole: "passenger", senderId: "p1", displayName: "홍" },
        );
      });
      const db = passengerP1();
      await assertFails(
        updateDoc(doc(db, "channels", TRIP_1, "messages", "m1"), { text: "수정" }),
      );
    });

    it("메시지 삭제 거부", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), "channels", TRIP_1, "messages", "m1"),
          { text: "hi", senderRole: "passenger", senderId: "p1", displayName: "홍" },
        );
      });
      const db = passengerP1();
      await assertFails(
        deleteDoc(doc(db, "channels", TRIP_1, "messages", "m1")),
      );
    });
  });

  describe("deny-default", () => {
    it("정의되지 않은 경로 접근 거부", async () => {
      const db = passengerP1();
      await assertFails(getDoc(doc(db, "secrets", "x")));
    });
  });
});
