/**
 * OrgaStudy - Main Application Logic
 * 
 * A comprehensive organization and study management application with:
 * - Homework management with automatic prioritization
 * - Interactive calendar with daily events
 * - Daily scheduler with time blocks
 * - Course notes management
 * - Goals tracking with progress bars
 * - Advanced tools: Timer, Pomodoro, Scientific Calculator, Notes
 * - Offline support via Service Worker
 * - Local and optional SQLite backend storage
 * 
 * Version: 2.0.0
 * Last Updated: 2026-02-10
 * 
 * Improvements in v2.0:
 * ✅ Enhanced error handling with try-catch blocks
 * ✅ Comprehensive input validation across all forms
 * ✅ Better HTML escaping using textContent
 * ✅ Improved null/undefined safety checks
 * ✅ Better API error fallbacks to localStorage
 * ✅ Enhanced date validation (prevent past dates)
 * ✅ Better error messages for users
 * ✅ Strict bounds checking in edit functions
 * 
 * Storage:
 * - localStorage: Local browser storage (primary)
 * - SQLite (optional): Backend storage if Node.js server is running
 * - Service Worker: Offline caching of assets
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('devoires-form');
    const list = document.querySelector('#homework-list ul');
    const STORAGE_KEY = 'orga_homeworks';
    const COURSES_KEY = 'orga_courses';
    const SCHEDULE_KEY = 'orga_schedule';
    const DONE_KEY = 'orga_homeworks_done';
    const GOALS_KEY = 'orga_goals';
    
    let items = [];
    let courses = [];
    let schedule = {};
    let goals = [];
    let doneItems = [];

    // Helper functions with improved error handling
    function escapeHtml(s = '') {
        if (typeof s !== 'string') s = String(s || '');
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function saveStorage(key, data) {
        try {
            if (!key) throw new Error('Storage key is required');
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Storage save failed for key:', key, e);
            return false;
        }
    }

    // Persist helper: save locally and optionally push to backend
    function keyToApiPath(key) {
        if (key === STORAGE_KEY) return '/api/homeworks';
        if (key === SCHEDULE_KEY) return '/api/schedule';
        if (key === DONE_KEY) return '/api/done';
        if (key === COURSES_KEY) return '/api/courses';
        if (key === GOALS_KEY) return '/api/goals';
        return '/api/' + encodeURIComponent(key);
    }

    function persistKey(key, data) {
        saveStorage(key, data);
        if (window.USE_BACKEND) {
            try {
                const path = keyToApiPath(key);
                apiFetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).catch(()=>{});
            } catch (e) { console.warn('persistKey failed', e); }
        }
    }

    function loadStorage(key, def = []) {
        try {
            if (!key) return def;
            const item = localStorage.getItem(key);
            if (item === null) return def;
            const parsed = JSON.parse(item);
            return parsed !== null && parsed !== undefined ? parsed : def;
        } catch (e) {
            console.error('Storage load failed for key:', key, e);
            return def;
        }
    }

    // API helper that chooses a proper base when the file is opened via file://
    const API_BASE = window.API_BASE || (location.protocol === 'file:' ? 'http://localhost:3000' : '');
    function apiFetch(path, opts) {
        try {
            const url = (path.startsWith('http://') || path.startsWith('https://')) ? path : (API_BASE ? API_BASE + path : path);
            return fetch(url, opts);
        } catch (e) {
            console.error('API fetch error:', e);
            return Promise.reject(e);
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
        li.dataset.id = item.id || '';
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
            <div style="flex:1">
              <strong>${escapeHtml(item.sujet)}</strong> — <em>${escapeHtml(item.date)}</em>
              <div style="font-size:0.9em;color:#444">${escapeHtml(item.desc)}</div>
              <div style="font-size:0.85em;color:#666">Urgence: ${escapeHtml(item.urgence)} · Difficulté: ${escapeHtml(item.difficulte)} · Durée: ${escapeHtml(item.duree)}h</div>
              <div style="font-weight:600">Priorité: ${escapeHtml(String(item.priorityValue))} (${escapeHtml(item.priorityLabel)})</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <button type="button" class="done">Fait ✓</button>
              <button type="button" class="delete">Supprimer</button>
            </div>
        `;
        list.appendChild(li);
    }

    function renderCompletedList() {
        let container = document.getElementById('completed-homework-list');
        if (!container) {
            const hwSection = document.getElementById('homework-list');
            if (!hwSection) return;
            container = document.createElement('div');
            container.id = 'completed-homework-list';
            const title = document.createElement('h4');
            title.textContent = 'Devoirs terminés';
            container.appendChild(title);
            const ul = document.createElement('ul');
            container.appendChild(ul);
            hwSection.appendChild(container);
        }
        const ul = container.querySelector('ul');
        ul.innerHTML = '';
        doneItems.slice().reverse().forEach(item => {
            const li = document.createElement('li');
            li.className = 'completed-item';
            li.dataset.sujet = item.sujet || '';
            li.innerHTML = `<div style="flex:1"><strong>${escapeHtml(item.sujet)}</strong> — <em>${escapeHtml(item.date)}</em><div style="font-size:0.9em;color:#444">${escapeHtml(item.desc)}</div><div style="font-size:0.8em;color:#666">Terminé le: ${new Date(item.completedAt).toLocaleString()}</div></div><div style="display:flex;gap:6px"><button class="restore" data-id="${item.id}">Restaurer</button><button class="permadelete" data-id="${item.id}">Supprimer</button></div>`;
            ul.appendChild(li);
        });

        // attach events
        container.querySelectorAll('.restore').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const idx = doneItems.findIndex(d => d.id === id);
                if (idx === -1) return;
                const itm = doneItems.splice(idx,1)[0];
                // remove completedAt
                delete itm.completedAt;
                items.push(itm);
                saveAll();
            });
        });
        container.querySelectorAll('.permadelete').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                if (!confirm('Supprimer définitivement ce devoir ?')) return;
                doneItems = doneItems.filter(d => d.id !== id);
                saveAll();
            });
        });
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
        
        // Créer une grille avec position absolue pour les blocs multi-heures
        html += '<div class="daily-grid-container" style="position:relative;max-width:720px;margin-bottom:8px;border:1px solid #ddd;border-radius:8px;overflow:hidden">';
        
        // Timeline avec heures
        html += '<div class="daily-timeline" style="display:flex;flex-direction:column;position:relative;min-height:800px">';
        for (let h=0; h<24; h++) {
            const bgColor = h % 2 === 0 ? '#ffffff' : '#f9f9f9';
            html += `<div class="hour-slot" data-hour="${h}" style="flex:1;min-height:50px;border-bottom:1px solid #e5e7eb;background:${bgColor};position:relative;padding:4px;box-sizing:border-box;display:flex;align-items:flex-start">
                        <div style="width:60px;font-size:12px;font-weight:bold;color:#666;flex-shrink:0">${String(h).padStart(2,'0')}:00</div>
                        <div style="flex:1;min-height:100%;position:relative" class="hour-content"></div>
                     </div>`;
        }
        html += '</div>';
        
        html += '</div>';
        
        html += `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:15px">
                    <input id="block-title" placeholder="Matière / Tâche" style="flex:2;padding:8px;min-width:150px;border:1px solid #ccc;border-radius:6px"/>
                    <input id="block-start" type="number" min="0" max="23" placeholder="début h" style="width:70px;padding:8px;border:1px solid #ccc;border-radius:6px"/>
                    <input id="block-end" type="number" min="0" max="23" placeholder="fin h" style="width:70px;padding:8px;border:1px solid #ccc;border-radius:6px"/>
                    <button id="add-block" style="padding:8px 16px;background:#6366F1;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold">Ajouter bloc</button>
                    <button id="close-daily" style="padding:8px 16px;background:#999;color:white;border:none;border-radius:6px;cursor:pointer">Fermer</button>
                 </div>`;
        container.innerHTML = html;

        const dayBlocks = (schedule[dateStr] || []).slice().sort((a,b)=>a.start-b.start);
        dayBlocks.forEach(b => placeBlockInGrid(b, container, dateStr));

        document.getElementById('add-block').onclick = () => {
            const title = document.getElementById('block-title').value.trim();
            const start = Number(document.getElementById('block-start').value);
            const end = Number(document.getElementById('block-end').value);
            if (!title) { alert('Donnez un titre au bloc.'); return; }
            if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end > 23 || end <= start) { alert('Heures invalides (fin doit être > début).'); return; }
            if (end - start > 10) { alert('Bloc trop long (max 10h).'); return; }
            
            const newBlock = { id: String(Date.now()) + Math.random().toString(36).slice(2,6), title, start, end };
            schedule[dateStr] = schedule[dateStr] || [];
            schedule[dateStr].push(newBlock);
            persistKey(SCHEDULE_KEY, schedule);
            
            // Re-render all blocks
            document.querySelectorAll('.daily-grid-container .time-block').forEach(el => el.remove());
            (schedule[dateStr] || []).forEach(b => placeBlockInGrid(b, container, dateStr));
            
            document.getElementById('block-title').value = '';
            document.getElementById('block-start').value = '';
            document.getElementById('block-end').value = '';
        };

        document.getElementById('close-daily').onclick = () => {
            dailySection.hidden = true;
        };
    }

    function placeBlockInGrid(block, containerElement, dateStr) {
        try {
            const duration = Math.max(1, block.end - block.start);
            const startSlot = containerElement.querySelector(`.hour-slot[data-hour="${block.start}"]`);
            if (!startSlot) return;
            
            // Placer le bloc en position absolue couvrant plusieurs heures
            const blockEl = document.createElement('div');
            blockEl.className = 'time-block';
            blockEl.dataset.id = block.id;
            blockEl.draggable = true;
            
            // Styles pour étendre le bloc sur plusieurs heures
            const blockHeight = duration * 50; // 50px par heure
            blockEl.style.cssText = `
                position: absolute;
                left: 70px;
                top: 4px;
                right: 4px;
                height: ${blockHeight - 8}px;
                background: linear-gradient(135deg, #6366F1, #8b5cf6);
                color: white;
                padding: 8px;
                border-radius: 6px;
                cursor: move;
                user-select: none;
                box-shadow: 0 2px 8px rgba(99,102,241,0.3);
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                overflow: hidden;
                border: 2px solid rgba(255,255,255,0.2);
                z-index: 10;
            `;
            
            const titleEl = document.createElement('div');
            titleEl.style.cssText = 'font-weight:bold;font-size:13px;padding-bottom:4px';
            titleEl.textContent = escapeHtml(block.title);
            
            const timeEl = document.createElement('div');
            timeEl.style.cssText = 'font-size:11px;opacity:0.9';
            timeEl.textContent = `${block.start}h - ${block.end}h`;
            
            blockEl.appendChild(titleEl);
            blockEl.appendChild(timeEl);
            
            // Événements
            blockEl.addEventListener('dragstart', (ev) => {
                ev.dataTransfer.effectAllowed = 'move';
                ev.dataTransfer.setData('blockId', block.id);
                blockEl.style.opacity = '0.7';
            });
            
            blockEl.addEventListener('dragend', (ev) => {
                blockEl.style.opacity = '1';
            });
            
            blockEl.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
                if (!confirm('Supprimer ce bloc ?')) return;
                const dateKey = Object.keys(schedule).find(d => 
                    (schedule[d] || []).find(b => b.id === block.id)
                );
                if (dateKey) {
                    schedule[dateKey] = (schedule[dateKey] || []).filter(b => b.id !== block.id);
                    if (!schedule[dateKey].length) delete schedule[dateKey];
                    persistKey(SCHEDULE_KEY, schedule);
                    renderDailyGrid(dateKey);
                }
            });
            
            // Ajouter le bloc au premier slot de l'heure de début
            startSlot.querySelector('.hour-content').appendChild(blockEl);
            
            // Permettre le drag & drop sur les slots
            containerElement.querySelectorAll('.hour-slot').forEach(slot => {
                slot.addEventListener('dragover', (ev) => {
                    ev.preventDefault();
                    ev.dataTransfer.dropEffect = 'move';
                    slot.style.background = 'rgba(99,102,241,0.1)';
                });
                
                slot.addEventListener('dragleave', (ev) => {
                    slot.style.background = '';
                });
                
                slot.addEventListener('drop', (ev) => {
                    ev.preventDefault();
                    slot.style.background = '';
                    const blockId = ev.dataTransfer.getData('blockId');
                    const newHour = Number(slot.dataset.hour);
                    
                    const dateKey = Object.keys(schedule).find(d => 
                        (schedule[d] || []).find(b => b.id === blockId)
                    );
                    
                    if (dateKey && dateKey === dateStr) {
                        const blockIdx = (schedule[dateKey] || []).findIndex(b => b.id === blockId);
                        if (blockIdx !== -1) {
                            const b = schedule[dateKey][blockIdx];
                            const duration = b.end - b.start;
                            b.start = newHour;
                            b.end = Math.min(24, newHour + duration);
                            persistKey(SCHEDULE_KEY, schedule);
                            
                            // Re-render
                            document.querySelectorAll('.daily-grid-container .time-block').forEach(el => el.remove());
                            (schedule[dateStr] || []).forEach(blk => placeBlockInGrid(blk, containerElement, dateStr));
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Error placing block:', error);
        }
    }

    // ============ COURSES MANAGEMENT ============
    function loadCourses() {
        courses = loadStorage(COURSES_KEY, []);
        // Supprimer tous les cours sans titre
        const initialCount = courses.length;
        courses = courses.filter(c => c && c.title && c.title.trim().length > 0);
        if (courses.length < initialCount) {
            persistKey(COURSES_KEY, courses);
            console.log(`${initialCount - courses.length} cours sans titre supprimé(s)`);
        }
        renderCourseList();
    }

    function saveCourses() {
        persistKey(COURSES_KEY, courses);
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
        
        // Créer le header
        const header = document.createElement('div');
        header.style.cssText = 'background:linear-gradient(135deg, #6366F1, #8b5cf6);color:white;padding:12px 16px;font-weight:bold;border-radius:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center';
        header.innerHTML = `<span>📚 Mes Cours (${courses.length})</span>`;
        ul.parentElement.insertBefore(header, ul);
        
        // Afficher TOUS les cours (complétés et brouillons)
        courses.slice().reverse().forEach(c => {
            const hasContent = c.content && c.content.trim().length > 0;
            renderCourseItem(c, ul, hasContent);
        });
    }
    
    function renderCourseItem(c, ul, isFullCourse) {
        try {
            const li = document.createElement('li');
            const borderColor = isFullCourse ? '#e5e7eb' : '#fde68a';
            const bgColor = isFullCourse ? 'white' : '#fffbeb';
            li.style.cssText = `padding:12px;border:1px solid ${borderColor};margin-bottom:8px;border-radius:6px;background:${bgColor};transition:all 0.2s`;
            li.dataset.courseId = c.id;
            
            const title = escapeHtml(c.title || '(Sans titre)');
            const hasContent = c.content && c.content.trim().length > 0;
            
            const titleDiv = document.createElement('div');
            titleDiv.style.cssText = 'margin-bottom:8px;display:flex;justify-content:space-between;align-items:center';
            titleDiv.innerHTML = `<strong style="color:${isFullCourse ? '#1e293b' : '#b45309'}">${title}</strong> ${hasContent ? '' : '<small style="color:#f59e0b;background:#fef3c7;padding:2px 8px;border-radius:4px;font-size:11px">VIDE</small>'}`;
            li.appendChild(titleDiv);
            
            // Aperçu du contenu (seulement si du contenu existe)
            if (hasContent) {
                const preview = document.createElement('div');
                preview.className = 'course-preview';
                preview.style.cssText = 'font-size:13px;color:#666;margin-bottom:8px;max-height:70px;overflow:hidden;padding:10px;background:#f8fafc;border-left:3px solid #3b82f6;border-radius:4px;line-height:1.5;cursor:pointer';
                preview.style.transition = 'all 0.2s';
                try {
                    const previewText = c.content.replace(/<[^>]*>/g, '').slice(0, 200);
                    preview.textContent = previewText.length >= 200 ? previewText + '...' : previewText;
                } catch (e) {
                    preview.textContent = String(c.content).slice(0, 200);
                }
                preview.addEventListener('mouseover', () => preview.style.background = '#eff6ff');
                preview.addEventListener('mouseout', () => preview.style.background = '#f8fafc');
                preview.addEventListener('click', () => openCourseView(c.id));
                li.appendChild(preview);
            }
            
            // Boutons d'action
            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
            
            const viewBtn = document.createElement('button');
            viewBtn.textContent = '👁️ Voir';
            viewBtn.style.cssText = 'padding:6px 12px;background:#3b82f6;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;flex:1;min-width:70px;transition:all 0.2s';
            viewBtn.addEventListener('mouseover', () => viewBtn.style.background = '#2563eb');
            viewBtn.addEventListener('mouseout', () => viewBtn.style.background = '#3b82f6');
            viewBtn.addEventListener('click', () => openCourseView(c.id));
            
            const editBtn = document.createElement('button');
            editBtn.textContent = '✏️ Éditer';
            editBtn.style.cssText = 'padding:6px 12px;background:#10b981;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;flex:1;min-width:70px;transition:all 0.2s';
            editBtn.addEventListener('mouseover', () => editBtn.style.background = '#059669');
            editBtn.addEventListener('mouseout', () => editBtn.style.background = '#10b981');
            editBtn.addEventListener('click', () => {
                document.getElementById('course-id').value = c.id;
                document.getElementById('course-title').value = c.title;
                document.getElementById('course-content').value = c.content || '';
                document.getElementById('course-title').focus();
                window.scrollTo(0, document.getElementById('cours').offsetTop);
            });
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️ Supprimer';
            deleteBtn.style.cssText = 'padding:6px 12px;background:#ef4444;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;flex:1;min-width:70px;transition:all 0.2s';
            deleteBtn.addEventListener('mouseover', () => deleteBtn.style.background = '#dc2626');
            deleteBtn.addEventListener('mouseout', () => deleteBtn.style.background = '#ef4444');
            deleteBtn.addEventListener('click', () => {
                if (!confirm(`Supprimer le cours "${c.title}" ?`)) return;
                courses = courses.filter(course => course.id !== c.id);
                saveCourses(courses);
                renderCourseList();
            });
            
            actions.appendChild(viewBtn);
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            li.appendChild(actions);
            
            ul.appendChild(li);
        } catch (e) {
            console.error('Erreur renderCourseItem:', e);
        }
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

        editBtn.onclick = () => { 
            const url = `course-editor.html?id=${encodeURIComponent(id)}`;
            window.open(url, '_blank');
            view.hidden = true;
        };
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
        const openEditorBtn = document.getElementById('open-in-editor');
        if (openEditorBtn) {
            openEditorBtn.onclick = () => {
                const url = `course-editor.html?id=${encodeURIComponent(id)}`;
                window.open(url, '_blank');
                view.hidden = true;
            };
        }
    }

    // ============ FORM HANDLERS ============
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            try {
                const sujet = form.elements['Sujet']?.value?.trim() || '';
                const date = form.elements['date-limite']?.value || '';
                const desc = form.elements['description']?.value?.trim() || '';
                const urgence = form.elements['urgence']?.value || '3';
                const difficulte = form.elements['difficulte']?.value || '3';
                const duree = form.elements['duree']?.value || '1';
                
                // Validation
                if (!sujet) { alert('Veuillez entrer un sujet'); return; }
                if (!date) { alert('Veuillez sélectionner une date'); return; }
                if (!desc) { alert('Veuillez entrer une description'); return; }
                if (isNaN(Number(duree)) || Number(duree) < 0) { alert('Durée invalide'); return; }
                
                const pr = computePriority(urgence, difficulte, duree, date);
                const item = {
                    sujet, date, desc,
                    urgence, difficulte, duree,
                    priorityValue: pr.value,
                    priorityLabel: pr.label
                };
                item.id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
                items.push(item);
                saveAll();
                form.reset();
                form.elements['urgence'].value = '3';
                form.elements['difficulte'].value = '3';
                form.elements['duree'].value = '1';
            } catch (error) {
                console.error('Form submission error:', error);
                alert('Une erreur s\'est produite lors de l\'ajout du devoir.');
            }
        });
    }

    if (list) {
        list.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete')) {
                const li = e.target.closest('li');
                const id = li.dataset.id;
                const idx = items.findIndex(it => (it.id || '') === id);
                if (idx !== -1) { items.splice(idx, 1); saveAll(); }
            }

            if (e.target.classList.contains('done')) {
                const li = e.target.closest('li');
                const id = li.dataset.id;
                const idx = items.findIndex(it => (it.id || '') === id);
                if (idx === -1) return;
                // animation
                li.classList.add('task-done');
                // copy item and mark completed
                const itm = items.splice(idx,1)[0];
                itm.completedAt = Date.now();
                if (!itm.id) itm.id = String(Date.now()) + '-' + Math.random().toString(36).slice(2,8);
                doneItems.push(itm);
                // after animation move to completed list and save
                setTimeout(() => {
                    saveAll();
                }, 600);
            }
        });
    }

    const courseForm = document.getElementById('course-form');
    if (courseForm) {
        courseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            try {
                const idField = document.getElementById('course-id');
                const title = document.getElementById('course-title')?.value?.trim() || '';
                const content = document.getElementById('course-content')?.value?.trim() || '';
                
                // Validation
                if (!title && !content) { alert('Veuillez entrer au moins un titre ou du contenu'); return; }
                if (!title) { alert('Veuillez entrer un titre'); return; }
                
                let courseId;
                if (idField && idField.value) {
                    const id = idField.value;
                    const idx = courses.findIndex(x => x.id === id);
                    if (idx !== -1) {
                        courses[idx].title = title;
                        courses[idx].content = content;
                        courses[idx].updated = Date.now();
                        courseId = id;
                    }
                } else {
                    courseId = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
                    const newCourse = { id: courseId, title, content, created: Date.now() };
                    courses.push(newCourse);
                }
                
                document.getElementById('course-id').value = '';
                document.getElementById('course-title').value = '';
                document.getElementById('course-content').value = '';
                saveCourses();
                document.getElementById('course-view').hidden = true;
                
                // Message de succès
                const btn = courseForm.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
                btn.textContent = '✅ Enregistré!';
                btn.style.background = '#10b981';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                }, 2000);
            } catch (error) {
                console.error('Course form error:', error);
                alert('Erreur lors de l\'enregistrement du cours');
            }
        });
    }

    // open full-screen course editor for new course
    document.getElementById('open-course-editor')?.addEventListener('click', () => {
        window.open('course-editor.html', '_blank');
    });

    // ============ SAVE/LOAD ALL ============
    function saveAll() {
        // persist locally
        saveStorage(STORAGE_KEY, items);
        saveStorage(SCHEDULE_KEY, schedule);
        saveStorage(DONE_KEY, doneItems);

        // persist to backend if requested
        if (window.USE_BACKEND) {
            try {
                apiFetch('/api/homeworks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(items) }).catch(()=>{});
                apiFetch('/api/schedule', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(schedule) }).catch(()=>{});
                apiFetch('/api/done', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doneItems) }).catch(()=>{});
                apiFetch('/api/courses', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(courses) }).catch(()=>{});
                apiFetch('/api/goals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(goals) }).catch(()=>{});
            } catch (e) { console.warn('Backend save failed', e); }
        }

        renderAll();
        renderCompletedList();
        if (current.year !== null) renderCalendar(current.year, current.month);
        updateStats();
    }

    function loadAll() {
        items = loadStorage(STORAGE_KEY, []);
        doneItems = loadStorage(DONE_KEY, []);
        schedule = loadStorage(SCHEDULE_KEY, {});

        if (window.USE_BACKEND) {
            // prefer backend data if available
            Promise.all([
                apiFetch('/api/homeworks').then(r=>r.ok? r.json(): {value:null}).catch(()=>({value:null})),
                apiFetch('/api/done').then(r=>r.ok? r.json(): {value:null}).catch(()=>({value:null})),
                apiFetch('/api/schedule').then(r=>r.ok? r.json(): {value:null}).catch(()=>({value:null})),
                apiFetch('/api/courses').then(r=>r.ok? r.json(): {value:null}).catch(()=>({value:null})),
                apiFetch('/api/goals').then(r=>r.ok? r.json(): {value:null}).catch(()=>({value:null})),
            ]).then(([hwRes, doneRes, schedRes, coursesRes, goalsRes]) => {
                if (hwRes && hwRes.value !== null) items = hwRes.value || [];
                if (doneRes && doneRes.value !== null) doneItems = doneRes.value || [];
                if (schedRes && schedRes.value !== null) schedule = schedRes.value || {};
                if (coursesRes && coursesRes.value !== null) courses = coursesRes.value || [];
                if (goalsRes && goalsRes.value !== null) goals = goalsRes.value || [];

                renderAll();
                renderCompletedList();
                const now = new Date();
                renderCalendar(now.getFullYear(), now.getMonth());
                const prev = document.getElementById('prev-month');
                const next = document.getElementById('next-month');
                if (prev) prev.addEventListener('click', () => changeMonth(-1));
                if (next) next.addEventListener('click', () => changeMonth(1));
            }).catch(e => {
                console.warn('Failed to load from backend', e);
                renderAll();
                renderCompletedList();
                const now = new Date();
                renderCalendar(now.getFullYear(), now.getMonth());
                const prev = document.getElementById('prev-month');
                const next = document.getElementById('next-month');
                if (prev) prev.addEventListener('click', () => changeMonth(-1));
                if (next) next.addEventListener('click', () => changeMonth(1));
            });
            return;
        }

        renderAll();
        renderCompletedList();
        const now = new Date();
        renderCalendar(now.getFullYear(), now.getMonth());
        const prev = document.getElementById('prev-month');
        const next = document.getElementById('next-month');
        if (prev) prev.addEventListener('click', () => changeMonth(-1));
        if (next) next.addEventListener('click', () => changeMonth(1));
    }

    // ============ DATABASE MANAGEMENT ============
    /**
     * Exporte toutes les données en fichier JSON
     */
    function exportDatabase() {
        try {
            const allData = {
                version: '2.0.0',
                exportDate: new Date().toISOString(),
                homeworks: items,
                finishedHomeworks: doneItems,
                schedule: schedule,
                courses: courses,
                goals: goals
            };
            
            const dataStr = JSON.stringify(allData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `orgastudy-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            alert('✅ Sauvegarde exportée avec succès !');
        } catch (error) {
            console.error('Export error:', error);
            alert('❌ Erreur lors de l\'export');
        }
    }

    /**
     * Importe les données depuis un fichier JSON
     */
    function importDatabase() {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const content = event.target?.result;
                        if (typeof content !== 'string') {
                            alert('❌ Format de fichier invalide');
                            return;
                        }
                        
                        const data = JSON.parse(content);
                        
                        // Vérifier la structure
                        if (!data.homeworks || !data.schedule || !data.courses || !data.goals) {
                            alert('❌ Format de sauvegarde invalide. Ce fichier ne semble pas être une sauvegarde OrgaStudy valide.');
                            return;
                        }
                        
                        // Confirmer l'import
                        if (!confirm('⚠️ Cela va remplacer toutes vos données actuelles. Continuer?\n\n' + 
                            `Devoirs: ${data.homeworks?.length || 0}\n` +
                            `Cours: ${data.courses?.length || 0}\n` +
                            `Objectifs: ${data.goals?.length || 0}`)) {
                            return;
                        }
                        
                        // Importer les données
                        items = data.homeworks || [];
                        doneItems = data.finishedHomeworks || [];
                        schedule = data.schedule || {};
                        courses = data.courses || [];
                        goals = data.goals || [];
                        
                        // Sauvegarder
                        saveAll();
                        alert('✅ Données importées avec succès !');
                    } catch (error) {
                        console.error('Import parse error:', error);
                        alert('❌ Erreur lors de la lecture du fichier');
                    }
                };
                reader.readAsText(file);
            });
            input.click();
        } catch (error) {
            console.error('Import error:', error);
            alert('❌ Erreur lors de l\'import');
        }
    }

    /**
     * Efface toutes les données
     */
    function clearAllData() {
        if (!confirm('⚠️ ATTENTION! Cela va SUPPRIMER DÉFINITIVEMENT toutes vos données.\n\nÊtes-vous sûr?')) {
            return;
        }
        if (!confirm('Dernière confirmation: tous les devoirs, cours, objectifs et planifications seront perdus!')) {
            return;
        }
        
        try {
            items = [];
            doneItems = [];
            schedule = {};
            courses = [];
            goals = [];
            
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(DONE_KEY);
            localStorage.removeItem(SCHEDULE_KEY);
            localStorage.removeItem(COURSES_KEY);
            localStorage.removeItem(GOALS_KEY);
            
            saveAll();
            alert('✅ Toutes les données ont été supprimées');
        } catch (error) {
            console.error('Clear data error:', error);
            alert('❌ Erreur lors de la suppression');
        }
    }

    /**
     * Obtient les statistiques de la base de données
     */
    function getDatabaseStats() {
        const stats = {
            homeworks: items.length,
            finishedHomeworks: doneItems.length,
            courses: courses.length,
            goals: goals.length,
            scheduleDates: Object.keys(schedule).length,
            storageSizeBytes: JSON.stringify({items, doneItems, schedule, courses, goals}).length,
            lastModified: new Date().toLocaleString('fr-FR')
        };
        return stats;
    }

    // Ajouter les événements pour les boutons de gestion de BD
    // (Ces boutons seront ajoutés à l'interface si nécessaire)
    window.exportDatabase = exportDatabase;
    window.importDatabase = importDatabase;
    window.clearAllData = clearAllData;
    window.getDatabaseStats = getDatabaseStats;    // ============ TOOLS: ENHANCED TIMER ============
    (function(){
        const display = document.getElementById('timer-display');
        const startBtn = document.getElementById('start-timer');
        const stopBtn = document.getElementById('stop-timer');
        const resetBtn = document.getElementById('reset-timer');
        const lapBtn = document.getElementById('timer-lap');
        const lapsList = document.getElementById('laps-list');
        const countdownInput = document.getElementById('countdown-minutes');
        const ring = document.getElementById('timer-ring-circle');
        let mode = 'stopwatch'; // or 'countdown'
        let interval = null;
        let elapsed = 0; // seconds
        let remaining = 0; // seconds for countdown
        let countdownTotal = 0;
        let laps = [];

        function formatHMS(s){
            const hrs = Math.floor(s/3600);
            const mins = Math.floor((s%3600)/60);
            const secs = Math.floor(s%60);
            return `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        }

        function updateRing(){
            if(!ring) return;
            const circumference = 2 * Math.PI * 50; // r=50
            let pct = 0;
            if(mode === 'countdown' && countdownTotal>0){
                pct = Math.max(0, Math.min(1, remaining / countdownTotal));
            } else {
                // stopwatch: show progress relative to 1 hour
                pct = Math.min(1, (elapsed % 3600) / 3600);
            }
            const offset = Math.round(circumference * (1 - pct));
            ring.style.strokeDashoffset = offset;
        }

        function updateDisplay(){
            if(!display) return;
            if(mode === 'countdown') display.textContent = formatHMS(remaining);
            else display.textContent = formatHMS(elapsed);
            updateRing();
        }

        function setMode(m){
            mode = m === 'countdown' ? 'countdown' : 'stopwatch';
            if(mode === 'countdown'){
                countdownTotal = Math.max(1, Number(countdownInput.value) || 25) * 60;
                if(remaining === 0) remaining = countdownTotal;
            }
            updateDisplay();
        }

        // mode radio
        document.querySelectorAll('input[name="timer-mode"]').forEach(r => r.addEventListener('change', (e)=> setMode(e.target.value)));

        function startTimer(){
            if(interval) return;
            if(mode === 'countdown' && remaining <= 0){
                countdownTotal = Math.max(1, Number(countdownInput.value) || 25) * 60;
                remaining = countdownTotal;
            }
            interval = setInterval(() => {
                if(mode === 'countdown'){
                    remaining = Math.max(0, remaining - 1);
                    if(remaining <= 0){
                        clearInterval(interval); interval = null;
                        // finished
                        triggerTimerFinished();
                    }
                } else {
                    elapsed += 1;
                }
                updateDisplay();
            }, 1000);
            startBtn.textContent = 'En cours...';
        }

        function pauseTimer(){
            if(interval){ clearInterval(interval); interval = null; startBtn.textContent = 'Reprendre'; }
        }

        function resetTimer(){
            if(interval) { clearInterval(interval); interval = null; }
            elapsed = 0; remaining = 0; laps = []; if(lapsList) lapsList.innerHTML = '';
            if(mode === 'countdown'){
                countdownTotal = Math.max(1, Number(countdownInput.value) || 25) * 60;
                remaining = countdownTotal;
            }
            startBtn.textContent = 'Démarrer';
            updateDisplay();
        }

        function addLap(){
            const time = mode === 'countdown' ? (countdownTotal - remaining) : elapsed;
            const id = String(Date.now()) + Math.random().toString(36).slice(2,6);
            const obj = { id, time, label: formatHMS(time) };
            laps.unshift(obj);
            renderLaps();
        }

        function renderLaps(){
            if(!lapsList) return;
            lapsList.innerHTML = '';
            laps.forEach(l => {
                const li = document.createElement('li');
                li.textContent = l.label;
                const btn = document.createElement('button'); btn.textContent = 'Supprimer'; btn.style.marginLeft='8px';
                btn.addEventListener('click', ()=>{ laps = laps.filter(x=>x.id!==l.id); renderLaps(); });
                li.appendChild(btn);
                lapsList.appendChild(li);
            });
        }

        function triggerTimerFinished(){
            // small visual and sound
            alert('⏰ Minuteur terminé');
            try { const ctx = new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value=880; o.start(); g.gain.setValueAtTime(0.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.6); o.stop(ctx.currentTime+0.7);}catch(e){}
            startBtn.textContent = 'Démarrer';
        }

        // attach
        startBtn?.addEventListener('click', startTimer);
        stopBtn?.addEventListener('click', pauseTimer);
        resetBtn?.addEventListener('click', resetTimer);
        lapBtn?.addEventListener('click', addLap);

        // initialize
        setMode('stopwatch');
        updateDisplay();
    })();

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
let calcDisplay = document.getElementById('calc-input');
let calcExpression = '';
let lastValue = '';

document.querySelectorAll('.calc-btn').forEach(button => {
    button.addEventListener('click', () => {
        const value = button.dataset.value;
        
        if (value === 'C') {
            // Clear
            calcExpression = '';
            calcDisplay.value = '0';
            lastValue = '';
        } else if (value === '=') {
            // Calculate
            try {
                const expr = calcExpression.trim();
                const hasUnit = /\bdeg\b|\brad\b/i.test(expr);
                let result;
                if (!hasUnit && typeof calcTrigMode !== 'undefined' && calcTrigMode === 'deg') {
                    // temporarily apply deg wrappers to math, evaluate, then restore
                    try {
                        window.applyDegWrappers && window.applyDegWrappers();
                        result = math.evaluate(expr);
                    } finally {
                        window.restoreMath && window.restoreMath();
                    }
                } else {
                    result = math.evaluate(expr);
                }
                calcDisplay.value = result;
                calcExpression = String(result);
                lastValue = String(result);
                // small visual animation to indicate result
                try {
                    calcDisplay.classList.add('calc-eval-anim');
                    setTimeout(() => calcDisplay.classList.remove('calc-eval-anim'), 520);
                } catch (e) {}
            } catch (e) {
                calcDisplay.value = 'Erreur';
                calcExpression = '';
                lastValue = '';
            }
            } else if (['+', '-', '×', '÷', '/', '.'].includes(value)) {
            // Operators and decimal
            if (calcExpression === '' && value !== '.') {
                return; // Ne pas commencer par un opérateur
            }
                const operator = value === '×' ? '*' : (value === '÷' ? '/' : value);
            
            // Éviter les opérateurs successifs
                if (['+', '-', '*', '/'].includes(calcExpression.slice(-1)) && ['+', '-', '*', '/'].includes(operator)) {
                calcExpression = calcExpression.slice(0, -1) + operator;
            } else {
                calcExpression += operator;
            }
            
            calcDisplay.value = calcExpression.replace(/\*/g, '×').replace(/\//g, '÷');
            lastValue = '';
        } else {
            // Numbers
            calcExpression += value;
            calcDisplay.value = calcExpression;
            lastValue = value;
        }
    });
});

// ===== Calculator: help modal and DEG/RAD toggle =====
(function(){
    const modeBtn = document.getElementById('calc-mode-toggle');
    const helpBtn = document.getElementById('calc-help');
    let calcTrigMode = 'rad'; // 'rad' or 'deg'

    // store originals and expose wrappers on window for calculator evaluator
    window._math_orig = window._math_orig || {
        sin: math.sin,
        cos: math.cos,
        tan: math.tan,
        asin: math.asin,
        acos: math.acos,
        atan: math.atan
    };

    window.applyDegWrappers = function(){
        math.import({
            sin: function(x){ return Math.sin((x) * Math.PI/180); },
            cos: function(x){ return Math.cos((x) * Math.PI/180); },
            tan: function(x){ return Math.tan((x) * Math.PI/180); },
            asin: function(x){ return Math.asin(x) * 180/Math.PI; },
            acos: function(x){ return Math.acos(x) * 180/Math.PI; },
            atan: function(x){ return Math.atan(x) * 180/Math.PI; }
        }, { override: true });
    };

    window.restoreMath = function(){
        math.import(window._math_orig, { override: true });
    };

    function setMode(m) {
        calcTrigMode = m === 'deg' ? 'deg' : 'rad';
        if (modeBtn) modeBtn.textContent = calcTrigMode === 'deg' ? 'DEG' : 'RAD';
        const label = document.getElementById('calc-mode-label');
        if (label) label.textContent = calcTrigMode === 'deg' ? 'DEG' : 'RAD';
        // persist preference
        try { localStorage.setItem('calc_trig_mode', calcTrigMode); } catch (e) {}
        if (calcTrigMode === 'deg') window.applyDegWrappers(); else window.restoreMath();
        // visual feedback
        try {
            const el = label || modeBtn;
            if (el) {
                el.classList.add('calc-mode-flash');
                setTimeout(() => el.classList.remove('calc-mode-flash'), 380);
            }
        } catch (e) {}
    }

    // initial
    try {
        const stored = localStorage.getItem('calc_trig_mode') || 'rad';
        setMode(stored);
    } catch (e) { setMode('rad'); }

    modeBtn?.addEventListener('click', () => {
        setMode(calcTrigMode === 'rad' ? 'deg' : 'rad');
    });

    // make mode label clickable too
    const modeLabel = document.getElementById('calc-mode-label');
    if (modeLabel) {
        modeLabel.classList.add('clickable');
        modeLabel.addEventListener('click', () => { setMode(calcTrigMode === 'rad' ? 'deg' : 'rad'); });
    }

    // help modal
    helpBtn?.addEventListener('click', () => {
        const overlay = document.createElement('div'); overlay.className = 'calc-help-overlay';
        const modal = document.createElement('div'); modal.className = 'calc-help-modal';
        modal.innerHTML = `
            <h4>Aide Calculatrice</h4>
            <p>Exemples d'expressions supportées :</p>
            <p><strong>Puissance:</strong> <code>2^8</code> → 256</p>
            <p><strong>Racine:</strong> <code>sqrt(9)</code> → 3</p>
            <p><strong>Modulo:</strong> <code>5 % 2</code> → 1</p>
            <p><strong>Fonctions trig:</strong> <code>sin(30)</code>, <code>cos(45)</code></p>
            <p>Utilise le bouton <span class="calc-mode-indicator">DEG/RAD</span> pour basculer entre degrés et radians pour les fonctions trigonométriques.</p>
            <div style="text-align:right;margin-top:8px"><button id="calc-help-close">Fermer</button></div>
        `;
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        document.getElementById('calc-help-close')?.addEventListener('click', () => { modal.remove(); overlay.remove(); });
        overlay.addEventListener('click', () => { modal.remove(); overlay.remove(); });
    });

})();

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
        persistKey(GOALS_KEY, goals);
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
        try {
            if (idx < 0 || idx >= goals.length) {
                console.error('Invalid goal index:', idx);
                return;
            }
            const g = goals[idx];
            const newProgress = prompt('Nouvelle progression (0-100):', g.progress);
            if (newProgress === null) return;
            
            const progressNum = Math.max(0, Math.min(100, parseInt(newProgress, 10)));
            if (isNaN(progressNum)) {
                alert('Veuillez entrer un nombre valide');
                return;
            }
            
            const oldProgress = g.progress;
            g.progress = progressNum;
            
            // Si l'objectif vient d'atteindre 100%
            if (oldProgress !== 100 && g.progress === 100) {
                triggerCelebration();
            }
            
            saveGoals();
        } catch (error) {
            console.error('Edit goal error:', error);
            alert('Erreur lors de la modification de l\'objectif');
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
            try {
                const title = document.getElementById('goal-title')?.value?.trim() || '';
                const deadline = document.getElementById('goal-deadline')?.value || '';
                
                // Validation
                if (!title) { alert('Veuillez entrer un objectif'); return; }
                if (!deadline) { alert('Veuillez sélectionner une date'); return; }
                
                // Validate deadline is in the future
                const deadlineDate = new Date(deadline);
                const today = new Date();
                if (deadlineDate < today) {
                    alert('La date limite doit être dans le futur');
                    return;
                }
                
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
            } catch (error) {
                console.error('Goals form error:', error);
                alert('Erreur lors de l\'ajout de l\'objectif');
            }
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
        
        // Mettre à jour aussi les stats de la BD
        updateDatabaseStats();
    }
    
    function updateDatabaseStats() {
        try {
            const stats = getDatabaseStats();
            const sizeKB = (stats.storageSizeBytes / 1024).toFixed(2);
            
            document.getElementById('db-homeworks').textContent = stats.homeworks;
            document.getElementById('db-courses').textContent = stats.courses;
            document.getElementById('db-goals').textContent = stats.goals;
            document.getElementById('db-size').textContent = sizeKB + ' KB';
        } catch (error) {
            console.error('Error updating database stats:', error);
        }
    }

    // ============ INIT ============
    loadAll();
    loadCourses();
    loadGoals();
    updateStats();
});