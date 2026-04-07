/** 本地日历「当天 0 点」对应的毫秒时间戳（与 `Date` 本地时区一致） */
export function startOfLocalDayMs(when = Date.now()): number {
  const d = new Date(when);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
