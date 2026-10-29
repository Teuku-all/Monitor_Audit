import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';
import Icon from './Icon';
import { EmptyState } from './States';
import ScheduleBadge from './ScheduleBadge';
import '../styles/task-list.css';

export function ProgressBar({ value = 0, label }) {
  const { t } = useLanguage();
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="progress-cell"><div className="progress-track" role="progressbar" aria-label={label || t('Progres','Progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div><span>{percent}%</span></div>;
}

export function Priority({ value }) {
  const { t } = useLanguage();
  const labels = {
    low: t('Rendah', 'Low'),
    medium: t('Normal', 'Normal'),
    high: t('Tinggi', 'High'),
    critical: t('Kritis', 'Critical'),
  };
  return <span className={`priority priority-${value}`}><Icon name="flag" size={12} />{labels[value] || value}</span>;
}

export default function TargetTable({ targets, compact = false }) {
  const { t, formatDate } = useLanguage();
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  if (!targets.length) {
    return <EmptyState icon="target" title={t('Belum ada target di sini', 'No targets here yet')} description={admin ? t('Buat tugas dan tetapkan peran anggota untuk memulai.', 'Create a task and assign member roles to get started.') : t('Target dari admin akan muncul di sini.', 'Targets assigned by your administrator will appear here.')} />;
  }

  return <div className="table-scroll task-table" role="region" aria-label={t('Daftar tugas', 'Task list')} tabIndex={0}>
    <table className="data-table responsive-table">
      <thead><tr>
        <th scope="col">{t('Tugas', 'Task')}</th>
        {admin && <th scope="col">{t('Tim penanggung jawab', 'Responsible team')}</th>}
        <th scope="col">{t('Progres keseluruhan', 'Overall progress')}</th>
        <th scope="col">{t('Tenggat', 'Due date')}</th>
        <th scope="col">{t('Status tugas', 'Task status')}</th>
        <th scope="col"><span className="sr-only">{t('Buka', 'Open')}</span></th>
      </tr></thead>
      <tbody>{targets.map(item => <tr key={item.id}>
        <td data-label={t('Tugas', 'Task')}><Link className="table-title" to={`/${admin ? 'admin' : 'member'}/targets/${item.id}`}>{item.title}</Link>{(item.engagement_title || item.audit_title) && <small>{item.engagement_title || item.audit_title}</small>}<div className="task-table-meta"><span>#{String(item.id).padStart(3, '0')}</span>{!compact&&<Priority value={item.priority}/>}</div></td>
        {admin && <td className="task-team-column" data-label={t('Tim penanggung jawab', 'Responsible team')}><span className="person-cell"><span className="avatar avatar-small"><Icon name="users" size={13}/></span>{item.assigned_team || item.assigned_name}</span></td>}
        <td className="task-progress-column" data-label={t('Progres keseluruhan', 'Overall progress')}><ProgressBar value={item.progress} label={`${t('Progres keseluruhan','Overall progress')}: ${item.title}`} /></td>
        <td data-label={t('Tenggat', 'Due date')} className={item.due_date < today && !['completed', 'submitted'].includes(item.status) ? 'overdue' : ''}><span className="task-due-date">{formatDate(item.due_date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>{!compact&&<div className="task-schedule"><ScheduleBadge status={item.schedule_status}/></div>}</td>
        <td data-label={t('Status', 'Status')}><StatusBadge status={item.status} /><small className="audit-table-status">{item.audit_status || 'Belum Mulai'}</small></td>
        <td className="table-action"><Link className="task-open-link" aria-label={`${t('Lihat peran', 'View roles')}: ${item.title}`} to={`/${admin ? 'admin' : 'member'}/targets/${item.id}`}><span>{t('Lihat peran','View roles')}</span><Icon name="arrow" size={16} /></Link></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
