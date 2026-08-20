// تنسيق العملة بالريال السعودي
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// تنسيق الرقم بالعربية
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ar-SA").format(value);
}

// تنسيق النسبة المئوية
export function formatPercent(value: number): string {
  return `%${formatNumber(value)}`;
}

// تنسيق التاريخ بالعربية
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

// تنسيق التاريخ والوقت
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// تنسيق التاريخ القصير
export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// الوقت النسبي (منذ X)
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  const intervals: [number, string][] = [
    [31536000, "سنة"],
    [2592000, "شهر"],
    [86400, "يوم"],
    [3600, "ساعة"],
    [60, "دقيقة"],
  ];

  for (const [secondsInUnit, unitLabel] of intervals) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `منذ ${interval} ${unitLabel}`;
    }
  }
  return "الآن";
}

// اختصار النص
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

// الأسماء الأولى
export function getFirstName(fullName: string): string {
  return fullName.split(" ")[0];
}
