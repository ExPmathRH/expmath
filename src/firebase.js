// ─────────────────────────────────────────────────────────────
// 1) https://console.firebase.google.com 에서 새 프로젝트를 만드세요 (무료 Spark 요금제로 충분합니다)
// 2) 프로젝트 개요 옆 </> (웹 앱 추가) 클릭 → 앱 등록 → 아래 firebaseConfig 값을 그대로 복사해 붙여넣으세요
// 3) 왼쪽 메뉴 '빌드 > Firestore Database' → '데이터베이스 만들기' → 테스트 모드로 시작
// 4) Firestore 규칙(Rules) 탭에서 아래 규칙으로 바꾸고 게시(자세한 내용은 README 참고)
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /academyData/{docId} {
//          allow read, write: if true;
//        }
//      }
//    }
// ─────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBnNdLk_JLw2prlDS1dXU6BGdiT0XZo2RE",
  authDomain: "exp-math.firebaseapp.com",
  projectId: "exp-math",
  storageBucket: "exp-math.firebasestorage.app",
  messagingSenderId: "868832389118",
  appId: "1:868832389118:web:d89f30d17eb07a270c42af",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const COLLECTION = "academyData";

// key(예: "roster", "attendance__injaeuichang") 하나당 Firestore 문서 하나에 JSON 문자열로 저장합니다.
// App.jsx의 나머지 코드는 이 함수 두 개만 알면 되고, 그 외 로직은 전혀 손댈 필요가 없습니다.
export async function loadKey(key, fallback) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, key));
    if (snap.exists() && snap.data().value !== undefined) {
      return JSON.parse(snap.data().value);
    }
    return fallback;
  } catch (e) {
    console.error("불러오기 실패", key, e);
    return fallback;
  }
}

export async function saveKey(key, value) {
  try {
    await setDoc(doc(db, COLLECTION, key), { value: JSON.stringify(value) });
  } catch (e) {
    console.error("저장 실패", key, e);
  }
}
