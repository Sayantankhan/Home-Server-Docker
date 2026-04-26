import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Square, Search, Cog, RefreshCw, Terminal, X } from "lucide-react";
import { toast } from "sonner";

interface AppService {
  service_name: string;
  service_path: string;
  run_command: string;
  stop_command: string;
  build_command: string;
  log: string;
}

interface ServiceStatus {
  service: string;
  status: string;
  port?: number;
}

const fetchAppServices = async (): Promise<AppService[]> => {
  const response = await fetch("/api/appservices");
  if (!response.ok) throw new Error("Failed to fetch services");
  return response.json();
};

const stopAppService = async (name: string): Promise<void> => {
  const response = await fetch(`/api/appservices/${name}/stop`, {
    method: "POST",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to stop service");
  }
};

const fetchServiceStatus = async (name: string): Promise<ServiceStatus> => {
  // const response = await fetch(`/api/appservices/${name}/status`);
  const response = await fetch(`/api/appservices/heartbeat/services/${name}`);
  if (!response.ok) throw new Error("Failed to fetch status");
  return response.json();
};

const ServicesTab = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const [streamLogs, setStreamLogs] = useState<Record<string, string>>({});
  const [openLog, setOpenLog] = useState<string | null>(null);
  const abortControllers = useRef<Record<string, AbortController>>({});

  const { data: services, isLoading, error, refetch } = useQuery({
    queryKey: ["app-services"],
    queryFn: fetchAppServices,
    refetchInterval: 10000,
  });

  const { data: statuses } = useQuery({
    queryKey: ["app-service-statuses", services?.map((s) => s.service_name)],
    queryFn: async () => {
      if (!services) return {};
      const results = await Promise.allSettled(
        services.map((s) => fetchServiceStatus(s.service_name))
      );
      const map: Record<string, ServiceStatus> = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          map[services[i].service_name] = r.value;
        }
      });
      return map;
    },
    enabled: !!services && services.length > 0,
    refetchInterval: 20000,
  });

  const filteredServices = services?.filter((service) =>
    service.service_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStreamRun = async (name: string) => {
    setPendingActions((prev) => new Set(prev).add(name));
    setStreamLogs((prev) => ({ ...prev, [name]: "" }));
    setOpenLog(name);

    const controller = new AbortController();
    abortControllers.current[name] = controller;

    try {
      const response = await fetch(`/api/appservices/${name}/stream-run`, {
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start service");
      }

      queryClient.invalidateQueries({ queryKey: ["app-service-statuses"] });
      toast.success(`Started ${name}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          setStreamLogs((prev) => ({
            ...prev,
            [name]: (prev[name] || "") + text,
          }));
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error(`Failed to start ${name}: ${err.message}`);
      }
    } finally {
      setPendingActions((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      delete abortControllers.current[name];
    }
  };

  const handleStop = async (name: string) => {
    setPendingActions((prev) => new Set(prev).add(name));
    // Abort any active stream
    if (abortControllers.current[name]) {
      abortControllers.current[name].abort();
      delete abortControllers.current[name];
    }
    try {
      await stopAppService(name);
      queryClient.invalidateQueries({ queryKey: ["app-service-statuses"] });
      toast.success(`Stopped ${name}`);
    } catch (err: any) {
      toast.error(`Failed to stop ${name}: ${err.message}`);
    } finally {
      setPendingActions((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4">
            <p className="text-destructive">
              Failed to fetch services. Make sure the API endpoint is available.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))
        ) : filteredServices?.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              {searchQuery
                ? "No services match your search"
                : "No services found"}
            </CardContent>
          </Card>
        ) : (
          filteredServices?.map((service) => {
            const serviceStatus = statuses?.[service.service_name];
            const isRunning = serviceStatus?.status === "running";
            const isPending = pendingActions.has(service.service_name);
            const hasLog = !!streamLogs[service.service_name];

            return (
              <Card
                key={service.service_name}
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Cog className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-lg font-semibold truncate">
                        {service.service_name}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 ${
                        isRunning
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isRunning ? "running" : "stopped"}
                    </Badge>
                    {serviceStatus?.port && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        :{serviceStatus.port}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {service.service_path}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      <span className="font-medium">Run:</span>{" "}
                      <code className="bg-muted px-1 rounded">{service.run_command}</code>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {isRunning ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 gap-2"
                        onClick={() => handleStop(service.service_name)}
                        disabled={isPending}
                      >
                        <Square className="h-4 w-4" />
                        {isPending ? "Stopping..." : "Stop"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => handleStreamRun(service.service_name)}
                        disabled={isPending}
                      >
                        <Play className="h-4 w-4" />
                        {isPending ? "Starting..." : "Start"}
                      </Button>
                    )}
                    {hasLog && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() =>
                          setOpenLog(
                            openLog === service.service_name
                              ? null
                              : service.service_name
                          )
                        }
                      >
                        <Terminal className="h-4 w-4" />
                        Logs
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Log panel */}
      {openLog && streamLogs[openLog] !== undefined && (
        <Card className="border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">{openLog} — Output</CardTitle>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setOpenLog(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 w-full rounded-md border bg-muted/30 p-3">
              <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                {streamLogs[openLog] || "Waiting for output..."}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {services && services.length > 0 && (
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>
            Total: <strong className="text-foreground">{services.length}</strong>
          </span>
          <span>
            Running:{" "}
            <strong className="text-emerald-400">
              {statuses ? Object.values(statuses).filter((s) => s.status === "running").length : 0}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
};

export default ServicesTab;
