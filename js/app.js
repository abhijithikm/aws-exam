let quizData = null;
let answersMap = {}; // questionId -> selected option
let timerInterval = null;

const EXAM_DURATION = 90 * 60; // 90 minutes
const STORAGE_KEY = 'aws-ai-practitioner-exam';

const quizContainer = document.getElementById('quiz-container');
const quizTitle = document.getElementById('quiz-title');
const quizDescription = document.getElementById('quiz-description');

const scoreEl = document.getElementById('current-score');
const correctEl = document.getElementById('correct-answers');
const wrongEl = document.getElementById('wrong-answers');
const timerEl = document.getElementById('timer');

/* =========================
   LOAD QUIZ
========================= */
async function loadQuiz(file) {
  clearInterval(timerInterval);

  const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

  const res = await fetch(`data/${file}`);
  quizData = await res.json();

  quizTitle.textContent = quizData.quiz_title;
  quizDescription.textContent = quizData.quiz_description;

  quizContainer.innerHTML = '';
  answersMap = savedState.quizFile === file ? savedState.answers || {} : {};

  quizData.questions.forEach((q, idx) => renderQuestion(q, idx + 1));

  recomputeScore();
  startTimer(savedState.quizFile === file ? savedState.remainingTime : EXAM_DURATION);

  saveState(file);

  bootstrap.Modal.getInstance(
    document.getElementById('quizSelectModal')
  )?.hide();
}

/* =========================
   RENDER QUESTION
========================= */
function renderQuestion(q, index) {
  const card = document.createElement('div');
  card.className = 'question-card';

  card.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <div class="question-title">Q${index}. ${q.prompt.question}</div>
      <button class="btn btn-sm btn-outline-info" onclick="showExplanation(${q.id})">
        Explanation
      </button>
    </div>
    <div class="options"></div>
    <button class="btn btn-success submit-btn mt-2">Submit</button>
  `;

  const optionsContainer = card.querySelector('.options');
  const submitBtn = card.querySelector('.submit-btn');

  let selected = answersMap[q.id] || null;
  let submitted = Boolean(answersMap[q.id]);

  q.prompt.answers.forEach((ans, i) => {
    const letter = String.fromCharCode(97 + i);
    const opt = document.createElement('div');
    opt.className = 'option';
    opt.innerHTML = ans;
    opt.dataset.value = letter;

    if (selected === letter) opt.classList.add('active');

    opt.onclick = () => {
      if (submitted) return;
      optionsContainer
        .querySelectorAll('.option')
        .forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selected = letter;
    };

    optionsContainer.appendChild(opt);
  });

  // 🔒 Restore answered state (resume-safe)
  if (submitted) {
    lockAnsweredQuestion(optionsContainer, q, answersMap[q.id]);
    submitBtn.disabled = true;
  }

  submitBtn.onclick = () => {
    if (!selected) return alert('Select an answer');

    // 🚫 Prevent re-submit (critical fix)
    if (answersMap[q.id]) return;

    answersMap[q.id] = selected;
    submitted = true;

    lockAnsweredQuestion(optionsContainer, q, selected);
    submitBtn.disabled = true;

    saveState();
    recomputeScore();
  };

  quizContainer.appendChild(card);
}

/* =========================
   LOCK QUESTION UI
========================= */
function lockAnsweredQuestion(container, q, selected) {
  const correctAnswer = q.correct_response[0];

  container.querySelectorAll('.option').forEach(o => {
    o.classList.add('disabled');
    if (o.dataset.value === correctAnswer) o.classList.add('correct');
    if (o.dataset.value === selected && selected !== correctAnswer)
      o.classList.add('incorrect');
  });
}

/* =========================
   TIMER
========================= */
function startTimer(seconds) {
  let remaining = seconds;
  updateTimerDisplay(remaining);

  timerInterval = setInterval(() => {
    remaining--;
    updateTimerDisplay(remaining);
    saveState(undefined, remaining);

    if (remaining <= 0) {
      clearInterval(timerInterval);
      alert('⏱ Time is up! Exam submitted.');
    }
  }, 1000);
}

function updateTimerDisplay(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  timerEl.textContent = `${m}:${s}`;
}

/* =========================
   SCORE (BULLETPROOF)
========================= */
function recomputeScore() {
  let correct = 0;
  let incorrect = 0;

  Object.entries(answersMap).forEach(([qid, ans]) => {
    const q = quizData.questions.find(x => x.id == qid);
    if (!q) return;
    q.correct_response[0] === ans ? correct++ : incorrect++;
  });

  const total = quizData.questions.length;
  const percent = ((correct / total) * 100).toFixed(1);

  scoreEl.textContent = percent;
  correctEl.textContent = correct;
  wrongEl.textContent = incorrect;
}

/* =========================
   STORAGE
========================= */
function saveState(file = null, remainingTime = null) {
  const prev = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      quizFile: file ?? prev.quizFile,
      remainingTime: remainingTime ?? prev.remainingTime,
      answers: answersMap
    })
  );
}

/* =========================
   EXPLANATION
========================= */
function showExplanation(id) {
  const q = quizData.questions.find(q => q.id === id);
  const explanationEl = document.getElementById('explanation-content');

  const correctIndex = q.correct_response[0].charCodeAt(0) - 97;
  const correctText = q.prompt.answers[correctIndex];

  explanationEl.innerHTML = `
    <div class="explanation-correct">
      ✔ Correct answer:<br />
      ${correctText}
    </div>

    <div class="explanation-text">
      ${q?.prompt?.explanation || 'No explanation available'}
    </div>
  `;

  new bootstrap.Modal(document.getElementById('explanationModal')).show();
}
