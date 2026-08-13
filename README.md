# ExP 박래혁T 수학 — 학생 관리 사이트

Claude 대화에서 쓰던 것과 완전히 같은 화면과 기능입니다. 다른 점은 데이터를
Firebase(무료 데이터베이스)에 저장해서, 유튜브 영상도 정상적으로 재생·추적된다는
것뿐입니다.

아래 순서대로 따라 하시면 됩니다. 중간에 막히는 부분이 있으면 그 화면을
그대로 설명해서 다시 물어보시면 도와드릴게요.

---

## 1단계. Firebase 데이터베이스 만들기 (5분)

1. https://console.firebase.google.com 접속 → 구글 계정으로 로그인
2. "프로젝트 추가" → 이름 아무거나 입력(예: exp-math) → 계속 진행 (Google
   애널리틱스는 꺼도 됩니다)
3. 프로젝트 개요 페이지에서 **`</>`(웹 앱 추가)** 아이콘 클릭 → 앱 닉네임
   아무거나 입력 → 앱 등록
4. 화면에 나오는 `firebaseConfig = { apiKey: "...", ... }` 값을 전체
   복사해두세요 (이따 3단계에서 씁니다)
5. 왼쪽 메뉴에서 **빌드 > Firestore Database** → "데이터베이스 만들기" →
   위치는 아무 곳(가까운 asia 지역 추천) → **테스트 모드로 시작**
6. Firestore가 만들어지면 위쪽 **"규칙(Rules)"** 탭 → 아래 내용으로 전체
   교체 후 **게시**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /academyData/{docId} {
         allow read, write: if true;
       }
     }
   }
   ```

   (지금까지 Claude 페이지도 "링크를 아는 사람은 접근 가능"한 구조였으니
   보안 수준은 동일합니다. 링크와 관리자 코드만 신뢰할 수 있는 사람에게
   공유해주세요.)

## 2단계. GitHub에 코드 올리기 (설치 없이, 웹에서만)

1. https://github.com 가입 (이미 있으면 로그인)
2. 오른쪽 위 **+** → **New repository** → 이름 아무거나(예: exp-math-site) →
   Create repository
3. 방금 만든 저장소 페이지에서 **"uploading an existing file"** 링크 클릭
4. 이 프로젝트 폴더 안의 파일/폴더를 **전부** 그대로 끌어다 놓기
   (package.json, index.html, src 폴더 등)
5. 아래 **Commit changes** 클릭

## 3단계. Firebase 설정값 입력하기

1. 방금 올린 저장소에서 `src/firebase.js` 파일 클릭 → 연필(✏️) 아이콘으로
   편집
2. `firebaseConfig` 안의 `"YOUR_API_KEY"` 등 6개 값을 1단계에서 복사해둔
   실제 값으로 교체
3. 위쪽 **Commit changes** 클릭해서 저장

## 4단계. Vercel로 실제 배포하기 (5분)

1. https://vercel.com 접속 → **GitHub 계정으로 가입/로그인**
2. **Add New... > Project** → 방금 만든 GitHub 저장소 선택 → **Import**
3. Framework Preset이 자동으로 "Vite"로 잡힙니다. 별다른 설정 없이
   **Deploy** 클릭
4. 1~2분 기다리면 `https://프로젝트이름.vercel.app` 같은 실제 주소가
   생깁니다 — 이게 학생들에게 공유할 최종 링크예요

> 이후 `src/firebase.js`나 다른 파일을 GitHub에서 수정할 때마다 Vercel이
> 자동으로 다시 배포해줍니다.

## 5단계. 기존 데이터 옮기기

1. Claude 대화의 페이지에서 **선생님 → 설정 → "JSON 파일로 내려받기"** 로
   데이터를 내려받아두세요 (이미 버튼을 추가해뒀습니다)
2. 새로 배포된 사이트에서 **선생님 → 설정 → "데이터 가져오기"** 에서 그
   파일을 선택하면 학생·출결·클리닉 기록이 그대로 옮겨집니다

## (선택) 진짜 도메인 연결하기

Vercel 프로젝트 설정의 **Domains** 탭에서 소유한 도메인(예: expmath.co.kr)을
추가하면 `프로젝트이름.vercel.app` 대신 그 주소로도 접속할 수 있습니다.
도메인이 없다면 가비아, 후이즈 같은 곳에서 연 1만~2만원대로 구매할 수
있어요. 지금 당장은 없어도 사이트는 완전히 정상 작동합니다.

---

### 로컬에서 미리 확인하고 싶다면 (선택, 개발자용)

```
npm install
npm run dev
```

위 두 줄을 터미널에서 실행하면 `http://localhost:5173` 에서 미리 볼 수
있습니다. 필수 단계는 아니니 건너뛰어도 됩니다.
