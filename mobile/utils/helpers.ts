// utils/helpers.ts
import { MIN_DONATION_GAP_DAYS } from '@/constants/BloodData';

export function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export function canDonateAgain(lastDonationDate: string | null): {
  canDonate: boolean;
  daysLeft: number;
} {
  if (!lastDonationDate) return { canDonate: true, daysLeft: 0 };
  const last = new Date(lastDonationDate).getTime();
  const elapsed = (Date.now() - last) / 86_400_000;
  const daysLeft = Math.max(0, Math.ceil(MIN_DONATION_GAP_DAYS - elapsed));
  return { canDonate: daysLeft === 0, daysLeft };
}

export function getBloodGroupColor(bloodGroup: string): string {
  const colors: Record<string, string> = {
    'O-':  '#FF2D55',
    'O+':  '#FF6B85',
    'A-':  '#E63946',
    'A+':  '#F4A261',
    'B-':  '#FFB300',
    'B+':  '#FFCA28',
    'AB-': '#00897B',
    'AB+': '#00D4FF',
  };
  return colors[bloodGroup] ?? '#FF2D55';
}

export function maskPhone(phone: string): string {
  if (phone.length < 4) return phone;
  return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural ?? singular + 's'}`;
}

export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate long strings with ellipsis
 */
export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}
