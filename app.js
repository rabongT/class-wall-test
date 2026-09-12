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
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Firebase 설정 정보
const firebaseConfig = {
  apiKey: "AIzaSyAiV5tShnDaHCn2Sand_cg5dC3HCPlUhMU",
  authDomain: "dev-for-teachers-fa042.firebaseapp.com",
  projectId: "dev-for-teachers-fa042",
  storageBucket: "dev-for-teachers-fa042.firebasestorage.app",
  messagingSenderId: "108802918079",
  appId: "1:108802918079:web:f52add701749d9ea3ae80a"
};

// Firebase 및 Firestore 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// ===================================================
// 데이터를 다루는 함수 세 개
// Firestore의 memos 컬렉션과 통신합니다.
// ===================================================

// 메모를 읽어 옵니다.
// Firestore에서 작성 시각(createdAt) 순서대로 정렬하여 가져옵니다.
async function loadMemos() {
  const q = query(collection(db, "memos"), orderBy("createdAt", "asc"));
  const querySnapshot = await getDocs(q);
  const memoList = [];

  querySnapshot.forEach(function (docSnap) {
    memoList.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  return memoList;
}

// 메모를 새로 씁니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  await addDoc(collection(db, "memos"), {
    text: text,
    createdAt: Date.now()
  });
}

// 메모를 지웁니다.
// 문서 ID(id)를 기준으로 Firestore 문서를 삭제합니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
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

  const del = document.createElement("button");
  del.textContent = "×";
  del.addEventListener("click", async function () {
    await deleteMemo(memo.id);
    await render();
  });
  div.appendChild(del);

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
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

    await addMemo(text);
    input.value = "";
    await render();
  }
});


// 첫 화면 그리기
render();
input.focus();
