import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Play, Square, Search, Cog, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface AppService {
  name: string;
  status: string;
  description?: string;
}

const API_BASE = "http://localhost:5000";

const fetchAppServices = async (): Promise<AppService[]> => {
  const response = await fetch(`${API_BASE}/api/app-services`);
  if (!response.ok) throw new Error("Failed to fetch services");
  return response.json();
};

const startAppService = async (name: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/api/app-services/${name}/start`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to start service");
};

const stopAppService = async (name: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/api/app-services/${name}/stop`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to stop service");
};

const ServicesTab = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

  const { data: services, isLoading, error, refetch } = useQuery({
    queryKey: ["app-services"],
    queryFn: fetchAppServices,
    refetchInterval: 5000,
  });

  const filteredServices = services?.filter((service) =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startMutation = useMutation({
    mutationFn: startAppService,
    onMutate: (name) => {
      setPendingActions((prev) => new Set(prev).add(name));
    },
    onSuccess: (_, name) => {
      toast.success(`Started ${name}`);
      queryClient.invalidateQueries({ queryKey: ["app-services"] });
    },
    onError: (error, name) => {
      toast.error(`Failed to start ${name}: ${error.message}`);
    },
    onSettled: (_, __, name) => {
      setPendingActions((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: stopAppService,
    onMutate: (name) => {
      setPendingActions((prev) => new Set(prev).add(name));
    },
    onSuccess: (_, name) => {
      toast.success(`Stopped ${name}`);
      queryClient.invalidateQueries({ queryKey: ["app-services"] });
    },
    onError: (error, name) => {
      toast.error(`Failed to stop ${name}: ${error.message}`);
    },
    onSettled: (_, __, name) => {
      setPendingActions((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
      case "active":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "stopped":
      case "inactive":
      case "exited":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const isRunning = (status: string) =>
    status === "running" || status === "active";

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
          Array.from({ length: 6 }).map((_, i) => (
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
          filteredServices?.map((service) => (
            <Card
              key={service.name}
              className="overflow-hidden hover:shadow-lg transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cog className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-lg font-semibold truncate">
                      {service.name}
                    </CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 ${getStatusColor(service.status)}`}
                  >
                    {service.status}
                  </Badge>
                </div>
                {service.description && (
                  <p className="text-xs text-muted-foreground">
                    {service.description}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {isRunning(service.status) ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={() => stopMutation.mutate(service.name)}
                    disabled={pendingActions.has(service.name)}
                  >
                    <Square className="h-4 w-4" />
                    {pendingActions.has(service.name)
                      ? "Stopping..."
                      : "Stop Service"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => startMutation.mutate(service.name)}
                    disabled={pendingActions.has(service.name)}
                  >
                    <Play className="h-4 w-4" />
                    {pendingActions.has(service.name)
                      ? "Starting..."
                      : "Start Service"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {services && services.length > 0 && (
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>
            Total: <strong className="text-foreground">{services.length}</strong>
          </span>
          <span>
            Active:{" "}
            <strong className="text-emerald-400">
              {services.filter((s) => isRunning(s.status)).length}
            </strong>
          </span>
          <span>
            Inactive:{" "}
            <strong className="text-red-400">
              {services.filter((s) => !isRunning(s.status)).length}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
};

export default ServicesTab;