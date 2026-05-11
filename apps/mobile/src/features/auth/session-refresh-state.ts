let refreshRejectedByAuth = false;

export function resetRefreshAuthRejected(): void {
  refreshRejectedByAuth = false;
}

export function markRefreshAuthRejected(): void {
  refreshRejectedByAuth = true;
}

export function takeRefreshAuthRejected(): boolean {
  const v = refreshRejectedByAuth;
  refreshRejectedByAuth = false;
  return v;
}
