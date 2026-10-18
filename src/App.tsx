import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Activity, ArrowDownToLine, ArrowLeftRight, Bell, CalendarDays,
  Check, ChevronDown, CircleHelp, ClipboardList, CloudOff, FileSpreadsheet, Filter,
  LayoutDashboard, ListFilter, Menu, MoreHorizontal, Plus, Search, Settings2, ShieldCheck,
  Sparkles, Users, X,
} from 'lucide-react';
import { downloadFile, initials, loadWorkers, saveWorkers } from './lib/storage';
import type { View, Worker, WorkerStatus } from './types';

const groupColors = ['#279a83', '#4386d7', '#cf8b2f', '#8d69c2'];
const dateLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
const normalize = (value: unknown) => String(value ?? '').trim().replace(/\.0$/, '');

export default function App() {
  const [workers, setWorkers] = useState<Worker[]>(loadWorkers);
  const [view, setView] = useState<View>('overview');
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [editing, setEditing] = useState<Worker | null | undefined>(undefined);
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateWorkers = (next: Worker[]) => { setWorkers(next); saveWorkers(next); };
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };
  const sorted = useMemo(() => [...workers].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [workers]);
  const filtered = useMemo(() => sorted.filter((worker) => {
    const text = `${worker.name} ${worker.registration} ${worker.teamName ?? ''}`.toLocaleLowerCase('pt-BR');
    return (!query || text.includes(query.toLocaleLowerCase('pt-BR')))
      && (groupFilter === 'all' || (groupFilter === 'none' ? !worker.group : worker.group === groupFilter))
      && (shiftFilter === 'all' || (shiftFilter === 'none' ? !worker.shift : worker.shift === shiftFilter));
  }), [sorted, query, groupFilter, shiftFilter]);
  const assigned = workers.filter((worker) => Boolean(worker.group)).length;
  const active = workers.filter((worker) => worker.status === 'Ativo').length;
  const pending = workers.length - assigned;
  const groups = [1, 2, 3, 4].map((number) => workers.filter((worker) => worker.group === String(number)));

  const importExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames.find((name) => name.trim().toLocaleLowerCase('pt-BR') === 'equipe 2026') ?? workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
      const header = rows.findIndex((row) => row.some((cell) => String(cell).toLocaleLowerCase('pt-BR').includes('número pessoal')) && row.some((cell) => String(cell).toLocaleLowerCase('pt-BR').trim() === 'nome'));
      const imported: Worker[] = [];
      for (const row of rows.slice(header >= 0 ? header + 1 : 2)) {
        const registration = normalize(row[3]);
        const name = normalize(row[4]).replace(/\s+/g, ' ');
        const validEnd = normalize(row[7]);
        if (!registration || !name || /^(nome|número pessoal)$/i.test(name)) continue;
        if (validEnd && !['31/12/9999', '9999-12-31', '31/12/9999 00:00:00'].includes(validEnd)) continue;
        const prior = workers.find((worker) => worker.registration === registration || worker.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
        imported.push({
          ...prior, id: prior?.id ?? crypto.randomUUID(), name, registration,
          teamCode: normalize(row[0]), teamName: normalize(row[1]), leader: normalize(row[10]), validFrom: normalize(row[6]),
          shift: prior?.shift ?? '', group: prior?.group ?? '', role: prior?.role ?? 'Inspetor', status: prior?.status ?? 'Ativo', notes: prior?.notes ?? '',
        });
      }
      if (!imported.length) throw new Error('Não encontrei nomes e matrículas. Confira a aba “Equipe 2026”.');
      const map = new Map(workers.map((worker) => [worker.id, worker]));
      imported.forEach((worker) => map.set(worker.id, worker));
      updateWorkers([...map.values()]);
      notify(`Planilha importada: ${imported.length} cadastro${imported.length === 1 ? '' : 's'} processado${imported.length === 1 ? '' : 's'}.`);
    } catch (error) { notify(error instanceof Error ? error.message : 'Não foi possível importar a planilha.'); }
    event.target.value = '';
  };

  const assign = (workerId: string, group: string) => updateWorkers(workers.map((worker) => worker.id === workerId ? { ...worker, group, updatedAt: new Date().toISOString() } : worker));
  const balanceGroups = () => {
    const next = [...workers];
    const unassigned = next.filter((worker) => !worker.group).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (!unassigned.length) { notify('Todos já têm grupo de folga definido.'); return; }
    unassigned.forEach((worker) => {
      const counts = [1, 2, 3, 4].map((group) => next.filter((item) => item.group === String(group)).length);
      const group = counts.indexOf(Math.min(...counts)) + 1;
      worker.group = String(group);
      worker.updatedAt = new Date().toISOString();
    });
    updateWorkers(next);
    notify(`${unassigned.length} integrante${unassigned.length === 1 ? '' : 's'} distribuído${unassigned.length === 1 ? '' : 's'} pelos grupos menos ocupados.`);
  };
  const exportCsv = () => {
    const rows = [['Nome', 'Matrícula', 'Turno', 'Folga', 'Função', 'Status', 'Equipe', 'Líder', 'Observações'], ...sorted.map((worker) => [worker.name, worker.registration, worker.shift, worker.group ? `Folga ${worker.group}` : '', worker.role, worker.status, worker.teamName ?? '', worker.leader ?? '', worker.notes ?? ''])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n');
    downloadFile(`\ufeff${csv}`, `equipe-inspecao-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    notify('Arquivo CSV exportado.');
  };
  const backup = () => {
    downloadFile(JSON.stringify({ app: 'Equipe Inspeção', version: 2, exportedAt: new Date().toISOString(), workers }, null, 2), `backup-equipe-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    notify('Backup JSON baixado. Guarde-o em local seguro.');
  };
  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const items = Array.isArray(parsed) ? parsed : (parsed as { workers?: unknown[] }).workers;
      if (!Array.isArray(items) || !items.every((item) => item && typeof item === 'object' && 'name' in item)) throw new Error('Esse arquivo não parece ser um backup válido.');
      updateWorkers(items as Worker[]); notify(`${items.length} integrantes restaurados.`);
    } catch (error) { notify(error instanceof Error ? error.message : 'Falha ao restaurar o backup.'); }
    event.target.value = '';
  };
  const saveWorker = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ');
    const registration = String(form.get('registration') ?? '').trim();
    const id = editing?.id ?? crypto.randomUUID();
    if (registration && workers.some((worker) => worker.id !== id && worker.registration === registration)) { notify('Já existe um cadastro com essa matrícula.'); return; }
    const record: Worker = { ...editing, id, name, registration, shift: String(form.get('shift') ?? ''), group: String(form.get('group') ?? ''), role: String(form.get('role') ?? 'Inspetor'), status: String(form.get('status') ?? 'Ativo') as WorkerStatus, notes: String(form.get('notes') ?? ''), updatedAt: new Date().toISOString() };
    updateWorkers(editing ? workers.map((worker) => worker.id === id ? record : worker) : [...workers, record]);
    setEditing(undefined); notify(editing ? 'Cadastro atualizado.' : 'Integrante cadastrado.');
  };
  const go = (next: View) => { setView(next); setMobileMenu(false); };
  const title: Record<View, string> = { overview: 'Visão geral', team: 'Equipe', 'days-off': 'Grupos de folga', management: 'Gestão do sistema' };

  return <div className="app-frame">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-icon"><Activity size={21} strokeWidth={2.5} /></div><div><strong>Equipe Inspeção</strong><span>CONTROLE OPERACIONAL</span></div><button className="icon-btn mobile-close" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X /></button></div>
      <div className="unit-switch"><div className="unit-avatar">PJ</div><div><small>UNIDADE</small><strong>Inspeção · Petrus</strong></div><ChevronDown size={15} /></div>
      <p className="nav-label">WORKSPACE</p>
      <nav className="nav-list">
        <NavButton icon={<LayoutDashboard />} label="Visão geral" active={view === 'overview'} onClick={() => go('overview')} />
        <NavButton icon={<Users />} label="Equipe" active={view === 'team'} count={workers.length} onClick={() => go('team')} />
        <NavButton icon={<CalendarDays />} label="Grupos de folga" active={view === 'days-off'} onClick={() => go('days-off')} />
      </nav>
      <p className="nav-label tools-label">FERRAMENTAS</p>
      <nav className="nav-list"><NavButton icon={<Settings2 />} label="Gestão do sistema" active={view === 'management'} onClick={() => go('management')} /></nav>
      <div className="sidebar-spacer" />
      <div className="side-tip"><div className="tip-top"><Sparkles size={16} /><span>GESTÃO INTELIGENTE</span></div><strong>Equipe equilibrada,<br />operação mais fluida.</strong><button onClick={() => { go('days-off'); balanceGroups(); }}>Equilibrar grupos <ArrowLeftRight size={14} /></button></div>
      <div className="sidebar-profile"><div className="profile-mark">EI</div><div><strong>Equipe Inspeção</strong><span>Área de trabalho local</span></div><MoreHorizontal size={18} /></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu /></button><div className="breadcrumbs"><span>Workspace</span><span className="crumb-sep">/</span><strong>{title[view]}</strong></div><div className="top-actions"><span className="local-pill"><span />Salvo neste dispositivo</span><button className="icon-btn" title="Ajuda" onClick={() => notify('Importe a planilha, revise os cadastros e distribua as folgas.') }><CircleHelp size={18} /></button><button className="icon-btn notification" aria-label="Notificações"><Bell size={18} /></button><div className="top-avatar">EI</div></div></header>

      <div className="content">
        {view === 'overview' && <>
          <div className="page-intro"><div><p className="eyebrow">{dateLabel}</p><h1>Bom dia, equipe <span>✳</span></h1><p className="intro-copy">Acompanhe sua operação e mantenha a equipe alinhada.</p></div><div className="intro-actions"><button className="button button-outline" onClick={exportCsv}><ArrowDownToLine size={16} /> Exportar relatório</button><button className="button button-primary" onClick={() => setEditing(null)}><Plus size={17} /> Novo integrante</button></div></div>
          {!workers.length && <div className="import-callout"><div className="callout-icon"><FileSpreadsheet size={20} /></div><div><strong>Comece pela planilha da equipe</strong><p>Importe seu Excel para preencher o painel e organizar os grupos de folga.</p></div><button className="button button-primary" onClick={() => inputRef.current?.click()}>Importar planilha <ArrowDownToLine size={15} /></button></div>}
          <section className="metric-grid">
            <Metric label="Total de integrantes" value={workers.length} detail="No cadastro da equipe" icon={<Users />} tint="mint" trend={`${active} ativos`} />
            <Metric label="Grupos definidos" value={assigned} detail={`${workers.length ? Math.round(assigned / workers.length * 100) : 0}% da equipe distribuída`} icon={<Check />} tint="blue" trend={`${pending} pendentes`} />
            <Metric label="Sem grupo de folga" value={pending} detail="Precisam de alocação" icon={<CalendarDays />} tint="amber" trend={pending ? 'Atenção necessária' : 'Tudo organizado'} />
            <Metric label="Equipe ativa" value={active} detail="Disponíveis para operação" icon={<Activity />} tint="violet" trend="Status atualizado" />
          </section>

          <div className="overview-grid">
            <section className="panel distribution-panel"><PanelTitle eyebrow="DISTRIBUIÇÃO" title="Grupos de folga" action={<button className="text-button" onClick={() => go('days-off')}>Ver detalhes <span>→</span></button>} />
              <div className="group-overview">{groups.map((members, index) => <div className="group-row" key={index}><div className="group-name"><span className="group-dot" style={{ background: groupColors[index] }} />Folga {index + 1}</div><div className="progress-track"><div className="progress-bar" style={{ width: `${workers.length ? Math.max(0, members.length / Math.max(1, ...groups.map((group) => group.length)) * 100) : 0}%`, background: groupColors[index] }} /></div><strong>{members.length}</strong><small>pessoas</small></div>)}</div>
              <div className={`insight ${pending ? 'insight-warn' : ''}`}><span className="insight-icon"><Sparkles size={16} /></span><p>{pending ? <><strong>{pending} integrante{pending === 1 ? '' : 's'} aguardando grupo.</strong> Equilibre a distribuição para completar o quadro.</> : workers.length ? <><strong>Distribuição concluída.</strong> Sua equipe está alocada entre os quatro grupos.</> : <>Importe sua planilha para visualizar o equilíbrio das folgas.</>}</p><button onClick={balanceGroups} disabled={!pending} title="Distribuir automaticamente"><ArrowLeftRight size={17} /></button></div>
            </section>
            <section className="panel quick-panel"><PanelTitle eyebrow="ATALHOS" title="Acesso rápido" /><div className="shortcut-list"><Shortcut icon={<Users />} title="Ver equipe completa" caption="Pesquise e edite os perfis" onClick={() => go('team')} /><Shortcut icon={<CalendarDays />} title="Organizar folgas" caption="Distribua integrantes nos grupos" onClick={() => go('days-off')} /><Shortcut icon={<FileSpreadsheet />} title="Importar planilha" caption="Atualize os dados da equipe" onClick={() => inputRef.current?.click()} /></div><div className="sync-note"><CloudOff size={15} /><span>Modo local · os dados ficam neste navegador</span></div></section>
          </div>

          <section className="panel roster-panel"><PanelTitle eyebrow="ACOMPANHAMENTO" title="Equipe recente" action={<button className="button button-subtle" onClick={() => go('team')}>Ver todos <ArrowDownToLine size={14} /></button>} /><Roster workers={sorted.slice(0, 6)} onEdit={(worker) => setEditing(worker)} onAssign={assign} /></section>
        </>}

        {view === 'team' && <>
          <div className="page-intro compact"><div><p className="eyebrow">CADASTRO E OPERAÇÃO</p><h1>Equipe</h1><p className="intro-copy">Gerencie os perfis, turnos e alocação de folgas.</p></div><div className="intro-actions"><button className="button button-outline" onClick={() => inputRef.current?.click()}><FileSpreadsheet size={16} /> Importar Excel</button><button className="button button-primary" onClick={() => setEditing(null)}><Plus size={17} /> Novo integrante</button></div></div>
          <div className="table-controls"><div className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, matrícula ou equipe..." /></div><label className="filter-select"><Filter size={15} /><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="all">Todos os grupos</option><option value="none">Sem grupo</option>{[1, 2, 3, 4].map((group) => <option key={group} value={String(group)}>Folga {group}</option>)}</select></label><label className="filter-select"><ListFilter size={15} /><select value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value)}><option value="all">Todos os turnos</option><option value="none">Sem turno</option><option>TN</option><option>TM</option><option>TT</option></select></label><span className="result-count">{filtered.length} integrantes</span></div>
          <section className="panel roster-panel full-roster"><Roster workers={filtered} onEdit={(worker) => setEditing(worker)} onAssign={assign} emptyMessage="Nenhum integrante encontrado com esses filtros." /></section>
        </>}

        {view === 'days-off' && <>
          <div className="page-intro compact"><div><p className="eyebrow">PLANEJAMENTO OPERACIONAL</p><h1>Grupos de folga</h1><p className="intro-copy">Visualize e distribua a equipe entre os quatro grupos.</p></div><button className="button button-primary" onClick={balanceGroups}><Sparkles size={16} /> Equilibrar automaticamente</button></div>
          <div className="dayoff-grid">{groups.map((members, index) => <article className="dayoff-card" key={index} style={{ '--group-color': groupColors[index] } as React.CSSProperties}><div className="dayoff-heading"><div><span>GRUPO DE DESCANSO</span><h2>Folga {index + 1}</h2></div><div className="dayoff-number">0{index + 1}</div></div><strong className="dayoff-total">{members.length}<small>integrantes</small></strong><div className="dayoff-divider" /><div className="dayoff-members">{members.length ? members.map((worker) => <button className="member-chip" key={worker.id} onClick={() => setEditing(worker)}><span className="member-avatar">{initials(worker.name)}</span><span>{worker.name}</span><ChevronDown size={14} /></button>) : <p className="empty-group">Nenhum integrante alocado neste grupo.</p>}</div></article>)}</div>
          <section className="panel unassigned-panel"><PanelTitle eyebrow="PENDÊNCIAS" title="Sem grupo de folga" action={<span className="pending-count">{pending} pendentes</span>} />{pending ? <div className="unassigned-list">{sorted.filter((worker) => !worker.group).map((worker) => <div className="unassigned-row" key={worker.id}><Person worker={worker} /><span className="registration">{worker.registration || '—'}</span><select aria-label={`Grupo de folga para ${worker.name}`} defaultValue="" onChange={(event) => assign(worker.id, event.target.value)}><option value="" disabled>Selecionar grupo</option>{[1, 2, 3, 4].map((group) => <option key={group} value={String(group)}>Folga {group}</option>)}</select></div>)}</div> : <div className="success-empty"><Check size={18} /> Todos os integrantes já têm grupo definido.</div>}</section>
        </>}

        {view === 'management' && <>
          <div className="page-intro compact"><div><p className="eyebrow">PREFERÊNCIAS E DADOS</p><h1>Gestão do sistema</h1><p className="intro-copy">Ferramentas para manter seus cadastros organizados.</p></div></div>
          <div className="management-grid"><ManagementCard icon={<FileSpreadsheet />} title="Importar planilha Excel" description="Adicione ou atualize cadastros usando a aba Equipe 2026 da planilha oficial." button="Selecionar arquivo" onClick={() => inputRef.current?.click()} /><ManagementCard icon={<ArrowDownToLine />} title="Exportar equipe" description="Baixe uma planilha CSV compatível com Excel com os dados atuais da equipe." button="Exportar CSV" onClick={exportCsv} /><ManagementCard icon={<ShieldCheck />} title="Backup e restauração" description="Gere um backup completo em JSON ou restaure dados salvos anteriormente neste dispositivo." button="Baixar backup" onClick={backup} /><label className="management-card restore-card"><div className="manage-icon mint"><ArrowLeftRight /></div><h2>Restaurar backup</h2><p>Restaure cadastros a partir de um arquivo JSON exportado pelo painel.</p><span className="button button-outline">Escolher arquivo <ArrowDownToLine size={14} /></span><input type="file" accept="application/json,.json" onChange={restore} hidden /></label></div>
          <div className="privacy-panel"><div className="privacy-icon"><ShieldCheck size={20} /></div><div><strong>Seus dados permanecem no seu dispositivo</strong><p>Os cadastros são guardados no armazenamento local deste navegador. Eles não são enviados ao servidor nem sincronizados com outros dispositivos. Faça backups regulares para preservar seus dados.</p></div><span className="local-tag">ARMAZENAMENTO LOCAL</span></div>
          <div className="danger-panel"><div><strong>Limpar dados locais</strong><p>Remove todos os cadastros salvos neste navegador. Exporte um backup antes de continuar.</p></div><button className="button button-danger" onClick={() => { if (workers.length && window.confirm('Apagar todos os integrantes deste dispositivo? Exporte um backup antes.')) { updateWorkers([]); notify('Cadastros locais removidos.'); } }}>Limpar cadastros</button></div>
        </>}

        <footer className="footer"><span>Equipe Inspeção <b>·</b> Gestão inteligente da operação</span><span><span className="footer-dot" /> Local e seguro</span></footer>
      </div>
    </main>

    <input ref={inputRef} className="hidden-input" type="file" accept=".xlsx,.xls,.csv" onChange={importExcel} />
    {editing !== undefined && <WorkerDialog worker={editing} onClose={() => setEditing(undefined)} onSave={saveWorker} onDelete={() => { if (editing && window.confirm(`Excluir o cadastro de ${editing.name}?`)) { updateWorkers(workers.filter((worker) => worker.id !== editing.id)); setEditing(undefined); notify('Cadastro removido.'); } }} />}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
  </div>;
}

function NavButton({ icon, label, active, count, onClick }: { icon: React.ReactNode; label: string; active: boolean; count?: number; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{count !== undefined && <small>{count}</small>}</button>;
}
function Metric({ label, value, detail, icon, tint, trend }: { label: string; value: number; detail: string; icon: React.ReactNode; tint: string; trend: string }) {
  return <article className="metric-card"><div className={`metric-icon ${tint}`}>{icon}</div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><div className="metric-bottom"><span>{detail}</span><b className={tint}>{trend}</b></div></article>;
}
function PanelTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <div className="panel-title"><div><span>{eyebrow}</span><h2>{title}</h2></div>{action}</div>;
}
function Shortcut({ icon, title, caption, onClick }: { icon: React.ReactNode; title: string; caption: string; onClick: () => void }) {
  return <button className="shortcut" onClick={onClick}><span className="shortcut-icon">{icon}</span><span><strong>{title}</strong><small>{caption}</small></span><span className="shortcut-arrow">↗</span></button>;
}
function Person({ worker }: { worker: Worker }) {
  return <div className="person-cell"><span className="person-avatar">{initials(worker.name)}</span><span><strong>{worker.name}</strong><small>{worker.leader || worker.teamName || 'Equipe de inspeção'}</small></span></div>;
}
function Roster({ workers, onEdit, onAssign, emptyMessage = 'Importe a planilha da equipe para começar.' }: { workers: Worker[]; onEdit: (worker: Worker) => void; onAssign: (id: string, group: string) => void; emptyMessage?: string }) {
  if (!workers.length) return <div className="empty-state"><div><ClipboardList size={23} /></div><strong>Nenhum registro por aqui</strong><span>{emptyMessage}</span></div>;
  return <div className="table-wrap"><table><thead><tr><th>INTEGRANTE</th><th>MATRÍCULA</th><th>TURNO</th><th>GRUPO DE FOLGA</th><th>FUNÇÃO</th><th>STATUS</th><th /></tr></thead><tbody>{workers.map((worker) => <tr key={worker.id}><td><Person worker={worker} /></td><td className="registration">{worker.registration || '—'}</td><td>{worker.shift ? <span className="shift-badge">{worker.shift}</span> : <span className="muted">—</span>}</td><td><select className={`group-badge ${worker.group ? `group-${worker.group}` : 'group-none'}`} aria-label={`Grupo de folga para ${worker.name}`} value={worker.group} onChange={(event) => onAssign(worker.id, event.target.value)}><option value="">Sem grupo</option>{[1, 2, 3, 4].map((group) => <option key={group} value={String(group)}>Folga {group}</option>)}</select></td><td className="role-cell">{worker.role || 'Inspetor'}</td><td><span className={`status-badge ${worker.status.toLowerCase()}`}>{worker.status}</span></td><td><button className="row-action" onClick={() => onEdit(worker)} aria-label={`Editar ${worker.name}`}><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table></div>;
}
function ManagementCard({ icon, title, description, button, onClick }: { icon: React.ReactNode; title: string; description: string; button: string; onClick: () => void }) {
  return <article className="management-card"><div className="manage-icon mint">{icon}</div><h2>{title}</h2><p>{description}</p><button className="button button-outline" onClick={onClick}>{button}<ArrowDownToLine size={14} /></button></article>;
}
function WorkerDialog({ worker, onClose, onSave, onDelete }: { worker: Worker | null; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void; onDelete: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="worker-dialog" onSubmit={onSave}><div className="dialog-heading"><div><span>GESTÃO DE CADASTRO</span><h2>{worker ? 'Editar integrante' : 'Novo integrante'}</h2></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={19} /></button></div><div className="form-grid"><label>Nome completo<input name="name" required defaultValue={worker?.name ?? ''} autoFocus /></label><label>Matrícula<input name="registration" defaultValue={worker?.registration ?? ''} /></label><label>Turno<select name="shift" defaultValue={worker?.shift ?? ''}><option value="">Não definido</option><option>TN</option><option>TM</option><option>TT</option></select></label><label>Grupo de folga<select name="group" defaultValue={worker?.group ?? ''}><option value="">Sem grupo</option>{[1, 2, 3, 4].map((group) => <option key={group} value={String(group)}>Folga {group}</option>)}</select></label><label>Função<input name="role" defaultValue={worker?.role ?? 'Inspetor'} /></label><label>Status<select name="status" defaultValue={worker?.status ?? 'Ativo'}><option>Ativo</option><option>Afastado</option><option>Inativo</option></select></label><label className="form-wide">Observações<textarea name="notes" rows={3} defaultValue={worker?.notes ?? ''} /></label></div><div className="dialog-actions">{worker && <button type="button" className="button button-danger" onClick={onDelete}>Excluir cadastro</button>}<div><button type="button" className="button button-outline" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary"><Check size={16} /> Salvar cadastro</button></div></div></form></div>;
}
