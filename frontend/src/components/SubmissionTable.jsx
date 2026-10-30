import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';
import Icon from './Icon';
import { EmptyState } from './States';

export default function SubmissionTable({ items }) {
  const { t, formatDate } = useLanguage();
  const { user } = useAuth();
  const admin = user?.role === 'admin';

  if (!items.length) {
    return <EmptyState title={t('Belum ada dokumen', 'No documents yet')} description={t('Dokumen yang dikirim akan tersimpan dan tampil di sini.', 'Submitted documents will be saved and displayed here.')} />;
  }

  return <div className="table-scroll" role="region" aria-label={t('Tabel dokumen audit', 'Audit documents table')} tabIndex={0}>
    <table className="data-table responsive-table">
      <thead><tr>
        <th scope="col">{t('Dokumen', 'Document')}</th>
        {admin && <th scope="col">{t('Anggota', 'Member')}</th>}
        <th scope="col">{t('Tanggal kirim', 'Submitted')}</th>
        <th scope="col">{t('Status', 'Status')}</th>
        <th scope="col"><span className="sr-only">{t('Buka', 'Open')}</span></th>
      </tr></thead>
      <tbody>{items.map(item => <tr key={item.id}>
        <td data-label={t('Dokumen', 'Document')}><Link className="document-cell" to={`/${admin ? 'admin' : 'member'}/submissions/${item.id}`}><span className="document-icon"><Icon name="file" size={18} /></span><span><strong>{item.title}</strong><small>{item.file_name}</small></span></Link></td>
        {admin && <td data-label={t('Anggota', 'Member')}>{item.member_name}</td>}
        <td data-label={t('Tanggal kirim', 'Submitted')}>{formatDate(item.submitted_at)}</td>
        <td data-label={t('Status', 'Status')}><StatusBadge status={item.status} /></td>
        <td className="table-action"><Link className="table-open" aria-label={`${t('Buka dokumen', 'Open document')}: ${item.title}`} to={`/${admin ? 'admin' : 'member'}/submissions/${item.id}`}><span className="table-open-label">{t('Buka dokumen', 'Open document')}</span><Icon name="arrow" size={17} /></Link></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
