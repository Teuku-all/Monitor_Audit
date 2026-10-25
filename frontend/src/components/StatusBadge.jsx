import { useLanguage } from '../context/LanguageContext';
const statuses = {
  Menunggu: ['Menunggu', 'Pending', 'pending'], Disetujui: ['Disetujui','Approved','complete'], 'Perlu Revisi': ['Perlu revisi','Needs revision','revision'],
  assigned:['Ditugaskan','Assigned','assigned'], in_progress:['Dikerjakan','In progress','progress'], submitted:['Menunggu review','Awaiting review','pending'], completed:['Selesai','Completed','complete'], revision:['Perlu revisi','Needs revision','revision'],
};
export default function StatusBadge({ status }) { const {t}=useLanguage(); const item=statuses[status]||[status,status,'assigned']; return <span className={`status-badge status-${item[2]}`}><i/>{t(item[0],item[1])}</span>; }
