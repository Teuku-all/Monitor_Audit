import { useLanguage } from '../context/LanguageContext';

const labels = {
  green: ['Sesuai jadwal', 'On schedule'],
  yellow: ['Waspada · ≤ 3 hari', 'At risk · ≤ 3 days'],
  red: ['Terlambat', 'Overdue'],
};

export default function ScheduleBadge({ status = 'green' }) {
  const { t } = useLanguage();
  const [id, en] = labels[status] || labels.green;
  return <span className={`schedule-badge schedule-${status}`}><i aria-hidden="true" />{t(id, en)}</span>;
}
