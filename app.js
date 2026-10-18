(() => {
  'use strict';
  const STORAGE_KEY = 'equipe-inspecao-pj-v1';
  const state = { workers: loadWorkers(), activePage: 'overview' };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initials = name => String(name || 'PJ').trim().split(/\s+/).slice(0,2).map(part => part[0] || '').join('').toUpperCase();
  const groupColors = ['c1','c2','c3','c4'];
  const groupColorVars = ['#3286d1','#18a799','#e3a438','#8a78d5'];

  function loadWorkers() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workers));
    render();
  }
  function sortedWorkers(workers = state.workers) {
    return [...workers].sort((a,b) => String(a.name).localeCompare(String(b.name),'pt-BR'));
  }
  function setDate() {
    const now = new Date();
    $('#currentDate').textContent = new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(now).replace('.', '');
  }
  function setPage(page) {
    state.activePage = page;
    $$('.page').forEach(el => el.classList.toggle('active', el.id === `page-${page}`));
    $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    const labels = {overview:'Visão geral',team:'Equipe','days-off':'Grupos de folga',management:'Gestão do sistema'};
    $('#breadcrumbPage').textContent = labels[page] || 'Visão geral';
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function badgeGroup(group) {
    if (!group) return '<span class="group-tag unset">Sem grupo</span>';
    return `<span class="group-tag g${Number(group)}">Folga ${escapeHTML(group)}</span>`;
  }
  function badgeStatus(status) {
    return `<span class="status-tag ${status === 'Inativo' ? 'inactive' : ''}">${escapeHTML(status || 'Ativo')}</span>`;
  }
  function personCell(worker, index = 0) {
    const tone = `tone-${index % 4}`;
    return `<div class="person-cell"><span class="person-avatar ${tone}">${escapeHTML(initials(worker.name))}</span><span><span class="person-name">${escapeHTML(worker.name)}</span>${worker.leader ? `<span class="person-meta">${escapeHTML(worker.leader)}</span>` : ''}</span></div>`;
  }
  function rowMenu(worker) {
    return `<button class="row-menu" data-edit="${escapeHTML(worker.id)}" aria-label="Editar ${escapeHTML(worker.name)}" title="Editar perfil">···</button>`;
  }
  function teamRow(worker, index) {
    return `<tr><td>${personCell(worker,index)}</td><td class="registration">${escapeHTML(worker.registration || '—')}</td><td>${worker.shift ? `<span class="shift-tag">${escapeHTML(worker.shift)}</span>` : '<span class="person-meta">Não definido</span>'}</td><td>${badgeGroup(worker.group)}</td><td class="role-text">${escapeHTML(worker.role || 'Inspetor')}</td><td>${badgeStatus(worker.status)}</td><td>${rowMenu(worker)}</td></tr>`;
  }
  function renderOverview() {
    const workers = sortedWorkers();
    const assigned = workers.filter(w => w.group && ['1','2','3','4'].includes(String(w.group))).length;
    const unassigned = workers.length - assigned;
    $('#metricTotal').textContent = workers.length;
    $('#metricAssigned').textContent = assigned;
    $('#metricUnassigned').textContent = unassigned;
    $('#assignedCaption').textContent = `${workers.length ? Math.round(assigned/workers.length*100) : 0}% da equipe`;
    $('#navTeamCount').textContent = workers.length;
    $('#importBanner').classList.toggle('hidden', workers.length > 0);
    $('#overviewEmpty').classList.toggle('visible', workers.length === 0);
    $('#overviewTable').innerHTML = workers.slice(0,6).map(teamRow).join('');
    $('#groupBars').innerHTML = [1,2,3,4].map((g,i) => {
      const count = workers.filter(w => String(w.group) === String(g)).length;
      const max = Math.max(1,...[1,2,3,4].map(n => workers.filter(w => String(w.group) === String(n)).length));
      return `<div class="group-bar-row"><span class="group-label">Folga ${g}</span><div class="bar-track"><div class="bar-fill ${groupColors[i]}" style="width:${count ? Math.max(8,count/max*100) : 0}%"></div></div><span class="bar-count">${count}</span></div>`;
    }).join('');
    const counts = [1,2,3,4].map(g => workers.filter(w => String(w.group) === String(g)).length);
    const spread = Math.max(...counts) - Math.min(...counts);
    const callout = unassigned ? `<span class="balance-icon">✳</span><span><strong>${unassigned} integrante${unassigned===1?'':'s'} sem grupo.</strong> Distribua para completar o quadro.</span>` : workers.length ? `<span class="balance-icon">✓</span><span><strong>${spread <= 1 ? 'Grupos equilibrados.' : 'Revise o equilíbrio dos grupos.'}</strong> Diferença atual de ${spread} integrante${spread===1?'':'s'} entre o maior e o menor grupo.</span>` : `<span class="balance-icon">i</span><span>Importe a planilha e defina os grupos de folga da equipe.</span>`;
    $('#balanceCallout').innerHTML = callout;
  }
  function renderTeam() {
    const query = $('#searchInput').value.trim().toLocaleLowerCase('pt-BR');
    const groupFilter = $('#groupFilter').value;
    const shiftFilter = $('#shiftFilter').value;
    const workers = sortedWorkers().filter(w => {
      const matchesQuery = !query || `${w.name} ${w.registration}`.toLocaleLowerCase('pt-BR').includes(query);
      const matchesGroup = groupFilter === 'all' || (groupFilter === 'none' ? !w.group : String(w.group) === groupFilter);
      const matchesShift = shiftFilter === 'all' || (shiftFilter === 'none' ? !w.shift : w.shift === shiftFilter);
      return matchesQuery && matchesGroup && matchesShift;
    });
    $('#teamTable').innerHTML = workers.map(teamRow).join('');
    $('#teamEmpty').classList.toggle('visible', workers.length === 0);
    $('#resultCount').textContent = `${workers.length} integrante${workers.length===1?'':'s'}`;
  }
  function renderDayOff() {
    const workers = sortedWorkers();
    const groups = [1,2,3,4].map(g => workers.filter(w => String(w.group) === String(g)));
    $('#dayoffCards').innerHTML = groups.map((members,i) => `<article class="dayoff-card" style="--color:${groupColorVars[i]};--tint:${['#e8f2fc','#e4f6f1','#fff4df','#f0edfc'][i]}"><div class="dayoff-top"><span class="dayoff-title">Grupo Folga ${i+1}</span><span class="dayoff-number">${i+1}</span></div><div class="dayoff-count">${members.length}</div><small>integrante${members.length===1?'':'s'} cadastrado${members.length===1?'':'s'}</small><div class="dayoff-members">${members.slice(0,6).map(w=>`<span class="mini-avatar" title="${escapeHTML(w.name)}">${escapeHTML(initials(w.name))}</span>`).join('')}${members.length>6?`<span class="more-members">+${members.length-6}</span>`:''}</div></article>`).join('');
    const noGroup = workers.filter(w => !w.group);
    $('#unassignedBadge').textContent = noGroup.length;
    $('#unassignedEmpty').classList.toggle('visible', noGroup.length === 0);
    $('#unassignedTable').innerHTML = noGroup.map((worker,index) => `<tr><td>${personCell(worker,index)}</td><td class="registration">${escapeHTML(worker.registration || '—')}</td><td>${worker.shift ? `<span class="shift-tag">${escapeHTML(worker.shift)}</span>` : '<span class="person-meta">Não definido</span>'}</td><td><select class="group-select" data-assign="${escapeHTML(worker.id)}"><option value="">Selecionar grupo</option><option value="1">Folga 1</option><option value="2">Folga 2</option><option value="3">Folga 3</option><option value="4">Folga 4</option></select></td></tr>`).join('');
  }
  function render() {
    renderOverview(); renderTeam(); renderDayOff();
  }
  function showToast(message) {
    const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(showToast.timer); showToast.timer = setTimeout(()=>toast.classList.remove('show'),2600);
  }
  function openWorker(worker = null) {
    const form = $('#workerForm'); form.reset();
    $('#workerId').value = worker?.id || '';
    $('#dialogTitle').textContent = worker ? 'Editar integrante' : 'Novo integrante';
    $('#workerName').value = worker?.name || '';
    $('#workerRegistration').value = worker?.registration || '';
    $('#workerShift').value = worker?.shift || '';
    $('#workerGroup').value = worker?.group || '';
    $('#workerRole').value = worker?.role || 'Inspetor';
    $('#workerStatus').value = worker?.status || 'Ativo';
    $('#workerNotes').value = worker?.notes || '';
    $('#deleteWorkerButton').style.visibility = worker ? 'visible' : 'hidden';
    $('#workerDialog').showModal();
    setTimeout(()=>$('#workerName').focus(),50);
  }
  function saveWorker(event) {
    event.preventDefault();
    const id = $('#workerId').value || (crypto.randomUUID ? crypto.randomUUID() : `w-${Date.now()}`);
    const prior = state.workers.find(w => w.id === id) || {};
    const registration = $('#workerRegistration').value.trim();
    if (registration && state.workers.some(w => w.id !== id && w.registration && String(w.registration) === registration)) {
      showToast('Já existe um cadastro com essa matrícula.'); return;
    }
    const updated = {...prior,id,name:$('#workerName').value.trim().replace(/\s+/g,' '),registration,shift:$('#workerShift').value,group:$('#workerGroup').value,role:$('#workerRole').value.trim() || 'Inspetor',status:$('#workerStatus').value,notes:$('#workerNotes').value.trim(),updatedAt:new Date().toISOString()};
    if (prior.id) state.workers = state.workers.map(w=>w.id===id?updated:w); else state.workers.push(updated);
    $('#workerDialog').close(); save(); showToast(prior.id ? 'Perfil atualizado.' : 'Integrante cadastrado.');
  }
  function editById(id) {
    const worker = state.workers.find(w => w.id === id);
    if (worker) openWorker(worker);
  }
  function importWorkbook(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        if (!window.XLSX) throw new Error('A ferramenta de leitura do Excel não carregou. Verifique sua conexão e tente novamente.');
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data,{type:'array',cellDates:true});
        const sheetName = workbook.SheetNames.find(s=>s.trim().toLocaleLowerCase('pt-BR')==='equipe 2026') || workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{header:1,defval:'',raw:false});
        const headerIndex = rows.findIndex(row => row.some(cell=>String(cell).toLocaleLowerCase('pt-BR').includes('número pessoal')) && row.some(cell=>String(cell).toLocaleLowerCase('pt-BR').trim()==='nome'));
        const start = headerIndex >= 0 ? headerIndex + 1 : 2;
        const imported = [];
        for (const row of rows.slice(start)) {
          const registration = String(row[3] ?? '').trim().replace(/\.0$/,'');
          const name = String(row[4] ?? '').trim().replace(/\s+/g,' ');
          if (!registration || !name || /^(nome|número pessoal)$/i.test(name)) continue;
          const validStart = String(row[6] ?? '').trim();
          const validEnd = String(row[7] ?? '').trim();
          if (validEnd && validEnd !== '31/12/9999' && validEnd !== '9999-12-31' && validEnd !== '31/12/9999 00:00:00') continue;
          imported.push({registration,name,teamCode:String(row[0] ?? '').trim().replace(/\.0$/,''),teamName:String(row[1] ?? '').trim(),leader:String(row[10] ?? '').trim(),validFrom:validStart});
        }
        if (!imported.length) throw new Error('Não encontrei nomes e matrículas na planilha. Confira se ela contém a aba “Equipe 2026”.');
        let added=0, updated=0;
        for (const person of imported) {
          let existing = state.workers.find(w=>w.registration && w.registration===person.registration) || state.workers.find(w=>w.name?.toLocaleLowerCase('pt-BR')===person.name.toLocaleLowerCase('pt-BR'));
          if (existing) {
            Object.assign(existing,person,{updatedAt:new Date().toISOString()}); updated++;
          } else {
            state.workers.push({...person,id:crypto.randomUUID?crypto.randomUUID():`w-${Date.now()}-${Math.random()}`,shift:'',group:'',role:'Inspetor',status:'Ativo',notes:''}); added++;
          }
        }
        save(); showToast(`Planilha importada: ${added} novos e ${updated} atualizados.`);
      } catch(error) { showToast(error.message || 'Não foi possível importar a planilha.'); }
      $('#excelInput').value='';
    };
    reader.onerror=()=>showToast('Falha ao ler o arquivo selecionado.');
    reader.readAsArrayBuffer(file);
  }
  function autoBalance() {
    const pending = sortedWorkers(state.workers.filter(w=>!w.group));
    if (!pending.length) { showToast('Não há integrantes sem grupo.'); return; }
    let cursor=0;
    for (const worker of pending) {
      const counts=[1,2,3,4].map(g=>state.workers.filter(w=>String(w.group)===String(g)).length);
      const minimum=Math.min(...counts);
      const candidates=[1,2,3,4].filter((g,i)=>counts[i]===minimum);
      const group=candidates[cursor%candidates.length]; cursor++;
      worker.group=String(group);
      worker.updatedAt=new Date().toISOString();
    }
    save(); showToast(`${pending.length} integrante${pending.length===1?'':'s'} distribuído${pending.length===1?'':'s'} nos grupos menos ocupados.`);
  }
  function exportCSV() {
    const rows=[['Nome','Matrícula','Turno','Folga','Função','Status','Equipe','Líder operacional','Observações'],...sortedWorkers().map(w=>[w.name,w.registration,w.shift,w.group?`Folga ${w.group}`:'',w.role,w.status,w.teamName,w.leader,w.notes])];
    const csv=rows.map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');
    download(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}),`equipe-inspecao-${new Date().toISOString().slice(0,10)}.csv`);
    showToast('Arquivo CSV exportado.');
  }
  function download(blob, filename) {
    const url=URL.createObjectURL(blob), link=document.createElement('a'); link.href=url; link.download=filename; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function backup() {
    const payload={app:'Equipe Inspeção PJ',version:1,exportedAt:new Date().toISOString(),workers:state.workers};
    download(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`backup-equipe-inspecao-${new Date().toISOString().slice(0,10)}.json`);
    showToast('Backup baixado. Guarde o arquivo em local seguro.');
  }

  $$('.nav-item').forEach(button=>button.addEventListener('click',()=>setPage(button.dataset.page)));
  $$('[data-goto]').forEach(button=>button.addEventListener('click',()=>setPage(button.dataset.goto)));
  $('#quickTeam').addEventListener('click',()=>setPage('team'));
  $('#quickImport').addEventListener('click',()=>$('#excelInput').click());
  $('#quickBalance').addEventListener('click',()=>{setPage('days-off');autoBalance()});
  $('#addWorkerButton').addEventListener('click',()=>openWorker());
  $('#teamAddButton').addEventListener('click',()=>openWorker());
  $('#importButton').addEventListener('click',()=>$('#excelInput').click());
  $('#importBannerButton').addEventListener('click',()=>$('#excelInput').click());
  $('#manageImportButton').addEventListener('click',()=>$('#excelInput').click());
  $('#excelInput').addEventListener('change',event=>importWorkbook(event.target.files?.[0]));
  $('#searchInput').addEventListener('input',renderTeam);
  $('#groupFilter').addEventListener('change',renderTeam);
  $('#shiftFilter').addEventListener('change',renderTeam);
  $('#workerForm').addEventListener('submit',saveWorker);
  $('#closeDialog').addEventListener('click',()=>$('#workerDialog').close());
  $('#cancelDialog').addEventListener('click',()=>$('#workerDialog').close());
  $('#deleteWorkerButton').addEventListener('click',()=>{
    const id=$('#workerId').value, worker=state.workers.find(w=>w.id===id);
    if (!worker || !confirm(`Excluir o cadastro de ${worker.name}?`)) return;
    state.workers=state.workers.filter(w=>w.id!==id); $('#workerDialog').close(); save(); showToast('Cadastro excluído.');
  });
  document.addEventListener('click',event=>{const button=event.target.closest('[data-edit]'); if(button) editById(button.dataset.edit);});
  document.addEventListener('change',event=>{
    const select=event.target.closest('[data-assign]'); if(!select||!select.value)return;
    const worker=state.workers.find(w=>w.id===select.dataset.assign); if(!worker)return;
    worker.group=select.value; worker.updatedAt=new Date().toISOString(); save(); showToast(`${worker.name}: definido para Folga ${worker.group}.`);
  });
  $('#autoBalanceButton').addEventListener('click',autoBalance);
  $('#exportCsvButton').addEventListener('click',exportCSV);
  $('#backupButton').addEventListener('click',backup);
  $('#clearButton').addEventListener('click',()=>{
    if(!state.workers.length){showToast('Não há cadastros para limpar.');return;}
    if(!confirm('Apagar todos os integrantes salvos neste navegador? Esta ação não pode ser desfeita sem um backup.'))return;
    state.workers=[];save();showToast('Cadastros locais removidos.');
  });
  $('#helpButton').addEventListener('click',()=>alert('Importe a aba “Equipe 2026” do Excel. Depois, edite cada perfil para definir turno e grupo de folga. Os dados ficam salvos somente neste navegador.'));
  setDate(); render();
})();
