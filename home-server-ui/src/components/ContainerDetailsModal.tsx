import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Cpu,
  HardDrive,
  Network,
  Activity,
  Box,
  Globe,
} from "lucide-react";

const API_BASE = "";

interface ContainerStats {
  name: string;
  id: string;
  image: string;
  status: string;
  cpu: { percent: number };
  memory: { usage_bytes: number; limit_bytes: number; percent: number };
  pids: number;
  network_io: { rx_bytes: number; tx_bytes: number };
  block_io: { read_bytes: number; write_bytes: number };
  network_mode: string;
  ports: {
    exposed: string[];
    published: { container_port: string; host_ip: string; host_port: string }[];
  };
}

interface ContainerDetailsModalProps {
  containerName: string | null;
  onClose: () => void;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const fetchContainerStats = async (name: string): Promise<ContainerStats> => {
  const response = await fetch(`${API_BASE}/api/services/${name}/stats`);
  if (!response.ok) throw new Error("Failed to fetch container stats");
  return response.json();
};

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

export function ContainerDetailsModal({
  containerName,
  onClose,
}: ContainerDetailsModalProps) {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["containerStats", containerName],
    queryFn: () => fetchContainerStats(containerName!),
    enabled: !!containerName,
    refetchInterval: 3000,
  });

  return (
    <Dialog open={!!containerName} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Box className="h-5 w-5 text-primary" />
            {containerName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="text-destructive p-4 bg-destructive/10 rounded-lg">
            Failed to load container stats
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Identity Section */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Container ID</p>
                <p className="font-mono text-sm">{stats.id}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant="outline" className={getStatusColor(stats.status)}>
                  {stats.status}
                </Badge>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Image</p>
                <p className="font-mono text-sm truncate">{stats.image}</p>
              </div>
            </div>

            {/* Resource Usage */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Resource Usage
              </h3>

              <div className="grid gap-4">
                {/* CPU */}
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-blue-400" />
                      CPU
                    </span>
                    <span className="text-sm font-medium">{stats.cpu.percent}%</span>
                  </div>
                  <Progress value={stats.cpu.percent} className="h-2" />
                </div>

                {/* Memory */}
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-purple-400" />
                      Memory
                    </span>
                    <span className="text-sm font-medium">
                      {formatBytes(stats.memory.usage_bytes)} / {formatBytes(stats.memory.limit_bytes)}
                    </span>
                  </div>
                  <Progress value={stats.memory.percent} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">
                    {stats.memory.percent}% used
                  </p>
                </div>

                {/* PIDs */}
                <div className="p-4 border rounded-lg flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-400" />
                    Running Processes
                  </span>
                  <span className="text-sm font-medium">{stats.pids}</span>
                </div>
              </div>
            </div>

            {/* IO Stats */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Network className="h-4 w-4" />
                I/O Statistics
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Network IO */}
                <div className="p-4 border rounded-lg space-y-2">
                  <p className="text-xs text-muted-foreground">Network I/O</p>
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="text-emerald-400">↓</span> RX: {formatBytes(stats.network_io.rx_bytes)}
                    </p>
                    <p className="text-sm">
                      <span className="text-blue-400">↑</span> TX: {formatBytes(stats.network_io.tx_bytes)}
                    </p>
                  </div>
                </div>

                {/* Block IO */}
                <div className="p-4 border rounded-lg space-y-2">
                  <p className="text-xs text-muted-foreground">Block I/O</p>
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="text-emerald-400">↓</span> Read: {formatBytes(stats.block_io.read_bytes)}
                    </p>
                    <p className="text-sm">
                      <span className="text-blue-400">↑</span> Write: {formatBytes(stats.block_io.write_bytes)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Networking */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Networking
              </h3>

              <div className="p-4 border rounded-lg space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Network Mode</p>
                  <p className="text-sm font-mono">{stats.network_mode}</p>
                </div>

                {stats.ports.exposed.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Exposed Ports</p>
                    <div className="flex flex-wrap gap-1">
                      {stats.ports.exposed.map((port) => (
                        <Badge key={port} variant="secondary" className="font-mono text-xs">
                          {port}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {stats.ports.published.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Published Ports</p>
                    <div className="space-y-1">
                      {stats.ports.published.map((port, idx) => (
                        <p key={idx} className="text-sm font-mono">
                          {port.host_ip || "0.0.0.0"}:{port.host_port} → {port.container_port}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
