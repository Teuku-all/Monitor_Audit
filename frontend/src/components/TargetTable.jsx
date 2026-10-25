import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';
import Icon from './Icon';
import { EmptyState } from './States';
export function ProgressBar({ value=0 }) {return <div className="progress-cell"><div className="progress-track"><span style={{width:`${value}%`}}/></div><span>{value}%</span></div>;}
export function Priority({value}) {const {t}=useLanguage();const labels={low:t('Rendah','Low'),medium:t('Sedang','Medium'),high:t('Tinggi','High')};return <span className={`priority priority-${value}`}><Icon name="flag" size={12}/>{labels[value]||value}</span>;}
export default function TargetTable({targets, compact=false}) {
 const {t,formatDate}=useLanguage();const {user}=useAuth();const admin=user?.role==='admin';
 const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 if(!targets.length)return <EmptyState icon="target" title={t('Belum ada target di sini','No targets here yet')} description={admin?t('Buat target dan pilih anggota tim untuk memulai.','Create a target and assign a team member to get started.'):t('Target dari admin akan muncul di sini.','Targets assigned by your administrator will appear here.')} />;
 return <div className="table-scroll"><table className="data-table"><thead><tr><th>{t('Target','Target')}</th>{admin&&<th>{t('Ditugaskan ke','Assigned to')}</th>}<th>{t('Progres','Progress')}</th>{!compact&&<th>{t('Prioritas','Priority')}</th>}<th>{t('Tenggat','Due date')}</th><th>{t('Status','Status')}</th><th><span className="sr-only">{t('Buka','Open')}</span></th></tr></thead><tbody>{targets.map(item=><tr key={item.id}><td><Link className="table-title" to={`/${admin?'admin':'member'}/targets/${item.id}`}>{item.title}</Link><small>#{String(item.id).padStart(3,'0')}</small></td>{admin&&<td><span className="person-cell"><span className="avatar avatar-small">{item.assigned_name?.charAt(0)}</span>{item.assigned_name}</span></td>}<td><ProgressBar value={item.progress}/></td>{!compact&&<td><Priority value={item.priority}/></td>}<td className={item.due_date < today && !['completed','submitted'].includes(item.status)?'overdue':''}>{formatDate(item.due_date,{day:'numeric',month:'short'})}</td><td><StatusBadge status={item.status}/></td><td><Link className="table-open" aria-label={`${t('Buka target','Open target')}: ${item.title}`} to={`/${admin?'admin':'member'}/targets/${item.id}`}><Icon name="arrow" size={17}/></Link></td></tr>)}</tbody></table></div>;
}
