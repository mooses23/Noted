import { useState } from "react";
import { useLocation } from "wouter";
import { Bell } from "lucide-react";
import {
  useListMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getListMyNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { data } = useListMyNotifications({
    query: {
      refetchInterval: 30_000,
      staleTime: 15_000,
    } as never,
  });

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  async function handleClick(item: (typeof items)[number]) {
    setOpen(false);
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id);
      } catch {
        // ignore
      }
      qc.invalidateQueries({ queryKey: getListMyNotificationsQueryKey() });
    }
    const [path, hash] = item.linkPath.split("#");
    setLocation(path ?? "/");
    if (hash) {
      requestAnimationFrame(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead();
    } catch {
      // ignore
    }
    qc.invalidateQueries({ queryKey: getListMyNotificationsQueryKey() });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="relative p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs uppercase tracking-widest font-medium">
            Notifications
          </span>
          {unread > 0 && (
            <button
              onClick={handleMarkAll}
              className="text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleClick(item)}
                className={`w-full text-left px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors ${
                  item.readAt ? "" : "bg-muted/20"
                }`}
              >
                <div className="flex items-start gap-2">
                  {!item.readAt && (
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-snug truncate">
                      {item.title}
                    </div>
                    {item.body && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.body}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {timeAgo(item.createdAt)}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
