(() => {
  'use strict';
  const storageKey = 'bfih-sae-calendar-v1';
  const $ = id => document.getElementById(id);
  const key = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  let selected = key(new Date()), month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let notes = [], editing = null, storageReady = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(saved) || saved.some(n => !n || typeof n.id !== 'string' || typeof n.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(n.date) || typeof n.title !== 'string' || typeof n.details !== 'string')) throw new Error('Invalid notes');
    notes = saved;
  } catch {
    storageReady = false;
    $('calendarMessage').textContent = 'Cannot read saved notes. Saving is disabled to protect existing data. Check browser storage settings.';
    $('calendarForm').querySelector('button[type="submit"]').disabled = true;
  }
  function save(next) {
    if (!storageReady) return false;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); notes = next; return true; }
    catch { $('calendarMessage').textContent = 'Could not save. Your changes are still in the form. Check browser storage space and permissions.'; return false; }
  }
  function resetForm() {
    editing = null; $('calendarForm').reset(); $('calendarFormTitle').textContent = 'Add note'; $('calendarCancel').hidden = true;
  }
  function render() {
    $('calendarMonth').textContent = month.toLocaleDateString('en-GB', {month:'long', year:'numeric'});
    $('calendarDays').replaceChildren();
    const offset = (month.getDay()+6)%7;
    for (let i=0; i<42; i++) {
      const date = new Date(month.getFullYear(), month.getMonth(), i-offset+1), dateKey = key(date);
      const entries = notes.filter(n=>n.date===dateKey);
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'calendar-day' + (date.getMonth()!==month.getMonth()?' outside':'') + (dateKey===key(new Date())?' today':'');
      button.setAttribute('aria-pressed', String(dateKey===selected));
      button.setAttribute('aria-label', dateKey + (entries.length?`, ${entries.length} notes`:''));
      const number = document.createElement('span'); number.textContent = date.getDate(); button.append(number);
      entries.slice(0,2).forEach(n=>{const label=document.createElement('small'); label.textContent=(n.important?'★ ':'')+n.title; label.className=n.important?'important':''; button.append(label);});
      if(entries.length>2){const more=document.createElement('small');more.textContent=`+${entries.length-2} more`;button.append(more);}
      button.onclick=()=>{selected=dateKey;month=new Date(date.getFullYear(),date.getMonth(),1);resetForm();render();};
      $('calendarDays').append(button);
    }
    $('calendarSelected').textContent = new Date(selected+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric'});
    $('calendarNoteList').replaceChildren();
    const entries=notes.filter(n=>n.date===selected);
    if(!entries.length){const empty=document.createElement('p');empty.textContent='No notes yet. Add an important task below.';$('calendarNoteList').append(empty);}
    entries.forEach(note=>{
      const item=document.createElement('div'); item.className='calendar-note';
      const title=document.createElement('strong');title.textContent=(note.important?'★ ':'')+note.title;
      const details=document.createElement('p');details.textContent=note.details;
      const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.className='btn secondary';
      edit.onclick=()=>{editing=note.id;$('calendarTitle').value=note.title;$('calendarDetails').value=note.details;$('calendarImportant').checked=!!note.important;$('calendarFormTitle').textContent='Edit note';$('calendarCancel').hidden=false;$('calendarTitle').focus();};
      const remove=document.createElement('button');remove.type='button';remove.textContent='Delete';remove.className='btn secondary';
      remove.onclick=()=>{if(confirm('Delete this note?') && save(notes.filter(n=>n.id!==note.id))){resetForm();render();$('calendarMessage').textContent='Note deleted.';}};
      item.append(title,details,edit,remove);$('calendarNoteList').append(item);
    });
  }
  $('calendarForm').onsubmit=event=>{
    event.preventDefault();const title=$('calendarTitle').value.trim();if(!title){$('calendarTitle').focus();return;}
    const note={id:editing||crypto.randomUUID(),date:selected,title,details:$('calendarDetails').value.trim(),important:$('calendarImportant').checked};
    const next=editing?notes.map(n=>n.id===editing?note:n):[...notes,note];
    if(save(next)){resetForm();render();$('calendarMessage').textContent='Note saved in this browser.';}
  };
  $('calendarCancel').onclick=resetForm;
  $('calendarPrev').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);render();};
  $('calendarNext').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);render();};
  $('calendarToday').onclick=()=>{selected=key(new Date());month=new Date(new Date().getFullYear(),new Date().getMonth(),1);resetForm();render();};
  // Capture navigation before the dashboard's existing section-scroll handler.
  document.querySelector('.nav').addEventListener('click',event=>{
    const link=event.target.closest('[data-page]');if(!link)return;
    const page=link.dataset.page;if(!['calendar','dashboard','import','manufacture'].includes(page))return;
    event.preventDefault();event.stopImmediatePropagation();
    $('dashboardView').hidden=page==='calendar';$('calendarView').hidden=page!=='calendar';
    document.querySelectorAll('.nav-link').forEach(el=>el.classList.toggle('active',el===link));
    if(page==='calendar')render();
    else if(page!=='dashboard')$(page==='import'?'importSection':'manufactureSection').scrollIntoView({behavior:'smooth'});
  },true);
})();
