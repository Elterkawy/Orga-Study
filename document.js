document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('devoires-form');
    const list = document.querySelector('#homework-list ul');
    const STORAGE_KEY = 'orga_homeworks';
    const COURSES_KEY = 'orga_courses';
    const SCHEDULE_KEY = 'orga_schedule';
    const GOALS_KEY = 'orga_goals';
    
    let items = [];
    let courses = [];
    let schedule = {};
    let goals = [];

    // Helper functions
    function escapeHtml(s = '') {
        return String(s).replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
    }

    function saveStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    function loadStorage(key, def = []) {
        try {
            return JSON.parse(localStorage.getItem(key) || JSON.stringify(def));
        } catch (e) {
            return def;
        }
    }

    function durationToScore(hours) {
        const h = Number(hours) || 0;
        if (h <= 1) return 1;
        if (h <= 3) return 2;
        if (h <= 5) return 3;
        if (h <= 7) return 4;
        return 5;
    }

    function dateToScore(dateStr) {
        if (!dateStr) return 1;
        const today = new Date();
        today.setHours(0,0,0,0);
        const due = new Date(dateStr);
        due.setHours(0,0,0,0);
        const msPerDay = 24 * 60 * 60 * 1000;
        const diffDays = Math.round((due - today) / msPerDay);
        if (diffDays < 0) return 5;
        if (diffDays <= 1) return 5;
        if (diffDays <= 3) return 4;
        if (diffDays <= 7) return 3;
        if (diffDays <= 14) return 2;
        return 1;
    }

    function computePriority(urgence, difficulte, duree, dateStr) {
        const u = Number(urgence) || 1;
        const d = Number(difficulte) || 1;
        const ds = durationToScore(duree);
        const dateS = dateToScore(dateStr);
        const value = u + d + ds + dateS;
        let label = 'Faible';
        if (value >= 16) label = 'Très haute';
        else if (value >= 12) label = 'Haute';
        else if (value >= 8) label = 'Moyenne';
        return { value, label };
    }

    // ============ HOMEWORK MANAGEMENT ============
    function renderItem(item) {
        const li = document.createElement('li');
        li.dataset.sujet = item.sujet;
        li.dataset.date = item.date;
        li.dataset.desc = item.desc;
        li.dataset.urgence = item.urgence;
        li.dataset.difficulte = item.difficulte;
        li.dataset.duree = item.duree;
        li.dataset.priorityValue = item.priorityValue;
        li.dataset.priorityLabel = item.priorityLabel;

        let color = '#5cb85c';
        if (item.priorityValue >= 16) color = '#b92b2b';
        else if (item.priorityValue >= 12) color = '#d9534f';
        else if (item.priorityValue >= 8) color = '#f0ad4e';

        li.style.borderLeft = `6px solid ${color}`;
        li.style.paddingLeft = '8px';
        li.style.marginBottom = '8px';
        li.style.background = 'white';
        li.style.borderRadius = '6px';

        li.innerHTML = `
            <div>
              <strong>${escapeHtml(item.sujet)}</strong> — <em>${escapeHtml(item.date)}</em>
              <div style="font-size:0.9em;color:#444">${escapeHtml(item.desc)}</div>
              <div style="font-size:0.85em;color:#666">Urgence: ${escapeHtml(item.urgence)} · Difficulté: ${escapeHtml(item.difficulte)} · Durée: ${escapeHtml(item.duree)}h</div>
              <div style="font-weight:600">Priorité: ${escapeHtml(String(item.priorityValue))} (${escapeHtml(item.priorityLabel)})</div>
            </div>
            <button type="button" class="delete">Supprimer</button>
        `;
        list.appendChild(li);
    }

    function sortItems(a, b) {
        const pv = Number(b.priorityValue) - Number(a.priorityValue);
        if (pv !== 0) return pv;
        if (a.date && b.date) {
            if (a.date < b.date) return -1;
            if (a.date > b.date) return 1;
        }
        return Number(b.urgence) - Number(a.urgence);
    }

    function renderAll() {
        items.sort(sortItems);
        if (list) {
            list.innerHTML = '';
            items.forEach(renderItem);
        }
    }

    // ============ CALENDAR MANAGEMENT ============
    let current = { year: null, month: null };

    function formatYMD(y, m, d) {
        const mm = String(m+1).padStart(2,'0');
        const dd = String(d).padStart(2,'0');
        return `${y}-${mm}-${dd}`;
    }

    function renderCalendar(year, month) {
        const container = document.getElementById('calendar');
        if (!container) return;
        current.year = year;
        current.month = month;

        const first = new Date(year, month, 1);
        const last = new Date(year, month+1, 0);
        const daysInMonth = last.getDate();
        const startWeekday = (first.getDay() + 6) % 7;

        let html = '<table><thead><tr>';
        const names = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
        for (const n of names) html += `<th>${n}</th>`;
        html += '</tr></thead><tbody>';

        let day = 1;
        for (let week=0; week<6; week++){
            let row = '<tr>';
            for (let wd=0; wd<7; wd++){
                if ((week===0 && wd < startWeekday) || day > daysInMonth) {
                    row += '<td></td>';
                } else {
                    const dateStr = formatYMD(year, month, day);
                    const isToday = dateStr === (new Date()).toISOString().slice(0,10);
                    const dayItems = items.filter(it => it.date === dateStr);
                    const classes = ['day'];
                    if (isToday) classes.push('today');
                    if (dayItems.length) classes.push('has-event');
                    row += `<td class="${classes.join(' ')}" data-date="${dateStr}"><div>${day}</div>`;
                    if (dayItems.length) row += `<div class="dot" title="${dayItems.length} événement(s)"></div>`;
                    row += '</td>';
                    day++;
                }
            }
            row += '</tr>';
            html += row;
            if (day > daysInMonth) break;
        }
        html += '</tbody></table>';
        container.innerHTML = html;

        const label = document.getElementById('month-label');
        if (label) label.textContent = first.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });

        container.querySelectorAll('td[data-date]').forEach(td => {
            td.addEventListener('click', () => {
                showDayEvents(td.dataset.date);
                openDailyScheduler(td.dataset.date);
            });
        });
    }

    function changeMonth(delta){
        let y = current.year, m = current.month + delta;
        if (m < 0){ m = 11; y -= 1; }
        if (m > 11){ m = 0; y += 1; }
        renderCalendar(y, m);
    }

    function showDayEvents(dateStr){
        const box = document.getElementById('day-events');
        if (!box) return;
        const dayItems = items.filter(it => it.date === dateStr);
        const titleDate = new Date(dateStr).toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
        let html = `<h4>Événements pour ${titleDate}</h4>`;
        if (!dayItems.length) html += '<p>Aucun devoir ce jour.</p>';
        else {
            html += '<ul>';
            dayItems.sort((a,b) => (b.priorityValue||0) - (a.priorityValue||0));
            dayItems.forEach(it => {
                html += `<li><strong>${escapeHtml(it.sujet)}</strong> — Priorité: ${it.priorityValue || '-'} (${escapeHtml(it.priorityLabel || '-')})</li>`;
            });
            html += '</ul>';
        }
        box.innerHTML = html;
    }

    // ============ DAILY SCHEDULER ============
    const dailySection = document.getElementById('daily-scheduler');

    function openDailyScheduler(dateStr) {
        if (!dailySection) return;
        dailySection.hidden = false;
        renderDailyGrid(dateStr);
    }

    function renderDailyGrid(dateStr) {
        const container = document.getElementById('daily-calendar');
        const blocksContainer = document.getElementById('time-blocks');
        if (!container || !blocksContainer) return;

        let html = `<h4>Planificateur pour ${new Date(dateStr).toLocaleDateString('fr-FR')}</h4>`;
        html += '<div class="daily-grid" style="display:flex;flex-direction:column;gap:4px;max-width:720px;margin-bottom:8px">';
        for (let h=0; h<24; h++) {
            html += `<div class="hour-row" data-hour="${h}" style="display:flex;align-items:center;gap:8px">
                        <div style="width:64px;color:#333">${String(h).padStart(2,'0')}:00</div>
                        <div class="hour-slot" style="flex:1;min-height:34px;border:1px dashed #ddd;padding:4px;position:relative" data-hour="${h}"></div>
                     </div>`;
        }
        html += '</div>';
        html += `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <input id="block-title" placeholder="Matière / Tâche" style="flex:2;padding:6px;min-width:150px"/>
                    <input id="block-start" type="number" min="0" max="23" placeholder="début h" style="width:70px;padding:6px"/>
                    <input id="block-end" type="number" min="0" max="23" placeholder="fin h" style="width:70px;padding:6px"/>
                    <button id="add-block">Ajouter bloc</button>
                    <button id="close-daily">Fermer</button>
                 </div>`;
        container.innerHTML = html;

        const dayBlocks = (schedule[dateStr] || []).slice().sort((a,b)=>a.start-b.start);
        dayBlocks.forEach(b => placeBlockInGrid(b, container, dateStr));

        document.getElementById('add-block').onclick = () => {
            const title = document.getElementById('block-title').value.trim();
            const start = Number(document.getElementById('block-start').value);
            const end = Number(document.getElementById('block-end').value);
            if (!title) { alert('Donnez un titre au bloc.'); return; }
            if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end > 23 || end < start) { alert('Heures invalides.'); return; }
            const newBlock = { id: String(Date.now()) + Math.random().toString(36).slice(2,6), title, start, end };
            schedule[dateStr] = schedule[dateStr] || [];
            schedule[dateStr].push(newBlock);
            saveStorage(SCHEDULE_KEY, schedule);
            placeBlockInGrid(newBlock, container, dateStr);
            document.getElementById('block-title').value = '';
            document.getElementById('block-start').value = '';
            document.getElementById('block-end').value = '';
        };

        document.getElementById('close-daily').onclick = () => {
            dailySection.hidden = true;
        };
    }

    function placeBlockInGrid(block, containerElement, dateStr) {
        const slot = containerElement.querySelector(`.hour-slot[data-hour="${block.start}"]`);
        if (!slot) return;
        
        const blockEl = document.createElement('div');
        blockEl.className = 'time-block';
        blockEl.style.position = 'relative';
        blockEl.style.background = '#6366F1';
        blockEl.style.color = 'white';
        blockEl.style.padding = '4px 6px';
        blockEl.style.borderRadius = '4px';
        blockEl.style.marginBottom = '4px';
        blockEl.style.cursor = 'move';
        blockEl.draggable = true;
        blockEl.dataset.id = block.id;
        blockEl.textContent = `${escapeHtml(block.title)} (${block.start}h-${block.end}h)`;

        blockEl.addEventListener('dragstart', (ev) => {
            ev.dataTransfer.setData('text/plain', block.id);
        });

        blockEl.addEventListener('contextmenu', (ev) => {
            ev.preventDefault();
            if (!confirm('Supprimer ce bloc ?')) return;
            for (const date in schedule) {
                const idx = (schedule[date] || []).findIndex(b => b.id === block.id);
                if (idx !== -1) {
                    schedule[date].splice(idx,1);
                    if (!schedule[date].length) delete schedule[date];
                    saveStorage(SCHEDULE_KEY, schedule);
                    renderDailyGrid(date);
                    break;
                }
            }
        });

        slot.appendChild(blockEl);

        containerElement.querySelectorAll('.hour-slot').forEach(s => {
            s.addEventListener('dragover', (ev) => { ev.preventDefault(); s.style.background = '#f3f4f6'; });
            s.addEventListener('dragleave', (ev) => { s.style.background = ''; });
            s.addEventListener('drop', (ev) => {
                ev.preventDefault();
                s.style.background = '';
                const id = ev.dataTransfer.getData('text/plain');
                for (const date in schedule) {
                    const idx = (schedule[date] || []).findIndex(b => b.id === id);
                    if (idx !== -1) {
                        const b = schedule[date][idx];
                        const newStart = Number(s.dataset.hour);
                        const duration = (b.end - b.start);
                        b.start = newStart;
                        b.end = Math.min(23, newStart + duration);
                        saveStorage(SCHEDULE_KEY, schedule);
                        renderDailyGrid(date);
                        break;
                    }
                }
            });
        });
    }

    // ============ COURSES MANAGEMENT ============
    function loadCourses() {
        courses = loadStorage(COURSES_KEY, []);
        // Supprimer tous les cours sans titre
        const initialCount = courses.length;
        courses = courses.filter(c => c && c.title && c.title.trim().length > 0);
        if (courses.length < initialCount) {
            saveStorage(COURSES_KEY, courses);
            console.log(`${initialCount - courses.length} cours sans titre supprimé(s)`);
        }
        renderCourseList();
    }

    function saveCourses() {
        saveStorage(COURSES_KEY, courses);
        renderCourseList();
        updateStats();
    }

    function renderCourseList() {
        const ul = document.querySelector('#course-list ul');
        if (!ul) return;
        ul.innerHTML = '';
        
        if (!courses.length) {
            ul.innerHTML = '<li style="text-align:center;color:#999;padding:20px">Aucun cours enregistré.</li>';
            return;
        }
        
        // Afficher TOUS les cours avec actions
        courses.slice().reverse().forEach(c => {
            const li = document.createElement('li');
            const title = escapeHtml(c.title || '(Sans titre)');
            const hasContent = c.content && c.content.trim().length > 0;
            li.innerHTML = `<div><strong>${title}</strong> ${hasContent ? '' : '<small style="color:#f59e0b">VIDE</small>'}</div>`;
            const actions = document.createElement('div');
            actions.className = 'actions';
            const viewBtn = document.createElement('button'); viewBtn.textContent = 'Voir';
            const editBtn = document.createElement('button'); editBtn.textContent = 'Éditer';
            const delBtn = document.createElement('button'); delBtn.textContent = 'Supprimer';
            viewBtn.addEventListener('click', () => openCourseView(c.id));
            editBtn.addEventListener('click', () => startEditCourse(c.id));
            delBtn.addEventListener('click', () => {
                if (!confirm('Supprimer ce cours ?')) return;
                courses = courses.filter(x => x.id !== c.id);
                saveCourses();
            });
            actions.appendChild(viewBtn);
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            li.appendChild(actions);
            ul.appendChild(li);
        });
    }

    function startEditCourse(id) {
        const c = courses.find(x => x.id === id);
        if (!c) return;
        document.getElementById('course-id').value = c.id;
        document.getElementById('course-title').value = c.title;
        document.getElementById('course-content').value = c.content;
        window.location.hash = '#cours';
    }

    function openCourseView(id) {
        const c = courses.find(x => x.id === id);
        if (!c) return;
        const view = document.getElementById('course-view');
        document.getElementById('view-title').textContent = c.title || '(Sans titre)';
        document.getElementById('view-content').innerHTML = escapeHtml(c.content || '').replace(/\n/g, '<br>');
        view.hidden = false;

        const editBtn = document.getElementById('edit-course');
        const openNewBtn = document.getElementById('open-course-newtab');
        const delBtn = document.getElementById('delete-course');
        const closeBtn = document.getElementById('close-course-view');

        editBtn.onclick = () => { startEditCourse(id); view.hidden = true; };
        delBtn.onclick = () => {
            if (!confirm('Supprimer ce cours ?')) return;
            courses = courses.filter(x => x.id !== id);
            saveCourses();
            view.hidden = true;
        };
        closeBtn.onclick = () => { view.hidden = true; };

        openNewBtn.onclick = () => {
            const html = `<meta charset="utf-8"><title>${escapeHtml(c.title)}</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:20px}</style><h1>${escapeHtml(c.title)}</h1><div>${escapeHtml(c.content).replace(/\n/g,'<br>')}</div>`;
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 20000);
        };
    }

    // ============ FORM HANDLERS ============
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const sujet = form.elements['Sujet'].value.trim();
            const date = form.elements['date-limite'].value;
            const desc = form.elements['description'].value.trim();
            const urgence = form.elements['urgence'].value;
            const difficulte = form.elements['difficulte'].value;
            const duree = form.elements['duree'].value;
            if (!sujet) return;
            const pr = computePriority(urgence, difficulte, duree, date);
            const item = {
                sujet, date, desc,
                urgence, difficulte, duree,
                priorityValue: pr.value,
                priorityLabel: pr.label
            };
            items.push(item);
            saveAll();
            form.reset();
            form.elements['urgence'].value = '3';
            form.elements['difficulte'].value = '3';
            form.elements['duree'].value = '1';
        });
    }

    if (list) {
        list.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete')) {
                const li = e.target.closest('li');
                const sujet = li.dataset.sujet;
                const date = li.dataset.date;
                const desc = li.dataset.desc;
                const idx = items.findIndex(it => it.sujet === sujet && it.date === date && it.desc === desc);
                if (idx !== -1) { items.splice(idx, 1); saveAll(); }
            }
        });
    }

    const courseForm = document.getElementById('course-form');
    if (courseForm) {
        courseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const idField = document.getElementById('course-id');
            const title = document.getElementById('course-title').value.trim();
            const content = document.getElementById('course-content').value;
            if (!title && !content) return;
            if (idField.value) {
                const id = idField.value;
                const idx = courses.findIndex(x => x.id === id);
                if (idx !== -1) {
                    courses[idx].title = title;
                    courses[idx].content = content;
                    courses[idx].updated = Date.now();
                }
            } else {
                const newCourse = { id: String(Date.now()) + '-' + Math.random().toString(36).slice(2,8), title, content, created: Date.now() };
                courses.push(newCourse);
            }
            document.getElementById('course-id').value = '';
            document.getElementById('course-title').value = '';
            document.getElementById('course-content').value = '';
            saveCourses();
            document.getElementById('course-view').hidden = true;
        });
    }

    // ============ SAVE/LOAD ALL ============
    function saveAll() {
        saveStorage(STORAGE_KEY, items);
        saveStorage(SCHEDULE_KEY, schedule);
        renderAll();
        if (current.year !== null) renderCalendar(current.year, current.month);
        updateStats();
    }

    function loadAll() {
        items = loadStorage(STORAGE_KEY, []);
        schedule = loadStorage(SCHEDULE_KEY, {});
        renderAll();
        const now = new Date();
        renderCalendar(now.getFullYear(), now.getMonth());
        const prev = document.getElementById('prev-month');
        const next = document.getElementById('next-month');
        if (prev) prev.addEventListener('click', () => changeMonth(-1));
        if (next) next.addEventListener('click', () => changeMonth(1));
    }

    // ============ TOOLS: TIMER ============
    let timerInterval;
    let timerSeconds = 0;

    document.getElementById('start-timer')?.addEventListener('click', () => {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timerSeconds++;
            const display = document.getElementById('timer-display');
            if (display) display.textContent = new Date(timerSeconds * 1000).toISOString().substr(11, 8);
        }, 1000);
    });

    document.getElementById('stop-timer')?.addEventListener('click', () => {
        clearInterval(timerInterval);
    });

    document.getElementById('reset-timer')?.addEventListener('click', () => {
        clearInterval(timerInterval);
        timerSeconds = 0;
        const display = document.getElementById('timer-display');
        if (display) display.textContent = '00:00:00';
    });

    // ============ TOOLS: NOTES ============
    function displaySavedNotes() {
        const savedNotes = localStorage.getItem('userNotes') || '';
        const el = document.getElementById('saved-notes');
        if (el) el.textContent = savedNotes;
    }

    document.getElementById('save-notes')?.addEventListener('click', () => {
        const notes = document.getElementById('notes')?.value || '';
        localStorage.setItem('userNotes', notes);
        displaySavedNotes();
    });

    displaySavedNotes();

    // ============ TOOLS: AVERAGE SIMULATOR ============
    const avgBtn = document.getElementById('generate-calendar');
    if (avgBtn) {
        avgBtn.textContent = 'Calculer la Moyenne';
        avgBtn.addEventListener('click', () => {
            const countStr = prompt('Combien de notes voulez-vous saisir ? (entier)');
            const n = Number(countStr);
            if (!Number.isInteger(n) || n <= 0) return alert('Nombre invalide.');
            const grades = [], coeffs = [];
            for (let i=0; i<n; i++){
                const g = prompt(`Note ${i+1} (ex: 14.5) :`);
                const c = prompt(`Coefficient ${i+1} (ex: 2) :`);
                const gn = Number(g), cn = Number(c);
                if (isNaN(gn) || isNaN(cn)) { alert('Entrée invalide. Calcul annulé.'); return; }
                grades.push(gn);
                coeffs.push(cn);
            }
            let total = 0, totCoef = 0;
            for (let i = 0; i < grades.length; i++){
                total += grades[i] * coeffs[i];
                totCoef += coeffs[i];
            }
            const avg = totCoef > 0 ? (total / totCoef).toFixed(2) : '0.00';
            alert(`Votre moyenne pondérée est : ${avg}`);
        });
    }

    // ============ TOOLS: CALCULATOR ============
    const calcInput = document.getElementById('calc-input');
    document.querySelectorAll('.calc-btn').forEach(button => {
        button.addEventListener('click', () => {
            if (!calcInput) return;
            if (button.textContent === 'C') {
                calcInput.value = '';
            } else {
                calcInput.value += button.textContent;
            }
        });
    });

    document.getElementById('calc-equal')?.addEventListener('click', () => {
        if (!calcInput) return;
        try {
            const expr = calcInput.value.replace(/[^0-9+\-*/().%\s]/g, '');
            // eslint-disable-next-line no-new-func
            const res = Function(`return (${expr})`)();
            calcInput.value = String(res);
        } catch (e) {
            calcInput.value = 'Erreur';
        }
    });

    // ============ POMODORO ============
    const POMODORO_WORK = 25 * 60;
    const POMODORO_BREAK = 5 * 60;
    let pomodoroSeconds = POMODORO_WORK;
    let pomodoroInterval;
    let pomodoroSessions = 0;
    let isPomodoroWork = true;

    function updatePomodoroDisplay() {
        const mins = Math.floor(pomodoroSeconds / 60);
        const secs = pomodoroSeconds % 60;
        const display = document.getElementById('pomodoro-display');
        if (display) display.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    }

    document.getElementById('pomodoro-start')?.addEventListener('click', () => {
        clearInterval(pomodoroInterval);
        pomodoroInterval = setInterval(() => {
            pomodoroSeconds--;
            updatePomodoroDisplay();
            if (pomodoroSeconds <= 0) {
                if (isPomodoroWork) {
                    pomodoroSessions++;
                    const el = document.querySelector('#pomodoro-sessions strong');
                    if (el) el.textContent = pomodoroSessions;
                    alert('Session de travail terminée! Prenez une pause.');
                    isPomodoroWork = false;
                    pomodoroSeconds = POMODORO_BREAK;
                } else {
                    alert('Pause terminée! Commencez une nouvelle session.');
                    isPomodoroWork = true;
                    pomodoroSeconds = POMODORO_WORK;
                }
                updatePomodoroDisplay();
            }
        }, 1000);
    });

    document.getElementById('pomodoro-pause')?.addEventListener('click', () => {
        clearInterval(pomodoroInterval);
    });

    document.getElementById('pomodoro-reset')?.addEventListener('click', () => {
        clearInterval(pomodoroInterval);
        isPomodoroWork = true;
        pomodoroSeconds = POMODORO_WORK;
        updatePomodoroDisplay();
    });

    updatePomodoroDisplay();

    // ============ GOALS MANAGEMENT ============
    function loadGoals() {
        goals = loadStorage(GOALS_KEY, []);
        renderGoals();
    }

    function saveGoals() {
        saveStorage(GOALS_KEY, goals);
        renderGoals();
        updateStats();
    }

    function renderGoals() {
        const ul = document.querySelector('#goals-list ul');
        if (!ul) return;
        ul.innerHTML = '';
        if (!goals.length) {
            ul.innerHTML = '<li>Aucun objectif enregistré.</li>';
            return;
        }
        goals.forEach((g, idx) => {
            const li = document.createElement('li');
            const isCompleted = g.progress === 100;
            if (isCompleted) li.classList.add('completed');
            
            li.innerHTML = `
                <div style="flex:1">
                    <strong>${escapeHtml(g.title)}</strong> - ${g.deadline}
                    <div class="goal-progress-bar">
                        <div class="goal-progress-fill" style="width:${g.progress}%"></div>
                    </div>
                    <span>${g.progress}% complété</span>
                    ${isCompleted ? '<span style="margin-left:10px;font-weight:bold;color:#059669">✓ Objectif atteint!</span>' : ''}
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0">
                    <button type="button" class="edit-goal-btn" data-idx="${idx}">Éditer</button>
                    <button type="button" class="delete-goal-btn" data-idx="${idx}">Supprimer</button>
                </div>
            `;
            ul.appendChild(li);
        });

        // Ajouter les event listeners
        document.querySelectorAll('.edit-goal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.dataset.idx);
                editGoal(idx);
            });
        });

        document.querySelectorAll('.delete-goal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.dataset.idx);
                deleteGoal(idx);
            });
        });
    }

    function editGoal(idx) {
        const g = goals[idx];
        const newProgress = prompt('Nouvelle progression (0-100):', g.progress);
        if (newProgress !== null) {
            const oldProgress = g.progress;
            g.progress = Math.max(0, Math.min(100, Number(newProgress)));
            
            // Si l'objectif vient d'atteindre 100%
            if (oldProgress !== 100 && g.progress === 100) {
                triggerCelebration();
            }
            
            saveGoals();
        }
    }

    function deleteGoal(idx) {
        if (confirm('Supprimer cet objectif?')) {
            goals.splice(idx, 1);
            saveGoals();
        }
    }

    function triggerCelebration() {
        // Créer des confetti
        const confettiPieces = ['🎉', '🎊', '⭐', '✨', '🌟', '💫', '🏆'];
        for (let i = 0; i < 30; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.textContent = confettiPieces[Math.floor(Math.random() * confettiPieces.length)];
            confetti.style.left = Math.random() * window.innerWidth + 'px';
            confetti.style.top = '-20px';
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            document.body.appendChild(confetti);
            
            // Supprimer le confetti après animation
            setTimeout(() => confetti.remove(), 2500);
        }
        
        // Afficher une alerte
        alert('🎉 Félicitations! Vous avez atteint votre objectif! 🎉');
        
        // Son de célébration (optionnel)
        playSuccessSound();
    }

    function playSuccessSound() {
        try {
            // Créer un son avec l'API Web Audio
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.log('Son non disponible');
        }
    }

    const goalsForm = document.getElementById('goals-form');
    if (goalsForm) {
        goalsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('goal-title').value.trim();
            const deadline = document.getElementById('goal-deadline').value;
            if (!title) return;
            goals.push({
                id: String(Date.now()),
                title,
                deadline,
                progress: 0,
                created: Date.now()
            });
            document.getElementById('goal-title').value = '';
            document.getElementById('goal-deadline').value = '';
            saveGoals();
        });
    }

    document.getElementById('goal-progress')?.addEventListener('input', (e) => {
        const el = document.getElementById('progress-value');
        if (el) el.textContent = e.target.value + '%';
    });

    // ============ STATISTICS ============
    function updateStats() {
        const pendingHW = items.filter(i => new Date(i.date) > new Date()).length;
        const coursesCount = courses.length;
        const completedGoals = goals.filter(g => g.progress === 100).length;
        const totalTime = items.reduce((sum, i) => sum + (Number(i.duree) || 0), 0);

        const stats = {
            'pending-hw': pendingHW,
            'courses-count': coursesCount,
            'completed-goals': completedGoals,
            'total-study-time': totalTime + 'h'
        };

        Object.entries(stats).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
    }

    // ============ INIT ============
    loadAll();
    loadCourses();
    loadGoals();
    updateStats();
});