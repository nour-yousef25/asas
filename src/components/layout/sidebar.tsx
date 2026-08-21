"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SIDEBAR_MENU } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    SIDEBAR_MENU.forEach((m) => {
      if ("isSection" in m) {
        initial[m.key] = true;
      }
    });
    return initial;
  });

  const isActive = (url?: string) => {
    if (!url) return false;
    if (url === "/") return pathname === "/";
    return pathname?.startsWith(url);
  };

  const toggleSection = (key: string) => {
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden no-print",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-72 bg-sidebar text-sidebar-foreground border-l border-sidebar-border transition-transform lg:translate-x-0 lg:static lg:z-auto no-print",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Logo />
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-md hover:bg-muted"
            aria-label="إغلاق القائمة"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="h-[calc(100vh-4rem)] overflow-y-auto p-3">
          {SIDEBAR_MENU.map((item) => {
            if ("isSection" in item) {
              const sectionOpen = openSections[item.key] ?? true;
              return (
                <div key={item.key} className="mb-2">
                  <button
                    onClick={() => toggleSection(item.key)}
                    className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground"
                  >
                    {item.label}
                    <svg
                      className={cn("transition-transform", sectionOpen && "rotate-180")}
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {sectionOpen && (
                    <div className="mt-1 space-y-1">
                      {item.children?.map((child) => (
                        <Link
                          key={child.key}
                          href={child.url}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            isActive(child.url)
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          <span className="h-4 w-4 flex-shrink-0" aria-hidden>
                            <SidebarIcon name={child.icon} />
                          </span>
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={item.key}
                href={item.url}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors mb-1",
                  isActive(item.url) ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <span className="h-4 w-4 flex-shrink-0" aria-hidden>
                  <SidebarIcon name={item.icon} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

// أيقونات بسيطة SVG
function SidebarIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    LayoutDashboard: <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
    Newspaper: <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2M18 14h-8M15 18h-5M10 6h8v4h-8z" />,
    Image: <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21M3 13a9 9 0 1 1 9-9M3 13a9 9 0 0 1 9-9M9 7h.01M21 21v-7H3v7z" />,
    FileText: <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v5h5M16 13H8M16 17H8M10 9H8" />,
    Megaphone: <path d="m3 11 18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6" />,
    Users: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
    HeartHandshake: <path d="m11 17 2 2a1 1 0 1 0 3-3M20 12V8h-4l-2-2H8L6 8H2v4M9 13l1-1a2 2 0 0 1 3 3l-3 3-3-3a2 2 0 0 1 0-3 2 2 0 0 1 3 0z" />,
    UsersRound: <path d="M18 21a8 8 0 0 0-16 0M2 21v-1a8 8 0 0 1 8-8M22 21v-1a8 8 0 0 0-3-6.13M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    HandCoins: <path d="M11 15h2a4 4 0 0 0 0-8M5 11h6M3 19v-2a4 4 0 0 1 4-4h7M15 7h.01M19 11h2a2 2 0 0 0 0-4 2 2 0 0 0-2 2z" />,
    HandHeart: <path d="M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16M7 20H4a2 2 0 0 1-2-2v-1l3-3.5M14 20H9.5L7 17.5M20 9.5V14c0 2-2 3-3 3s-2-1-2-3M18 9.5a3 3 0 0 0-6 0" />,
    FolderKanban: <path d="M8 10h8M8 14h6M4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.343a2 2 0 0 0-.586-1.414l-3.343-3.343A2 2 0 0 0 13.343 3H6a2 2 0 0 0-2 2z" />,
    Calendar: <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />,
    ListTodo: <path d="M3 3h2l1 1v2M3 9h2l1 1v2M3 15h2l1 1v2M11 6h10M11 12h10M11 18h10M3 3l1 1v2H3z" />,
    ClipboardList: <path d="M9 2h6a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2zM4 4v18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-3M9 14h6M9 10h6" />,
    TrendingUp: <path d="m22 7-8.5 8.5-5-5L2 17M16 7h6v6" />,
    Gauge: <path d="m12 14 4-4M3.34 19a10 10 0 1 1 17.32 0" />,
    Star: <path d="M11.525 2.295a.5.5 0 0 1 .95 0l2.31 6.998a.5.5 0 0 0 .476.352h7.464a.5.5 0 0 1 .3.9l-6.045 4.39a.5.5 0 0 0-.177.556l2.31 6.998a.5.5 0 0 1-.77.56l-6.045-4.39a.5.5 0 0 0-.588 0l-6.045 4.39a.5.5 0 0 1-.77-.56l2.31-6.998a.5.5 0 0 0-.177-.556l-6.045-4.39a.5.5 0 0 1 .3-.9h7.464a.5.5 0 0 0 .476-.352z" />,
    ShoppingCart: <path d="M6 6h15l-1.5 9h-12zM6 6 5 3H3M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />,
    Wallet: <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5M17 13h.01" />,
    BarChart3: <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />,
    MessageSquare: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    Bell: <path d="M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.674C19.41 14.046 18 12.61 18 8A6 6 0 0 0 6 8c0 4.61-1.41 6.046-2.738 7.326z" />,
    Building2: <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 22H6M10 6h4M10 10h4M10 14h4M10 18h4" />,
    UserCog: <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 7v.01M9 11v.01M9 15v.01" />,
    Settings: <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    FlaskConical: <path d="M10 2v7.31M14 9.3V1.97a1 1 0 0 0-.83-.95L7.28.26a1 1 0 0 0-1.28.96v8.51L2.27 17.5A1 1 0 0 0 3.16 19h11.68a1 1 0 0 0 .89-1.5z" />,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || icons.LayoutDashboard}
    </svg>
  );
}
