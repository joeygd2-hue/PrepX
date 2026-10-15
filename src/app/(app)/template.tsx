/** Re-mounts on every navigation (and on first load/refresh), replaying the enter animation. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
