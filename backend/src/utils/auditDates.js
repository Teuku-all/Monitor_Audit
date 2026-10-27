function validDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

function addBusinessDays(startDate, days) {
  const date = new Date(`${startDate}T12:00:00.000Z`);
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) added += 1;
  }
  return date.toISOString().slice(0, 10);
}

function jakartaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function withScheduleStatus(item, today = jakartaDate()) {
  const remainingDays = Math.ceil((Date.parse(`${item.due_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  const complete = item.status === 'completed';
  const schedule_status = complete ? 'green' : remainingDays < 0 ? 'red' : remainingDays <= 3 ? 'yellow' : 'green';
  return { ...item, remaining_days: remainingDays, schedule_status };
}

module.exports = { validDate, addBusinessDays, jakartaDate, withScheduleStatus };
