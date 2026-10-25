export default function StatusBadge({ status }) {
  const map = {
    Menunggu: 'bg-amber-300/[0.08] text-amber-200 border-amber-200/15',
    Disetujui: 'bg-emerald-300/[0.08] text-emerald-200 border-emerald-200/15',
    'Perlu Revisi': 'bg-rose-300/[0.08] text-rose-200 border-rose-200/15',
  };
  const dot = {
    Menunggu: 'bg-amber-300',
    Disetujui: 'bg-emerald-300',
    'Perlu Revisi': 'bg-rose-300',
  };
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${map[status] || 'border-gray-500/20 bg-gray-500/10 text-gray-300'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status] || 'bg-gray-400'}`} aria-hidden="true" />
      {status}
    </span>
  );
}
