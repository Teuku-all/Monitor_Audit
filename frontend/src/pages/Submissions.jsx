import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ErrorState, LoadingState } from '../components/States';
import SubmissionTable from '../components/SubmissionTable';
import Icon from '../components/Icon';
export default function Submissions() {
  const {user}=useAuth(); const {t}=useLanguage(); const admin=user?.role==='admin';
  const [items,setItems]=useState([]);const [loading,setLoading]=useState(true);const [failed,setFailed]=useState(false);const [attempt,setAttempt]=useState(0);const [query,setQuery]=useState('');const [filter,setFilter]=useState('all');
  useEffect(()=>{const c=new AbortController();setLoading(true);setFailed(false);api.get(admin?'/submissions':'/submissions/mine',{signal:c.signal}).then(({data})=>setItems(data)).catch(()=>{if(!c.signal.aborted)setFailed(true)}).finally(()=>{if(!c.signal.aborted)setLoading(false)});return()=>c.abort()},[admin,attempt]);
  const visible=items.filter(x=>(filter==='all'||x.status===filter)&&`${x.title} ${x.member_name||''}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="workspace-page"><div className="page-heading"><div><span className="eyebrow">{t('Dokumentasi audit','Audit documentation')}</span><h1>{t('Dokumen audit','Audit documents')}</h1><p>{admin?t('Tinjau dokumen yang dikirim oleh anggota tim.','Review documents submitted by your team.') : t('Lacak status dan diskusi dokumen yang Anda kirim.','Track the status and discussion on your documents.')}</p></div>{!admin&&<Link className="btn-primary" to="/member/upload"><Icon name="plus" size={16}/>{t('Kirim dokumen','Upload document')}</Link>}</div>
    <section className="panel"><div className="panel-header"><div><h2>{t('Semua dokumen','All documents')}</h2><p>{t(`${visible.length} dokumen ditampilkan`,`${visible.length} documents shown`)}</p></div></div><div className="table-toolbar"><label className="search-box"><Icon name="search" size={16}/><input aria-label={t('Cari dokumen','Search documents')} placeholder={t('Cari dokumen...','Search documents...')} value={query} onChange={e=>setQuery(e.target.value)}/></label><select className="filter-select" value={filter} onChange={e=>setFilter(e.target.value)} aria-label={t('Filter status','Filter by status')}><option value="all">{t('Semua status','All statuses')}</option>{[['Menunggu',t('Menunggu','Pending')],['Disetujui',t('Disetujui','Approved')],['Perlu Revisi',t('Perlu Revisi','Needs revision')]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>{loading?<LoadingState/>:failed?<div className="p-5"><ErrorState onRetry={()=>setAttempt(x=>x+1)}/></div>:<SubmissionTable items={visible}/>}</section>
  </div>
}
