import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';
import Icon from './Icon';
import { EmptyState } from './States';
import ScheduleBadge from './ScheduleBadge';

export function ProgressBar({ value = 0 }) {
  return <div className="progress-cell"><div className="progress-track"><span style={{ width: `${value}%` }} /></div><span>{value}%</span></div>;
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
    return <EmptyState icon="target" title={t('Belum ada target di sini', 'No targets here yet')} description={admin ? t('Buat target dan pilih anggota tim untuk memulai.', 'Create a target and assign a team member to get started.') : t('Target dari admin akan muncul di sini.', 'Targets assigned by your administrator will appear here.')} />;
  }

  return <div className="table-scroll" role="region" aria-label={t('Tabel sasaran audit', 'Audit objectives table')} tabIndex={0}>
    <table className="data-table responsive-table">
      <thead><tr>
        <th scope="col">{t('Sasaran audit', 'Audit objective')}</th>
        {admin && <th scope="col">{t('Ditugaskan ke', 'Assigned to')}</th>}
        <th scope="col">{t('Progres', 'Progress')}</th>
        {!compact && <th scope="col">{t('Prioritas', 'Priority')}</th>}
        <th scope="col">{t('Tenggat', 'Due date')}</th>
        <th scope="col">{t('Status pekerjaan / audit', 'Work / audit status')}</th>
        {!compact && <th scope="col">{t('Jadwal', 'Schedule')}</th>}
        <th scope="col"><span className="sr-only">{t('Buka', 'Open')}</span></th>
      </tr></thead>
      <tbody>{targets.map(item => <tr key={item.id}>
        <td data-label={t('Sasaran audit', 'Audit objective')}><Link className="table-title" to={`/${admin ? 'admin' : 'member'}/targets/${item.id}`}>{item.title}</Link>{(item.engagement_title || item.audit_title) && <small>{item.engagement_title || item.audit_title}</small>}<small>#{String(item.id).padStart(3, '0')}</small></td>
        {admin && <td data-label={t('Ditugaskan ke', 'Assigned to')}><span className="person-cell"><span className="avatar avatar-small">{item.assigned_name?.charAt(0)}</span>{item.assigned_name}</span></td>}
        <td data-label={t('Progres', 'Progress')}><ProgressBar value={item.progress} /></td>
        {!compact && <td data-label={t('Prioritas', 'Priority')}><Priority value={item.priority} /></td>}
        <td data-label={t('Tenggat', 'Due date')} className={item.due_date < today && !['completed', 'submitted'].includes(item.status) ? 'overdue' : ''}>{formatDate(item.due_date, { day: 'numeric', month: 'short' })}</td>
        <td data-label={t('Status', 'Status')}><StatusBadge status={item.status} /><small className="audit-table-status">{item.audit_status || 'Belum Mulai'}</small></td>
        {!compact && <td data-label={t('Jadwal', 'Schedule')}><ScheduleBadge status={item.schedule_status}/></td>}
        <td className="table-action"><Link className="table-open" aria-label={`${t('Buka target', 'Open target')}: ${item.title}`} to={`/${admin ? 'admin' : 'member'}/targets/${item.id}`}><Icon name="arrow" size={17} /></Link></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
