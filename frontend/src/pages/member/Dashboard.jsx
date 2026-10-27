import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import Icon from '../../components/Icon';
import StatusBadge from '../../components/StatusBadge';
import SubmissionTable from '../../components/SubmissionTable';
import {ProgressBar} from '../../components/TargetTable';
import {EmptyState,ErrorState,LoadingState} from '../../components/States';
import ScheduleBadge from '../../components/ScheduleBadge';
export default function MemberDashboard(){
 const {user}=useAuth();const {t,formatDate}=useLanguage();const [data,setData]=useState(null);const [error,setError]=useState(false);const [retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setError(false);Promise.all([api.get('/targets'),api.get('/submissions/mine')]).then(([a,b])=>{if(active)setData({targets:a.data,submissions:b.data})}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[retry]);
 if(error)return <ErrorState onRetry={()=>setRetry(n=>n+1)}/>;if(!data)return <LoadingState/>;
 const active=data.targets.filter(item=>item.status!=='completed');const done=data.targets.length-active.length;const stale=active.filter(item=>Date.now()-new Date(item.updated_at).getTime()>7*86400000);
 return <div className="workspace-page"><div className="member-welcome"><div><span className="eyebrow" style={{color:'#C2E8FF'}}>{t('Ruang kerja Anda','Your workspace')}</span><h1>{t('Halo','Hello')}, {user?.name?.split(' ')[0]}.</h1><p>{t('Satu langkah lebih dekat dengan target Anda. Lanjutkan pekerjaan dan beri kabar kepada tim.','One step closer to your goals. Continue your work and keep your team in the loop.')}</p></div><span className="welcome-target"><Icon name="target" size={43}/></span></div>
 <div className="stats-grid four section-space">{[[data.targets.length,t('Total target','Total targets'),'target'],[active.length,t('Target aktif','Active targets'),'clock'],[done,t('Target selesai','Completed targets'),'check'],[data.submissions.length,t('Dokumen terkirim','Submitted documents'),'file']].map(([value,label,icon],i)=><div className={`metric ${i===1?'featured':''}`} key={icon}><span className="metric-icon"><Icon name={icon} size={17}/></span><strong>{value}</strong><p>{label}</p></div>)}</div>
 <section className="panel section-space"><div className="panel-header"><div><h2>{t('Fokus pekerjaan Anda','Your work in focus')}</h2><p>{t('Target aktif yang memerlukan perhatian.','Active targets that need your attention.')}</p></div><Link className="text-link" to="/member/targets">{t('Lihat semua','View all')}<Icon name="arrow" size={14}/></Link></div>{stale.length>0&&<div className="alert alert-warning" role="status">{t(`${stale.length} target belum diperbarui lebih dari 7 hari. Perbarui progres untuk monitoring mingguan.`,`${stale.length} targets have not been updated for more than 7 days. Update them for weekly monitoring.`)}</div>}{active.length?active.slice(0,4).map(item=><Link className="work-card" key={item.id} to={`/member/targets/${item.id}`}><span className="avatar"><Icon name="target" size={18}/></span><div><strong>{item.title}</strong><small>{t('Tenggat','Due')} {formatDate(item.due_date)}</small><ProgressBar value={item.progress}/></div><span className="work-card-status"><ScheduleBadge status={item.schedule_status}/><StatusBadge status={item.status}/></span><Icon name="chevron" size={17}/></Link>):<EmptyState icon="target" title={t('Tidak ada target aktif','No active targets')} description={t('Penugasan baru dari admin akan tampil di sini.','New assignments from your administrator will appear here.')}/>}</section>
 <section className="panel"><div className="panel-header"><div><h2>{t('Dokumen terbaru','Recent documents')}</h2><p>{t('Hasil kerja yang telah Anda kirim.','Work you have shared with the team.')}</p></div><Link className="btn-secondary" to="/member/upload"><Icon name="upload" size={15}/>{t('Kirim dokumen','Upload document')}</Link></div><SubmissionTable items={data.submissions.slice(0,4)}/></section>
 </div>;
}
