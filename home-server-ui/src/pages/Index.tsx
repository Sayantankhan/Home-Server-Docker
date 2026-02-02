import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { AddServiceModal } from "@/components/AddServiceModal";
import { Play, Square, ExternalLink, Server, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

interface Service {
  name: string;
  status: string;
  type: string;
  urls: string[];
}

const API_BASE = "http://192.168.1.10:5000";

const fetchServices = async (): Promise<Service[]> => {
  const response = await fetch(`${API_BASE}/api/services`);
  if (!response.ok) throw new Error("Failed to fetch services");
  return response.json();
};

const startService = async (name: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/api/services/${name}/start`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to start service");
};

const stopService = async (name: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/api/services/${name}/exit`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to stop service");
};

const Index = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

  const { data: services, isLoading, error, refetch } = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
    refetchInterval: 5000,
  });

  const filteredServices = services?.filter((service) =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startMutation = useMutation({
    mutationFn: startService,
    onMutate: (name) => {
      setPendingActions((prev) => new Set(prev).add(name));
    },
    onSuccess: (_, name) => {
      toast.success(`Started ${name}`);
      queryClient.invalidateQueries({ queryKey: ["services"] });
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
    mutationFn: stopService,
    onMutate: (name) => {
      setPendingActions((prev) => new Set(prev).add(name));
    },
    onSuccess: (_, name) => {
      toast.success(`Stopped ${name}`);
      queryClient.invalidateQueries({ queryKey: ["services"] });
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
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "exited":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "paused":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Server className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Home Server</h1>
              <p className="text-muted-foreground">Docker Container Manager</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AddServiceModal />
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
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search containers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-destructive/50 bg-destructive/10 mb-6">
            <CardContent className="p-4">
              <p className="text-destructive">
                Failed to connect to server. Make sure your Flask backend is running on {API_BASE}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Services Grid */}
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
                {searchQuery ? "No containers match your search" : "No containers found"}
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
                    <CardTitle className="text-lg font-semibold truncate">
                      {service.name}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={`shrink-0 ${getStatusColor(service.status)}`}
                    >
                      {service.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{service.type}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* URLs */}
                  {service.urls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {service.urls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {url.replace("http://", "")}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  {service.status === "running" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full gap-2"
                      onClick={() => stopMutation.mutate(service.name)}
                      disabled={pendingActions.has(service.name)}
                    >
                      <Square className="h-4 w-4" />
                      {pendingActions.has(service.name) ? "Stopping..." : "Stop Container"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => startMutation.mutate(service.name)}
                      disabled={pendingActions.has(service.name)}
                    >
                      <Play className="h-4 w-4" />
                      {pendingActions.has(service.name) ? "Starting..." : "Start Container"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Stats Footer */}
        {services && services.length > 0 && (
          <div className="mt-8 flex gap-6 text-sm text-muted-foreground">
            <span>
              Total: <strong className="text-foreground">{services.length}</strong>
            </span>
            <span>
              Running:{" "}
              <strong className="text-emerald-400">
                {services.filter((s) => s.status === "running").length}
              </strong>
            </span>
            <span>
              Stopped:{" "}
              <strong className="text-red-400">
                {services.filter((s) => s.status !== "running").length}
              </strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;