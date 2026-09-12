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
  updateDoc,
  query,
  where,
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

// 관리자 이메일 (이 이메일로 로그인하면 교사 승인 요청 목록이 보입니다)
const ADMIN_EMAIL = "mokwont@gmail.com";

// 현재 로그인한 사용자의 상태
let currentUserRole = "student";     // 'teacher' 또는 'student'
let currentUserRequested = false;    // 교사 승인 요청 여부 (true/false)

// 사용자 역할 및 승인 요청 상태 불러오기 (Firestore의 users/{uid} 문서 조회)
async function loadUserRole(uid) {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      // 이미 문서가 있는 사람은 새로 만들지 않고 그대로 둡니다.
      const data = userDocSnap.data();
      currentUserRole = data.role || "student";
      currentUserRequested = data.requested === true;
    } else {
      // 처음 들어온 사람은 users에 문서를 만들고 role에 "student"라고 적어 줍니다.
      await setDoc(userDocRef, {
        role: "student",
        requested: false,
        email: auth.currentUser ? auth.currentUser.email : ""
      });
      currentUserRole = "student";
      currentUserRequested = false;
    }
  } catch (error) {
    console.error("사용자 역할 불러오기 실패:", error);
    currentUserRole = "student";
    currentUserRequested = false;
  }
}

// 교사 승인 요청하기 (내 문서의 requested를 true로 변경)
async function requestTeacherApproval() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const userDocRef = doc(db, "users", user.uid);
    await updateDoc(userDocRef, {
      requested: true,
      email: user.email
    });
    currentUserRequested = true;
    await render();
    alert("교사 승인 요청이 접수되었습니다. 관리자 승인을 기다려 주세요.");
  } catch (error) {
    console.error("교사 승인 요청 실패:", error);
    alert("교사 승인 요청 중 오류가 발생했습니다: " + error.message);
  }
}

// 관리자가 교사 승인하기 (해당 사람의 role을 teacher로 변경)
async function approveTeacher(targetUid) {
  try {
    const userDocRef = doc(db, "users", targetUid);
    await updateDoc(userDocRef, {
      role: "teacher",
      requested: false
    });
    alert("교사로 승인되었습니다.");
    await render();
  } catch (error) {
    console.error("교사 승인 처리 실패:", error);
    alert("교사 승인 처리 중 오류가 발생했습니다: " + error.message);
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
        author: data.author || "익명", // 글쓴이 정보
        authorRole: data.authorRole === "teacher" ? "teacher" : "student"
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
      author: user.email,    // 글쓴이 이메일
      authorRole: currentUserRole === "teacher" ? "teacher" : "student"
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

// 사용자 로그인 영역 및 승인 영역 그리기 (#userArea)
async function renderUserArea() {
  const userArea = document.getElementById("userArea");
  if (!userArea) return;
  userArea.innerHTML = "";

  const user = auth.currentUser;

  if (user) {
    // 1. 내 정보 표시 (이메일 및 역할)
    const infoSpan = document.createElement("span");
    const roleLabel = currentUserRole === "teacher" ? "👨‍🏫 교사" : "🧑‍🎓 학생";
    infoSpan.innerHTML = `<strong>${user.email}</strong> (${roleLabel}) `;
    userArea.appendChild(infoSpan);

    // 2. 교사 승인 요청 버튼 또는 "승인 대기 중" 표시 (학생인 경우에만)
    if (currentUserRole !== "teacher") {
      if (currentUserRequested) {
        const waitingSpan = document.createElement("span");
        waitingSpan.textContent = "[승인 대기 중] ";
        waitingSpan.style.color = "#e65100";
        waitingSpan.style.fontWeight = "bold";
        userArea.appendChild(waitingSpan);
      } else {
        const reqBtn = document.createElement("button");
        reqBtn.textContent = "교사 승인 요청";
        reqBtn.style.marginRight = "6px";
        reqBtn.addEventListener("click", requestTeacherApproval);
        userArea.appendChild(reqBtn);
      }
    }

    // 3. 로그아웃 버튼
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

    // 4. 관리자 이메일로 로그인했을 때만: 요청한 사람 목록 표시 및 승인 버튼
    if (user.email === ADMIN_EMAIL) {
      const adminBox = document.createElement("div");
      adminBox.style.marginTop = "10px";
      adminBox.style.padding = "8px 12px";
      adminBox.style.background = "#eef7ee";
      adminBox.style.border = "1px solid #c8e6c9";
      adminBox.style.borderRadius = "4px";

      const adminTitle = document.createElement("strong");
      adminTitle.textContent = "📋 [관리자] 교사 승인 요청 목록:";
      adminBox.appendChild(adminTitle);

      try {
        const q = query(collection(db, "users"), where("requested", "==", true));
        const querySnap = await getDocs(q);

        if (querySnap.empty) {
          const emptyText = document.createElement("span");
          emptyText.textContent = " 대기 중인 요청이 없습니다.";
          emptyText.style.color = "#666";
          adminBox.appendChild(emptyText);
        } else {
          const list = document.createElement("ul");
          list.style.margin = "6px 0 0 0";
          list.style.paddingLeft = "20px";

          querySnap.forEach(function (docSnap) {
            const reqData = docSnap.data();
            const item = document.createElement("li");
            item.style.marginBottom = "4px";

            const emailText = document.createElement("span");
            emailText.textContent = `${reqData.email || docSnap.id} `;
            item.appendChild(emailText);

            const approveBtn = document.createElement("button");
            approveBtn.textContent = "승인";
            approveBtn.style.marginLeft = "6px";
            approveBtn.style.padding = "2px 8px";
            approveBtn.addEventListener("click", function () {
              approveTeacher(docSnap.id);
            });
            item.appendChild(approveBtn);

            list.appendChild(item);
          });
          adminBox.appendChild(list);
        }
      } catch (err) {
        console.error("승인 요청 목록 조회 실패:", err);
      }

      userArea.appendChild(adminBox);
    }
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
  await renderUserArea();

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
  const isTeacherMemo = memo.authorRole === "teacher";
  div.className = isTeacherMemo ? "memo teacher" : "memo";

  // 카드 위쪽에 작성자 역할 배지와 삭제 버튼을 함께 놓습니다.
  const top = document.createElement("div");
  top.className = "memo-top";

  const badge = document.createElement("span");
  badge.className = isTeacherMemo ? "memo-badge badge-teacher" : "memo-badge badge-student";
  badge.textContent = isTeacherMemo ? "선생님 📌" : "학생";
  top.appendChild(badge);

  const user = auth.currentUser;
  // 삭제 버튼 표시 조건:
  // - role이 teacher인 사람에게는 모든 메모의 삭제 버튼이 보임
  // - 일반 사용자(student 등)에게는 내가 쓴 메모에만 삭제 버튼이 보임
  const canDelete = user && (currentUserRole === "teacher" || (memo.uid && memo.uid === user.uid));

  if (canDelete) {
    const del = document.createElement("button");
    del.className = "del-btn";
    del.textContent = "×";
    del.title = currentUserRole === "teacher" && memo.uid !== user.uid ? "교사 권한으로 삭제" : "삭제";
    del.addEventListener("click", async function () {
      await deleteMemo(memo.id);
      await render();
    });
    top.appendChild(del);
  }

  div.appendChild(top);

  const span = document.createElement("span");
  span.className = "memo-content";
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
