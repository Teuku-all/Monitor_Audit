import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useLanguage } from '../../context/LanguageContext';
import { ErrorState, LoadingState } from '../../components/States';
import Icon from '../../components/Icon';
import TargetTable from '../../components/TargetTable';

export default function Members() {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setFailed(false);
    api.get('/targets', { signal: controller.signal }).then(({ data }) => setTasks(data))
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  const visible = tasks.filter(task => (filter === 'all' || task.status === filter)
    && `${task.title} ${task.engagement_title || task.audit_title || ''} ${task.assigned_team || task.assigned_name || ''}`.toLowerCase().includes(query.toLowerCase()));
  const active = tasks.filter(task => task.status !== 'completed');
  const needsReview = tasks.filter(task => task.status === 'submitted');
  const blocked = tasks.filter(task => task.audit_status === 'Terhambat');

  return <div className="workspace-page">
    <div className="page-heading"><div><span className="eyebrow">{t('Pemantauan audit','Audit monitoring')}</span><h1>{t('Pemantauan per tugas','Task monitoring')}</h1><p>{t('Pantau progres, tenggat, status, dan tim penanggung jawab pada setiap tugas.','Track progress, deadlines, status, and assigned teams for each task.')}</p></div><Link className="btn-primary" to="/admin/targets?create=1"><Icon name="plus" size={15}/>{t('Buat tugas','Create task')}</Link></div>
    <div className="member-summary task-monitoring-summary"><div><span className="metric-icon"><Icon name="target" size={17}/></span><strong>{tasks.length}</strong><small>{t('Semua tugas','All tasks')}</small></div><div><span className="metric-icon"><Icon name="clock" size={17}/></span><strong>{active.length}</strong><small>{t('Tugas aktif','Active tasks')}</small></div><div><span className="metric-icon"><Icon name="check" size={17}/></span><strong>{needsReview.length}</strong><small>{t('Menunggu tinjauan','Awaiting review')}</small></div><div><span className="metric-icon"><Icon name="flag" size={17}/></span><strong>{blocked.length}</strong><small>{t('Terhambat','Blocked')}</small></div></div>
    <section className="panel"><div className="panel-header"><div><h2>{t('Daftar tugas audit','Audit task list')}</h2><p>{t(`${visible.length} tugas ditampilkan`, `${visible.length} tasks shown`)}</p></div></div><div className="table-toolbar"><label className="search-box"><Icon name="search" size={16}/><input aria-label={t('Cari tugas','Search tasks')} placeholder={t('Cari judul tugas atau tim...','Search task title or team...')} value={query} onChange={event=>setQuery(event.target.value)}/></label><select className="filter-select" value={filter} onChange={event=>setFilter(event.target.value)} aria-label={t('Filter status tugas','Filter task status')}>{[['all','Semua status','All statuses'],['assigned','Ditugaskan','Assigned'],['in_progress','Berjalan','In progress'],['submitted','Menunggu review','Awaiting review'],['revision','Perlu revisi','Needs revision'],['completed','Selesai','Completed']].map(([value,id,en])=><option key={value} value={value}>{t(id,en)}</option>)}</select></div>{loading?<LoadingState/>:failed?<div className="p-5"><ErrorState onRetry={()=>setAttempt(value=>value+1)}/></div>:<TargetTable targets={visible}/>}</section>
  </div>;
}
