import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Link2,
  Link2Off,
  Copy,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface RawTunnel {
  id?: number;
  tunnel_id?: number;
  name?: string;
  public_url: string;
  status: string;
  region?: string;
  port?: number | null;
  created_at?: string;
}

interface Tunnel {
  tunnel_id: number;
  name?: string;
  public_url: string;
  status: string;
  region?: string;
  created_at?: string;
}

interface TunnelStatus {
  tunnel_id: number;
  attached: boolean;
  process_id: number | null;
  app_port?: number;
}

interface HeartbeatService {
  service: string;
  status: string;
  port?: number | string;
  host?: string;
}

interface AppOption {
  name: string;
  port: number;
  status: string;
  host?: string;
}

const fetchTunnels = async (): Promise<Tunnel[]> => {
  const res = await fetch("/api/ngrok/tunnels");
  if (!res.ok) throw new Error("Failed to fetch tunnels");
  const data = await res.json();
  const list: RawTunnel[] = Array.isArray(data) ? data : data.tunnels || [];
  return list.map((t) => ({
    tunnel_id: (t.tunnel_id ?? t.id) as number,
    name: t.name,
    public_url: t.public_url,
    status: t.status,
    region: t.region,
    created_at: t.created_at,
  }));
};

const fetchTunnelStatus = async (tunnelId: number): Promise<TunnelStatus> => {
  const res = await fetch(`/api/ngrok/tunnels/${tunnelId}`);
  if (!res.ok) throw new Error("Failed to fetch tunnel status");
  return res.json();
};

const fetchHeartbeatServices = async (): Promise<HeartbeatService[]> => {
  const res = await fetch("/api/appservices/heartbeat/services");
  if (!res.ok) throw new Error("Failed to fetch services");
  const data = await res.json();
  return Array.isArray(data) ? data : data.services || [];
};

const attachTunnel = async (tunnelId: number, port: number) => {
  const res = await fetch(`/api/ngrok/tunnel/${tunnelId}/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ port }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to attach tunnel");
  return data;
};

const detachTunnel = async (tunnelId: number) => {
  const res = await fetch(`/api/ngrok/tunnel/${tunnelId}/detach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to detach tunnel");
  return data;
};

const NgrokTab = () => {
  const [statuses, setStatuses] = useState<Record<number, TunnelStatus>>({});
  const [selectedApp, setSelectedApp] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const {
    data: tunnels,
    isLoading: tunnelsLoading,
    refetch: refetchTunnels,
  } = useQuery({
    queryKey: ["ngrok-tunnels"],
    queryFn: fetchTunnels,
  });

  const {
    data: services,
    isLoading: servicesLoading,
    refetch: refetchServices,
  } = useQuery({
    queryKey: ["heartbeat-services"],
    queryFn: fetchHeartbeatServices,
  });

  const setBusyKey = (key: string, on: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const refreshStatus = async (tunnelId: number) => {
    try {
      const s = await fetchTunnelStatus(tunnelId);
      setStatuses((prev) => ({ ...prev, [tunnelId]: s }));
    } catch (e) {
      // ignore individual status errors
    }
  };

  const refreshAllStatuses = async (list: Tunnel[]) => {
    await Promise.all(list.map((t) => refreshStatus(t.tunnel_id)));
  };

  // Load statuses whenever the tunnels list changes
  useEffect(() => {
    if (tunnels && tunnels.length > 0) {
      refreshAllStatuses(tunnels);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tunnels]);

  const refreshAll = async () => {
    const [t] = await Promise.all([refetchTunnels(), refetchServices()]);
    if (t.data) await refreshAllStatuses(t.data);
  };

  const apps: AppOption[] = (services || [])
    .map((s) => ({
      name: s.service,
      port: typeof s.port === "string" ? Number(s.port) : (s.port as number),
      status: s.status,
      host: s.host,
    }))
    .filter((a) => typeof a.port === "number" && !Number.isNaN(a.port));

  const handleAttach = async (tunnelId: number) => {
    const portStr = selectedApp[tunnelId];
    if (!portStr) {
      toast.error("Select an app first");
      return;
    }
    const port = Number(portStr);
    const key = `attach-${tunnelId}`;
    setBusyKey(key, true);
    try {
      await attachTunnel(tunnelId, port);
      toast.success("Tunnel attached");
      await refreshStatus(tunnelId);
      setSelectedApp((prev) => {
        const next = { ...prev };
        delete next[tunnelId];
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to attach");
    } finally {
      setBusyKey(key, false);
    }
  };

  const handleDetach = async (tunnelId: number) => {
    const key = `detach-${tunnelId}`;
    setBusyKey(key, true);
    try {
      await detachTunnel(tunnelId);
      toast.success("Tunnel detached");
      await refreshStatus(tunnelId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to detach");
    } finally {
      setBusyKey(key, false);
    }
  };

  const copy = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const buildPublicHref = (url: string) =>
    url.startsWith("http") ? url : `https://${url}`;

  const getAppNameByPort = (port?: number) => {
    if (port === undefined) return undefined;
    return apps.find((a) => a.port === port)?.name;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshAll}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            Ngrok Tunnels
            <Badge variant="outline" className="ml-2 text-[10px]">
              {tunnels?.length ?? 0}
            </Badge>
            {servicesLoading ? null : (
              <Badge variant="outline" className="text-[10px]">
                {apps.length} apps
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tunnelsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !tunnels || tunnels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No tunnels available.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Public URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attached App</TableHead>
                    <TableHead className="text-right w-[320px]">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tunnels.map((t) => {
                    const status = statuses[t.tunnel_id];
                    const isAttached = !!status?.attached;
                    const attachedApp = getAppNameByPort(status?.app_port);
                    const attachKey = `attach-${t.tunnel_id}`;
                    const detachKey = `detach-${t.tunnel_id}`;
                    return (
                      <TableRow key={t.tunnel_id}>
                        <TableCell className="font-mono text-xs">
                          #{t.tunnel_id}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {t.name || `Tunnel ${t.tunnel_id}`}
                        </TableCell>
                        <TableCell>
                          {t.region ? (
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                            >
                              {t.region}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 max-w-[260px]">
                            <span className="text-xs truncate">
                              {t.public_url}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => copy(t.public_url)}
                              title="Copy URL"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              asChild
                              title="Open"
                            >
                              <a
                                href={buildPublicHref(t.public_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              isAttached
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]"
                                : "text-[10px]"
                            }
                          >
                            {isAttached ? "attached" : "free"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isAttached ? (
                            <div className="flex flex-col">
                              <span className="text-sm">
                                {attachedApp || "—"}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                port {status?.app_port}
                                {status?.process_id
                                  ? ` · pid ${status.process_id}`
                                  : ""}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAttached ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-2"
                              disabled={busy.has(detachKey)}
                              onClick={() => handleDetach(t.tunnel_id)}
                            >
                              <Link2Off className="h-4 w-4" />
                              Detach
                            </Button>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <Select
                                value={selectedApp[t.tunnel_id] || ""}
                                onValueChange={(v) =>
                                  setSelectedApp((prev) => ({
                                    ...prev,
                                    [t.tunnel_id]: v,
                                  }))
                                }
                              >
                                <SelectTrigger className="h-9 w-[180px]">
                                  <SelectValue
                                    placeholder={
                                      apps.length === 0
                                        ? "No apps"
                                        : "Select app"
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {apps.length === 0 ? (
                                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                                      No running apps
                                    </div>
                                  ) : (
                                    apps.map((a) => (
                                      <SelectItem
                                        key={`${a.name}-${a.port}`}
                                        value={String(a.port)}
                                      >
                                        <div className="flex flex-col">
                                          <span className="text-sm">
                                            {a.name}
                                          </span>
                                          <span className="text-[10px] text-muted-foreground">
                                            {a.host || "127.0.0.1"}:{a.port}
                                          </span>
                                        </div>
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                className="gap-2"
                                disabled={
                                  busy.has(attachKey) ||
                                  !selectedApp[t.tunnel_id]
                                }
                                onClick={() => handleAttach(t.tunnel_id)}
                              >
                                <Link2 className="h-4 w-4" />
                                Attach
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NgrokTab;
