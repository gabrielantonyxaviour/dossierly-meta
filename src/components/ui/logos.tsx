/* Integration brand marks, drawn from the official logo geometry. Use at 20–28px inside a neutral tile. */
export function GmailLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="52 42 88 66" aria-label="Gmail" role="img">
      <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
      <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
      <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
      <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
      <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
    </svg>
  );
}

export function GoogleCalendarLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-label="Google Calendar" role="img">
      <path fill="#fff" d="M152.6 47.4H47.4v105.2h105.2z" />
      <path fill="#ea4335" d="M152.6 200 200 152.6h-47.4z" />
      <path fill="#fbbc04" d="M200 47.4h-47.4v105.2H200z" />
      <path fill="#34a853" d="M152.6 152.6H47.4V200h105.2z" />
      <path fill="#188038" d="M0 152.6v31.6C0 192.9 7.1 200 15.8 200h31.6v-47.4z" />
      <path fill="#1967d2" d="M200 47.4V15.8C200 7.1 192.9 0 184.2 0h-31.6v47.4z" />
      <path fill="#4285f4" d="M152.6 0H15.8C7.1 0 0 7.1 0 15.8v136.8h47.4V47.4h105.2z" />
      <path fill="#4285f4" d="M68.9 129c-3.9-2.7-6.6-6.5-8.1-11.6l9.1-3.8c.8 3.2 2.3 5.6 4.4 7.3s4.6 2.6 7.6 2.6c3.1 0 5.7-.9 7.9-2.8s3.3-4.2 3.3-7.1c0-2.9-1.2-5.3-3.5-7.1s-5.2-2.8-8.6-2.8h-5.3v-9h4.7c2.9 0 5.4-.8 7.4-2.4s3-3.8 3-6.5c0-2.4-.9-4.4-2.7-5.8s-4-2.2-6.7-2.2c-2.6 0-4.7.7-6.2 2.1s-2.7 3.1-3.4 5.1l-9-3.8c1.2-3.4 3.4-6.4 6.6-8.9s7.3-3.8 12.2-3.8c3.7 0 7 .7 9.9 2.1s5.2 3.4 6.8 5.9c1.7 2.5 2.5 5.3 2.5 8.5 0 3.2-.8 5.9-2.3 8.1s-3.5 3.9-5.7 5.1v.5c3 1.2 5.4 3.1 7.3 5.6s2.8 5.6 2.8 9.1-.9 6.7-2.7 9.4c-1.8 2.8-4.3 4.9-7.4 6.5s-6.6 2.4-10.5 2.4c-4.5 0-8.6-1.3-12.5-4zm55.9-45.2-9.9 7.2-5-7.5 17.9-12.9h6.9v60.8h-9.9z" />
    </svg>
  );
}

export function OutlookLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="Outlook" role="img">
      <rect x="10" y="5" width="20" height="22" rx="2" fill="#0a64ad" />
      <path d="M10 13l10 6 10-6v12a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z" fill="#28a8ea" />
      <rect x="2" y="9" width="15" height="15" rx="2" fill="#0078d4" />
      <ellipse cx="9.5" cy="16.5" rx="3.6" ry="4.4" fill="none" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

/** Meta wordmark-free infinity mark, for "Built on Meta Muse" credits. */
export function MetaMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.66} viewBox="0 0 36 24" aria-label="Meta" role="img">
      <path fill="none" stroke="#0081fb" strokeWidth="4" strokeLinecap="round" d="M4 16c0-7 3.5-12 7.5-12 6 0 9 16 14 16 3 0 6.5-3 6.5-8s-2.5-8-5.5-8c-5 0-9.5 16-15.5 16C6 20 4 18.5 4 16z" />
    </svg>
  );
}
