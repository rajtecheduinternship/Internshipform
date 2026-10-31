// The programme calendar is explicitly India time, independent of device timezone.
export const CLASS_TIMEZONE = 'Asia/Kolkata';
export const classDay = (date: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: CLASS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
export const classTime = (date: string) => new Intl.DateTimeFormat('en-IN', { timeZone: CLASS_TIMEZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
export const classInput = (date: string) => `${classDay(date)}T${new Intl.DateTimeFormat('en-GB', { timeZone: CLASS_TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(date))}`;
export const classInstant = (value: string) => value ? new Date(`${value}:00+05:30`).toISOString() : '';
