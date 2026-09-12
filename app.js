// ===================================================
// 우리 반 담벼락 - Firebase Firestore 연동
//
// 메모를 쓰면 올린 순서대로 담벼락에 붙습니다.
// Firestore에 데이터를 저장하므로 새로고침해도 유지됩니다.
// ===================================================

// --- Firebase SDK 불러오기 및 초기화 ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebase 설정 정보
const firebaseConfig = {
  apiKey: "AIzaSyAiV5tShnDaHCn2Sand_cg5dC3HCPlUhMU",
  authDomain: "dev-for-teachers-fa042.firebaseapp.com",
  projectId: "dev-for-teachers-fa042",
  storageBucket: "dev-for-teachers-fa042.firebasestorage.app",
  messagingSenderId: "108802918079",
  appId: "1:108802918079:web:f52add701749d9ea3ae80a"
};

// Firebase 및 Firestore, 인증(Auth) 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 현재 로그인한 사용자의 역할 ('teacher' 또는 'student')
let currentUserRole = "student";

// 사용자 역할 불러오기 (Firestore의 users/{uid} 문서 조회)
async function loadUserRole(uid) {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      currentUserRole = userDocSnap.data().role || "student";
    } else {
      // 기본 역할 설정: 현재 관리 계정(mokwont@gmail.com)은 teacher, 그 외는 student
      const isInitialTeacher = auth.currentUser && auth.currentUser.email === "mokwont@gmail.com";
      const initialRole = isInitialTeacher ? "teacher" : "student";
      await setDoc(userDocRef, { role: initialRole });
      currentUserRole = initialRole;
    }
  } catch (error) {
    console.error("사용자 역할 불러오기 실패:", error);
    currentUserRole = "student";
  }
}

// 실습/테스트용 역할 전환 함수 (교사 ↔ 학생)
async function toggleUserRole() {
  if (!auth.currentUser) return;
  const newRole = currentUserRole === "teacher" ? "student" : "teacher";
  try {
    await setDoc(doc(db, "users", auth.currentUser.uid), { role: newRole }, { merge: true });
    currentUserRole = newRole;
    await render();
  } catch (error) {
    console.error("역할 변경 실패:", error);
    alert("역할 변경에 실패했습니다: " + error.message);
  }
}


// ===================================================
// 데이터를 다루는 함수 세 개
// Firestore의 memos 컬렉션과 통신합니다.
// ===================================================

// 메모를 읽어 옵니다.
// Firestore에서 작성 시각(createdAt) 순서대로 정렬하여 가져옵니다.
async function loadMemos() {
  try {
    const q = query(collection(db, "memos"), orderBy("createdAt", "asc"));
    const querySnapshot = await getDocs(q);
    const memoList = [];

    querySnapshot.forEach(function (docSnap) {
      const data = docSnap.data();
      memoList.push({
        id: docSnap.id,
        text: data.text,
        createdAt: data.createdAt,
        uid: data.uid, // 작성자 uid 가져오기
        author: data.author || "익명" // 글쓴이 정보
      });
    });

    return memoList;
  } catch (error) {
    console.error("메모 불러오기 실패:", error);
    return [];
  }
}

// 메모를 새로 씁니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)와 글쓴이를 함께 저장합니다.
async function addMemo(text) {
  // 로그인하지 않은 사람은 메모를 아예 못 쓰게 막습니다.
  const user = auth.currentUser;
  if (!user) {
    alert("로그인하지 않은 사용자는 메모를 작성할 수 없습니다. 먼저 로그인해 주세요.");
    return;
  }

  // 5글자 이상일 때만 Firestore에 저장합니다.
  if (text.trim().length < 5) {
    return;
  }

  try {
    // 메모를 저장할 때 로그인한 사람의 uid와 글쓴이(이메일)를 함께 저장합니다.
    await addDoc(collection(db, "memos"), {
      text: text,
      createdAt: Date.now(),
      uid: user.uid,        // 작성자 UID
      author: user.email     // 글쓴이 이메일
    });
  } catch (error) {
    console.error("메모 저장 실패:", error);
    if (error.code === "permission-denied") {
      alert("Firestore 쓰기 권한이 없습니다.\nFirebase 콘솔의 Firestore 보안 규칙(Rules)을 확인해 주세요.");
    } else {
      alert("메모 저장 중 오류가 발생했습니다: " + error.message);
    }
    throw error;
  }
}

// 메모를 지웁니다.
// 문서 ID(id)를 기준으로 Firestore 문서를 삭제합니다.
async function deleteMemo(id) {
  try {
    await deleteDoc(doc(db, "memos", id));
  } catch (error) {
    console.error("메모 삭제 실패:", error);
    if (error.code === "permission-denied") {
      alert("Firestore 삭제 권한이 없습니다.\nFirebase 콘솔의 Firestore 보안 규칙(Rules)을 확인해 주세요.");
    } else {
      alert("메모 삭제 중 오류가 발생했습니다: " + error.message);
    }
  }
}


// ===================================================
// 화면 그리기
// ===================================================

// 사용자 로그인 영역 그리기 (#userArea)
function renderUserArea() {
  const userArea = document.getElementById("userArea");
  if (!userArea) return;
  userArea.innerHTML = "";

  const user = auth.currentUser;

  if (user) {
    // 로그인된 경우: 이메일과 현재 역할 표시
    const infoSpan = document.createElement("span");
    const roleLabel = currentUserRole === "teacher" ? "👨‍🏫 교사" : "🧑‍🎓 학생";
    infoSpan.innerHTML = `<strong>${user.email}</strong> (${roleLabel}) `;
    userArea.appendChild(infoSpan);

    // 실습 테스트를 위한 역할 전환 버튼
    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = currentUserRole === "teacher" ? "학생 모드로 전환" : "교사 모드로 전환";
    toggleBtn.style.marginRight = "6px";
    toggleBtn.addEventListener("click", toggleUserRole);
    userArea.appendChild(toggleBtn);

    // 로그아웃 버튼
    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", async function () {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("로그아웃 실패:", error);
      }
    });
    userArea.appendChild(logoutBtn);
  } else {
    // 로그인되지 않은 경우: Google 로그인 버튼
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Google 로그인";
    loginBtn.addEventListener("click", async function () {
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("로그인 실패:", error);
        if (error.code === "auth/operation-not-allowed") {
          alert("Firebase 콘솔에서 Google 로그인이 활성화되지 않았습니다.\nAuthentication > Sign-in method에서 Google 공급자를 '사용 설정'해 주세요.");
        } else {
          alert("로그인 중 오류가 발생했습니다: " + error.message);
        }
      }
    });
    userArea.appendChild(loginBtn);
  }
}

async function render() {
  renderUserArea();

  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  const memoList = await loadMemos();
  memoList.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  const user = auth.currentUser;
  // 권한 규칙:
  // - 교사(teacher)는 모든 메모를 삭제할 수 있음
  // - 학생(student)은 본인이 쓴 메모만 삭제할 수 있음 (타인의 것은 삭제 버튼 미노출)
  const canDelete = user && (currentUserRole === "teacher" || memo.uid === user.uid);

  if (canDelete) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.title = currentUserRole === "teacher" && memo.uid !== user.uid ? "교사 권한으로 삭제" : "삭제";
    del.addEventListener("click", async function () {
      await deleteMemo(memo.id);
      await render();
    });
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  // 한글 입력 중 중복 실행 방지
  if (e.isComposing) return;

  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    // 로그인하지 않은 사람은 메모를 작성할 수 없습니다.
    if (!auth.currentUser) {
      alert("로그인하지 않은 사용자는 메모를 작성할 수 없습니다. 먼저 로그인해 주세요.");
      return;
    }

    const text = input.value.trim();
    if (text.length < 5) {
      alert("메모를 5글자 이상 입력해 주세요.");
      return;
    }

    try {
      await addMemo(text);
      input.value = "";
      await render();
    } catch (error) {
      // addMemo에서 상세 안내 처리됨
    }
  }
});


// 로그인 또는 로그아웃할 때마다 역할 조회 및 화면 다시 그리기
onAuthStateChanged(auth, async function (user) {
  if (user) {
    // 로그인한 사람의 uid와 이메일을 콘솔에 출력
    console.log("로그인한 사용자 UID:", user.uid);
    console.log("로그인한 사용자 이메일:", user.email);

    await loadUserRole(user.uid);
  } else {
    currentUserRole = "student";
  }
  await render();
});

// 첫 화면 그리기
render();
input.focus();
