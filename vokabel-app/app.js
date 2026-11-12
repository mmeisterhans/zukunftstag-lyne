'use strict';
const $ = id => document.getElementById(id);
const { cleanWord, parseList, isCorrect, buildRound } = VocabCore;
const demo = 'apple [ˈæpəl] – Apfel\nhouse /haʊs/ – Haus\nto learn [lɜːn] – lernen\nfriend [frend] – Freund / Freundin\nwater [ˈwɔːtə] – Wasser\ngood morning – guten Morgen';
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let cards = [], allCards = [], missed = [], position = 0, correct = 0, answered = false, importing = false, recognition = null, ocrLoader;
const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
function error(message) { $('error').textContent = message; $('error').hidden = false; }
function language(side) { return $(`${side}-language`).value; }
function languageName(side) { const select = $(`${side}-language`); return select.options[select.selectedIndex].text; }
function stopAudio() {
  if (canSpeak) window.speechSynthesis.cancel();
  if (recognition) { const previous = recognition; recognition = null; previous.abort(); }
  $('microphone').textContent = 'Mikrofon';
}
function panel(name) {
  stopAudio();
  for (const id of ['setup', 'practice', 'result']) $(id).hidden = name !== id;
}
function countPairs() { $('pair-count').textContent = `${$('pairs').children.length} Wortpaare`; }
function addPair(left = '', right = '') {
  const row = document.createElement('div'); row.className = 'pair';
  for (const [side, value] of [['left', left], ['right', right]]) {
    const input = document.createElement('input'); input.type = 'text'; input.value = value;
    input.dataset.side = side; input.setAttribute('aria-label', side === 'left' ? 'Wort links' : 'Übersetzung rechts');
    row.appendChild(input);
  }
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove';
  remove.textContent = '×'; remove.setAttribute('aria-label', 'Wortpaar entfernen');
  remove.addEventListener('click', () => { row.remove(); countPairs(); }); row.appendChild(remove);
  $('pairs').appendChild(row); countPairs();
}
$('parse').addEventListener('click', () => {
  $('error').hidden = true;
  if ($('list').value.length > 40000) { error('Bitte verwende eine kleinere Liste mit höchstens 40 000 Zeichen.'); return; }
  const result = parseList($('list').value);
  if (!result.pairs.length) { error('Ich konnte noch keine Wortpaare zuordnen. Schreibe zum Beispiel: apple – Apfel. Nutze für jedes Paar eine eigene Zeile.'); return; }
  if (result.pairs.length > 500) { error('Bitte verwende höchstens 500 Wortpaare pro Liste.'); return; }
  if ($('pairs').children.length && !window.confirm('Soll die bisher bearbeitete Wortliste durch diese Liste ersetzt werden?')) return;
  $('pairs').replaceChildren(); result.pairs.forEach(pair => addPair(pair.left, pair.right));
  $('skipped').hidden = result.skipped.length === 0;
  $('skipped').textContent = `Nicht zugeordnet: Zeile ${result.skipped.join(', ')}. Prüfe diese Zeilen und ergänze fehlende Paare unten oder verbessere die Liste oben.`;
  $('review').hidden = false; $('review').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('add-pair').addEventListener('click', () => { addPair(); $('pairs').lastElementChild.querySelector('input').focus(); });
$('example').addEventListener('click', () => {
  if ($('list').value.trim() && !window.confirm('Soll der bisherige Text durch die Beispielliste ersetzt werden?')) return;
  $('list').value = demo; $('error').hidden = true;
});
function updateDirection() {
  const left = languageName('left'), right = languageName('right');
  $('direction').options[0].text = `${left} → ${right}`;
  $('direction').options[1].text = `${right} → ${left}`;
}
for (const side of ['left', 'right']) $(`${side}-language`).addEventListener('change', updateDirection);
updateDirection();
function begin(round) {
  cards = round.map(card => ({ ...card })); missed = []; position = 0; correct = 0;
  panel('practice'); renderCard();
}
$('start').addEventListener('click', () => {
  $('error').hidden = true;
  const pairs = [...$('pairs').children].map(row => ({ left: cleanWord(row.querySelector('[data-side="left"]').value), right: cleanWord(row.querySelector('[data-side="right"]').value) }));
  if (!pairs.length || pairs.some(pair => !pair.left || !pair.right)) { error('Bitte fülle bei jedem Wortpaar beide Spalten aus oder entferne leere Zeilen.'); return; }
  if (pairs.length > 500) { error('Bitte verwende höchstens 500 Wortpaare.'); return; }
  allCards = buildRound(pairs, $('direction').value, $('shuffle').checked);
  begin(allCards);
});
function speakPrompt() {
  if (!canSpeak) return;
  stopAudio();
  const card = cards[position], locale = language(card.reverse ? 'right' : 'left');
  const utterance = new SpeechSynthesisUtterance(card.prompt.split(/\s*[/|]\s*/u)[0]);
  utterance.lang = locale; utterance.rate = .85;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(item => item.lang === locale) || voices.find(item => item.lang.split('-')[0] === locale.split('-')[0]);
  if (voice) utterance.voice = voice;
  utterance.onerror = () => { $('speech-status').textContent = 'Das Vorlesen hat nicht geklappt. Du kannst das Wort oben lesen.'; };
  window.speechSynthesis.speak(utterance);
}
function renderCard() {
  stopAudio(); answered = false;
  const card = cards[position], target = card.reverse ? 'left' : 'right';
  $('position').textContent = `WORT ${position + 1} VON ${cards.length}`;
  $('progress').value = position / cards.length;
  $('translate-label').textContent = `Übersetze von ${languageName(card.reverse ? 'right' : 'left')} nach ${languageName(target)}.`;
  $('prompt').textContent = card.prompt;
  $('answer-label').textContent = `Deine Antwort auf ${languageName(target)}`;
  $('answer').lang = language(target); $('answer').value = ''; $('answer').readOnly = false;
  $('feedback').hidden = true; $('check').disabled = false; $('reveal').disabled = false;
  $('microphone').disabled = !Recognition; $('speech-status').textContent = '';
  $('answer').focus();
  if ($('auto-speak').checked && canSpeak) speakPrompt();
}
function finishAnswer(reveal = false) {
  if (answered) return;
  if (!reveal && !$('answer').value.trim()) { $('speech-status').textContent = 'Schreibe oder sprich zuerst deine Antwort.'; $('answer').focus(); return; }
  stopAudio(); answered = true;
  const card = cards[position], ok = !reveal && isCorrect($('answer').value, card.answer);
  if (ok) correct++; else missed.push({ ...card });
  $('answer').readOnly = true; $('check').disabled = true; $('reveal').disabled = true; $('microphone').disabled = true;
  $('feedback').classList.toggle('good', ok); $('feedback').hidden = false;
  $('feedback-title').textContent = ok ? 'Richtig! Gut gemacht.' : reveal ? 'Dieses Wort üben wir noch.' : 'Noch nicht ganz. Schau dir die Übersetzung an.';
  $('correct-answer').textContent = card.answer;
  $('next').textContent = position + 1 === cards.length ? 'Ergebnis ansehen →' : 'Nächstes Wort →';
  $('next').focus();
}
$('answer-form').addEventListener('submit', event => { event.preventDefault(); finishAnswer(); });
$('reveal').addEventListener('click', () => finishAnswer(true));
$('speak').addEventListener('click', speakPrompt);
$('next').addEventListener('click', () => {
  if (!answered) return;
  position++;
  if (position < cards.length) { renderCard(); return; }
  panel('result');
  $('score').textContent = `${correct} von ${cards.length} richtig. ${missed.length ? `${missed.length} ${missed.length === 1 ? 'Wort wartet' : 'Wörter warten'} noch auf eine zweite Runde.` : 'Du hast alle Wörter dieser Runde gewusst!'}`;
  $('retry').hidden = !missed.length; $('result-title').focus();
});
$('retry').addEventListener('click', () => begin(missed));
$('repeat').addEventListener('click', () => begin(allCards));
document.querySelectorAll('.edit').forEach(button => button.addEventListener('click', () => { panel('setup'); $('start').focus(); }));
$('microphone').addEventListener('click', () => {
  if (!Recognition || answered) return;
  if (recognition) { stopAudio(); return; }
  stopAudio();
  const instance = new Recognition(); recognition = instance;
  instance.lang = language(cards[position].reverse ? 'left' : 'right');
  instance.interimResults = false; instance.maxAlternatives = 1;
  $('microphone').textContent = 'Stopp'; $('speech-status').textContent = 'Ich höre zu …';
  instance.onresult = event => {
    if (recognition !== instance) return;
    $('answer').value = event.results[0][0].transcript;
    $('speech-status').textContent = 'Prüfe den erkannten Text und klicke auf „Antwort prüfen“.';
  };
  instance.onerror = event => {
    if (recognition !== instance) return;
    $('speech-status').textContent = event.error === 'not-allowed' ? 'Das Mikrofon wurde nicht freigegeben. Du kannst die Antwort eintippen.' : 'Ich konnte dich nicht verstehen. Versuche es nochmals oder tippe die Antwort ein.';
  };
  instance.onend = () => {
    if (recognition !== instance) return;
    recognition = null; $('microphone').textContent = 'Mikrofon';
    if ($('speech-status').textContent === 'Ich höre zu …') $('speech-status').textContent = 'Kein Wort erkannt. Versuche es nochmals oder tippe deine Antwort ein.';
  };
  try { instance.start(); } catch { recognition = null; $('microphone').textContent = 'Mikrofon'; $('speech-status').textContent = 'Das Mikrofon ist nicht verfügbar. Du kannst die Antwort eintippen.'; }
});
$('speak').disabled = !canSpeak; $('auto-speak').disabled = !canSpeak;
$('support-note').textContent = !Recognition ? 'Dein Browser unterstützt keine Spracheingabe. Du kannst alle Antworten tippen.' : 'Für gesprochene Antworten musst du das Mikrofon im Browser freigeben.';
if (!canSpeak) $('support-note').textContent += ' Das Vorlesen ist in diesem Browser nicht verfügbar.';

function loadOCR() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!ocrLoader) ocrLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => { ocrLoader = undefined; script.remove(); reject(new Error('Texterkennung nicht verfügbar.')); };
    document.head.appendChild(script);
  });
  return ocrLoader;
}
async function importFile(file) {
  if (!file || importing) return;
  $('error').hidden = true;
  if (file.size > 15 * 1024 * 1024) { error('Bitte wähle eine Datei unter 15 MB.'); return; }
  if ($('list').value.trim() && !window.confirm('Soll der bisherige Listentext durch diese Datei ersetzt werden?')) return;
  importing = true;
  for (const id of ['parse', 'example', 'camera-button', 'file-button', 'start']) $(id).disabled = true;
  $('list').readOnly = true; $('import-status').hidden = false;
  $('import-status').textContent = 'Deine Liste wird eingelesen …';
  let worker;
  try {
    let text;
    if (file.type === 'text/plain' || /\.txt$/iu.test(file.name)) text = await file.text();
    else if (file.type.startsWith('image/')) {
      $('import-status').textContent = 'Texterkennung wird geladen. Das kann beim ersten Mal etwas dauern …';
      const ocr = await loadOCR();
      const codes = { de: 'deu', en: 'eng', fr: 'fra', it: 'ita', es: 'spa', pt: 'por', la: 'lat' };
      const langs = [...new Set([language('left'), language('right')].map(locale => codes[locale.split('-')[0]]))].join('+');
      worker = await ocr.createWorker(langs, 1, { logger: message => {
        if (message.status === 'recognizing text') $('import-status').textContent = `Deine Liste wird gelesen … ${Math.round(message.progress * 100)} %`;
      }});
      // Preserve spacing between printed vocabulary columns for pair detection.
      await worker.setParameters({ preserve_interword_spaces: '1' });
      text = (await worker.recognize(file)).data.text;
    } else throw new Error('Bitte wähle ein Bild oder eine TXT-Datei.');
    if (!text.trim()) throw new Error('Kein Text erkannt. Versuche ein schärferes Foto oder füge die Liste direkt ein.');
    if (text.length > 40000) throw new Error('Die Liste ist zu lang. Bitte verwende höchstens 40 000 Zeichen.');
    $('list').value = text;
    $('import-status').textContent = 'Eingelesen! Klicke auf „Liste bereinigen & prüfen“ und kontrolliere die Wortpaare.';
  } catch (exception) { error(exception.message || 'Das Einlesen hat nicht geklappt. Füge deine Liste direkt ein.'); $('import-status').hidden = true; }
  finally {
    if (worker) { try { await worker.terminate(); } catch {} }
    importing = false; $('list').readOnly = false;
    for (const id of ['parse', 'example', 'camera-button', 'file-button', 'start']) $(id).disabled = false;
  }
}
for (const id of ['camera', 'file']) {
  $(`${id}-button`).addEventListener('click', () => $(id).click());
  $(id).addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; importFile(file); });
}
window.addEventListener('pagehide', stopAudio);
