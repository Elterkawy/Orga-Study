(function(){
  const STORAGE_KEY = 'orga_courses';
  // detect API base (same logic as main app)
  const API_BASE = window.API_BASE || (location.protocol === 'file:' ? 'http://localhost:3000' : '');
  function apiFetch(path, opts){
    const url = (path.startsWith('http://')||path.startsWith('https://'))?path:(API_BASE?API_BASE+path:path);
    return fetch(url, opts);
  }

  function loadLocal(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }catch(e){return []}
  }
  function saveLocal(data){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }catch(e){console.warn(e);} }

  const titleEl = document.getElementById('course-title');
  const editor = document.getElementById('editor');
  const saveBtn = document.getElementById('save-course');
  const saveContinueBtn = document.getElementById('save-continue');
  const cancelBtn = document.getElementById('cancel');

  // toolbar actions
  document.querySelectorAll('.toolbar button').forEach(b=>{
    b.addEventListener('click', ()=>{
      const cmd = b.dataset.cmd;
      if(cmd === 'h1' || cmd === 'h2'){
        document.execCommand('formatBlock', false, cmd === 'h1' ? 'h1' : 'h2');
      } else if(cmd === 'clearFormatting'){
        document.execCommand('removeFormat');
      } else if(cmd === 'createLink'){
        const url = prompt('URL du lien:'); if(url) document.execCommand('createLink', false, url);
      } else if(cmd === 'insertImage'){
        const url = prompt('URL de l\'image:'); if(url) document.execCommand('insertImage', false, url);
      } else {
        document.execCommand(cmd);
      }
      editor.focus();
    });
  });

  // helper to persist course
  function persistCourseObj(obj){
    // save locally
    const arr = loadLocal();
    const idx = arr.findIndex(c=>c.id === obj.id);
    if(idx !== -1) arr[idx] = obj; else arr.push(obj);
    saveLocal(arr);
    // try backend
    if(API_BASE){
      apiFetch('/api/courses', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(arr)}).catch(()=>{});
    }
  }

  // autosave every N seconds
  const AUTOSAVE_INTERVAL_SEC = 15;
  const autosaveIndicator = document.getElementById('autosave-indicator');
  let autosaveTimer = null;
  function startAutosave() {
    if (autosaveTimer) return;
    if (autosaveIndicator) autosaveIndicator.textContent = `Every ${AUTOSAVE_INTERVAL_SEC}s`;
    autosaveTimer = setInterval(() => {
      try {
        const obj = buildCourseObj();
        persistCourseObj(obj);
        if (autosaveIndicator) autosaveIndicator.textContent = `Saved ${new Date().toLocaleTimeString()}`;
      } catch (e) { console.warn('Autosave failed', e); }
    }, AUTOSAVE_INTERVAL_SEC * 1000);
  }
  function stopAutosave(){ if (autosaveTimer) { clearInterval(autosaveTimer); autosaveTimer = null; if (autosaveIndicator) autosaveIndicator.textContent = 'Off'; } }

  // start autosave by default
  startAutosave();

  // load if editing existing id from query
  function qsGet(name){ const params = new URLSearchParams(location.search); return params.get(name); }
  const editingId = qsGet('id');
  if(editingId){
    // try load from backend then fallback local
    if(API_BASE){
      apiFetch('/api/courses').then(r=>r.ok? r.json(): Promise.reject()).then(res=>{
        if(res && res.value){
          const found = (res.value||[]).find(c=>c.id === editingId);
          if(found){ titleEl.value = found.title||''; editor.innerHTML = found.content||''; }
        }
      }).catch(()=>{
        const arr = loadLocal(); const found = arr.find(c=>c.id === editingId); if(found){ titleEl.value = found.title||''; editor.innerHTML = found.content||''; }
      });
    } else {
      const arr = loadLocal(); const found = arr.find(c=>c.id === editingId); if(found){ titleEl.value = found.title||''; editor.innerHTML = found.content||''; }
    }
  }

  function buildCourseObj(){
    const now = Date.now();
    return {
      id: editingId || (String(now) + '-' + Math.random().toString(36).slice(2,8)),
      title: titleEl.value.trim(),
      content: editor.innerHTML,
      updated: now,
      created: editingId? undefined : now
    };
  }

  saveBtn.addEventListener('click', ()=>{
    const obj = buildCourseObj();
    persistCourseObj(obj);
    // close window after save
    stopAutosave();
    window.close();
  });
  saveContinueBtn.addEventListener('click', ()=>{
    const obj = buildCourseObj(); persistCourseObj(obj); alert('Sauvegardé.');
  });
  cancelBtn.addEventListener('click', ()=>{ if(confirm('Fermer sans sauvegarder ?')) window.close(); });

  // focus editor on open
  setTimeout(()=>{ editor.focus(); },200);

})();
