import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';
import Icon from './Icon';
import { EmptyState } from './States';
export default function SubmissionTable({items}) {
 const {t,formatDate}=useLanguage();const {user}=useAuth();const admin=user?.role==='admin';
 if(!items.length)return <EmptyState title={t('Belum ada dokumen','No documents yet')} description={t('Dokumen yang dikirim akan tersimpan dan tampil di sini.','Submitted documents will be saved and displayed here.')}/>;
 return <div className="table-scroll"><table className="data-table"><thead><tr><th>{t('Dokumen','Document')}</th>{admin&&<th>{t('Anggota','Member')}</th>}<th>{t('Tanggal kirim','Submitted')}</th><th>{t('Status','Status')}</th><th><span className="sr-only">{t('Buka','Open')}</span></th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><Link className="document-cell" to={`/${admin?'admin':'member'}/submissions/${item.id}`}><span className="document-icon"><Icon name="file" size={18}/></span><span><strong>{item.title}</strong><small>{item.file_name}</small></span></Link></td>{admin&&<td>{item.member_name}</td>}<td>{formatDate(item.submitted_at)}</td><td><StatusBadge status={item.status}/></td><td><Link className="table-open" aria-label={`${t('Buka dokumen','Open document')}: ${item.title}`} to={`/${admin?'admin':'member'}/submissions/${item.id}`}><Icon name="arrow" size={17}/></Link></td></tr>)}</tbody></table></div>;
}
