'use strict';
const $ = id => document.getElementById(id);
const example = 'Das Römische Reich wuchs durch die Eroberung vieler Gebiete. Um das grosse Reich zu verbinden, bauten die Römer Strassen. Auf diesen Strassen konnten Soldaten schnell von einem Ort zum anderen gelangen. Auch Händler nutzten die Strassen, um Waren zu transportieren. Wasserleitungen, die Aquädukte, brachten frisches Wasser in die Städte. Dort wurde es für Brunnen und öffentliche Bäder gebraucht. An den Grenzen errichteten die Römer Befestigungen, um ihr Reich vor Angriffen zu schützen.';
// Prepared example only. Arbitrary uploaded texts are handled by the AI endpoint.
const exampleQuestions = [
  { question: 'Wie wurde das Römische Reich grösser?', answer: 'Die Römer eroberten weitere Gebiete.', evidence: 'Das Römische Reich wuchs durch die Eroberung vieler Gebiete.' },
  { question: 'Warum bauten die Römer Strassen?', answer: 'Sie verbanden damit ihr Reich. Soldaten konnten schnell reisen und Händler Waren transportieren.', evidence: 'Um das grosse Reich zu verbinden, bauten die Römer Strassen. Auf diesen Strassen konnten Soldaten schnell von einem Ort zum anderen gelangen. Auch Händler nutzten die Strassen, um Waren zu transportieren.' },
  { question: 'Wozu brauchten die Städte Aquädukte?', answer: 'Sie brachten frisches Wasser für Brunnen und öffentliche Bäder in die Städte.', evidence: 'Wasserleitungen, die Aquädukte, brachten frisches Wasser in die Städte. Dort wurde es für Brunnen und öffentliche Bäder gebraucht.' },
  { question: 'Warum befestigten die Römer ihre Grenzen?', answer: 'Sie wollten ihr Reich vor Angriffen schützen.', evidence: 'An den Grenzen errichteten die Römer Befestigungen, um ihr Reich vor Angriffen zu schützen.' }
];
let questions = [], current = 0, known = 0, busy = false, previewURL;

function updateCount() {
  const words = $('source-text').value.match(/\S+/g) || [];
  $('word-count').textContent = `${words.length} ${words.length === 1 ? 'Wort' : 'Wörter'}`;
}
function showError(message) { $('error').textContent = message; $('error').hidden = false; }
function showPanel(name) {
  for (const id of ['editor', 'quiz', 'result']) $(id).hidden = id !== name;
  ['step1', 'step2', 'step3'].forEach((id, i) => $(id).classList.toggle('active', i === ['editor', 'quiz', 'result'].indexOf(name)));
}
async function makeQuestions(text) {
  const normalize = value => value.replace(/\s+/g, ' ').trim();
  if (normalize(text) === normalize(example)) {
    $('question-mode').textContent = 'Beispielrunde · vorbereitete Verständnisfragen';
    return exampleQuestions;
  }
  const unavailable = 'Für Verständnisfragen zu deinem eigenen Text muss die KI-Verbindung eingerichtet sein. Bis dahin kannst du das Römer-Beispiel ausprobieren.';
  if (!/^https?:$/.test(window.location.protocol)) throw new Error(unavailable);
  let response;
  try {
    response = await fetch('/api/questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }), signal: AbortSignal.timeout(90000)
    });
  } catch { throw new Error('Die KI ist gerade nicht erreichbar. Prüfe, ob der App-Server läuft, oder probiere das Römer-Beispiel aus.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || unavailable);
  if (!Array.isArray(data?.questions) || !data.questions.length || !data.questions.every(item =>
    typeof item.question === 'string' && typeof item.answer === 'string' && typeof item.evidence === 'string')) {
    throw new Error('Es konnten keine passenden Verständnisfragen erstellt werden. Versuche es bitte noch einmal.');
  }
  $('question-mode').textContent = 'Verständnisfragen zu deinem Text';
  return data.questions;
}
function renderQuestion() {
  const item = questions[current];
  $('question-count').textContent = `FRAGE ${current + 1} VON ${questions.length}`;
  $('quiz-progress').value = current / questions.length;
  $('question').textContent = item.question;
  $('answer').value = '';
  $('answer').readOnly = false;
  $('solution').hidden = true;
  $('reveal').hidden = false;
  $('model-answer').textContent = item.answer;
  $('source-answer').textContent = item.evidence;
  $('quiz').querySelector('details').open = false;
  $('question').focus();
}
async function startQuiz() {
  if (busy) return;
  $('error').hidden = true;
  const text = $('source-text').value.trim();
  if (text.split(/\s+/).length < 3) { showError('Füge bitte mindestens einen vollständigen Satz mit drei oder mehr Wörtern ein.'); $('source-text').focus(); return; }
  busy = true;
  ['camera-button', 'upload-button', 'start', 'example', 'repeat'].forEach(id => $(id).disabled = true);
  $('source-text').readOnly = true;
  $('generation-status').hidden = false;
  // Generation errors belong to the editor, including when repeating a round.
  showPanel('editor');
  try {
    questions = await makeQuestions(text);
    current = 0; known = 0;
    $('original').textContent = text;
    showPanel('quiz'); renderQuestion();
  } catch (error) { showError(error.message); }
  finally {
    busy = false;
    ['camera-button', 'upload-button', 'start', 'example', 'repeat'].forEach(id => $(id).disabled = false);
    $('source-text').readOnly = false;
    $('generation-status').hidden = true;
  }
}
function nextQuestion(wasKnown) {
  if (wasKnown) known++;
  current++;
  if (current < questions.length) { renderQuestion(); return; }
  showPanel('result');
  $('score').textContent = `Du hast ${questions.length} ${questions.length === 1 ? 'Frage' : 'Fragen'} geübt. Bei ${known} davon hast du „Das wusste ich“ gewählt. ${known === questions.length ? 'Du bist bereit für die nächste Runde!' : 'Mit jeder Runde wird es leichter.'}`;
  $('result-title').focus();
}
let ocrLoader;
function loadOCR() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!ocrLoader) ocrLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => { script.remove(); ocrLoader = undefined; reject(new Error('Texterkennung konnte nicht geladen werden.')); };
    document.head.appendChild(script);
  });
  return ocrLoader;
}
async function scan(file) {
  if (!file || busy) return;
  $('error').hidden = true;
  if (!file.type.startsWith('image/')) { showError('Wähle bitte ein Bild aus, zum Beispiel JPG oder PNG. PDF-Dateien können noch nicht eingelesen werden.'); return; }
  if (file.size > 15 * 1024 * 1024) { showError('Das Bild ist zu gross. Wähle bitte ein Bild unter 15 MB.'); return; }
  if ($('source-text').value.trim() && !window.confirm('Soll der bisherige Text durch den Text aus diesem Bild ersetzt werden?')) return;
  busy = true;
  ['camera-button', 'upload-button', 'start', 'example'].forEach(id => $(id).disabled = true);
  $('source-text').readOnly = true;
  if (previewURL) URL.revokeObjectURL(previewURL);
  previewURL = URL.createObjectURL(file);
  $('preview').src = previewURL;
  $('scan-preview').hidden = false;
  $('scan-progress').value = 0;
  $('scan-status').textContent = 'Texterkennung wird geladen. Beim ersten Mal kann das etwas dauern …';
  let worker;
  try {
    const ocr = await loadOCR();
    worker = await ocr.createWorker('deu+eng', 1, { logger: message => {
      if (message.status === 'recognizing text') {
        $('scan-progress').value = message.progress;
        $('scan-status').textContent = `Dein Text wird gelesen … ${Math.round(message.progress * 100)} %`;
      }
    }});
    const { data } = await worker.recognize(file);
    if (!data.text.trim()) throw new Error('Kein Text erkannt');
    $('source-text').value = data.text.trim(); updateCount();
    $('scan-status').textContent = 'Fertig! Prüfe den Text unten und verbessere falsch erkannte Wörter.';
    $('scan-progress').value = 1;
  } catch (error) {
    $('scan-status').textContent = 'Das Einlesen hat nicht geklappt.';
    showError('Prüfe deine Internetverbindung oder versuche ein schärferes Foto mit gut lesbarer Schrift. Du kannst den Text auch direkt eintippen oder einfügen.');
  } finally {
    if (worker) { try { await worker.terminate(); } catch { /* UI must unlock even after a worker error. */ } }
    busy = false;
    ['camera-button', 'upload-button', 'start', 'example'].forEach(id => $(id).disabled = false);
    $('source-text').readOnly = false;
  }
}
$('source-text').addEventListener('input', updateCount);
$('example').addEventListener('click', () => {
  if ($('source-text').value.trim() && !window.confirm('Soll der bisherige Text durch den Beispieltext ersetzt werden?')) return;
  $('source-text').value = example; updateCount(); $('error').hidden = true;
});
for (const id of ['camera', 'upload']) {
  $(`${id}-button`).addEventListener('click', () => $(id).click());
  $(id).addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; scan(file); });
}
$('start').addEventListener('click', startQuiz);
$('repeat').addEventListener('click', startQuiz);
$('reveal').addEventListener('click', () => {
  $('solution').hidden = false; $('reveal').hidden = true; $('answer').readOnly = true; $('retry').focus();
});
$('known').addEventListener('click', () => nextQuestion(true));
$('retry').addEventListener('click', () => nextQuestion(false));
document.querySelectorAll('.edit').forEach(button => button.addEventListener('click', () => { showPanel('editor'); $('source-text').focus(); }));
updateCount();
