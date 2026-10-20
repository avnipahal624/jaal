import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useJaal } from "@/state/JaalProvider";
import { formatClock, relativeTime } from "@/utils/formatters";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useState } from "react";

const KIND_COLOR: Record<string, string> = {
  stage: "bg-jamber",
  evidence: "bg-jred",
  report: "bg-jcyan",
  system: "bg-jteal",
};

export function NotificationCenter() {
  const { state, markNotificationsRead, clearNotifications } = useJaal();
  const [open, setOpen] = useState(false);
  const unread = state.notifications.filter((n) => !n.read).length;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) markNotificationsRead();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications (${unread} unread)`}
          className="relative flex size-8 items-center justify-center border border-jborder/70 bg-jsurface text-jmuted transition-colors hover:border-jcyan/50 hover:text-jcyan"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-jred px-1 font-mono text-[9px] font-semibold text-background">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[340px] border-jborder/80 bg-popover p-0"
      >
        <div className="flex items-center justify-between border-b border-jborder/70 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-jtext">Notifications</p>
            <p className="jaal-label mt-0.5">Investigation feed</p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-jmuted hover:text-jcyan"
              onClick={markNotificationsRead}
              title="Mark all read"
            >
              <CheckCheck className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-jmuted hover:text-jred"
              onClick={clearNotifications}
              title="Clear all"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {state.notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-jmuted">
              No notifications. Events from active cases appear here.
            </p>
          ) : (
            <ul className="divide-y divide-jborder/50">
              {state.notifications.map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-3">
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 ${KIND_COLOR[n.kind] ?? "bg-jteal"}`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-snug text-jtext">
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-jmuted">
                      {n.detail}
                    </p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-jmuted/70">
                      {relativeTime(n.timestamp)} · {formatClock(n.timestamp)}
                      {n.caseId ? ` · ${n.caseId}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
