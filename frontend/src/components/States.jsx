import { useLanguage } from '../context/LanguageContext';
import Icon from './Icon';
export function EmptyState({ title, description, children, icon='file', compact=false }) {return <div className={`empty-state ${compact?'compact':''}`}><span className="empty-icon"><Icon name={icon} size={26}/></span><strong>{title}</strong>{description && <p>{description}</p>}{children}</div>;}
export function LoadingState() {const {t}=useLanguage();return <div className="loading-state" role="status"><span className="spinner"/>{t('Memuat ruang kerja…','Loading workspace…')}</div>;}
export function ErrorState({ onRetry }) {const {t}=useLanguage();return <div className="alert alert-error" role="alert"><span>{t('Data belum dapat dimuat. Periksa koneksi lalu coba lagi.','Unable to load data. Check your connection and try again.')}</span>{onRetry&&<button onClick={onRetry}>{t('Coba lagi','Try again')}</button>}</div>;}
