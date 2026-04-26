import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Settings2, Copy } from "lucide-react";
import { toast } from "sonner";

interface ConfigItem {
  key: string;
  value: string;
}

const fetchConfig = async (): Promise<ConfigItem[]> => {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error("Failed to fetch config");
  return response.json();
};

const ConfigTab = () => {
  const { data: config, isLoading, error, refetch } = useQuery({
    queryKey: ["app-config"],
    queryFn: fetchConfig,
    refetchInterval: 30000,
  });

  const copyValue = async (key: string, value: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success(`Copied ${key}`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">App Configuration</h2>
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
              Failed to fetch configuration. Make sure the API endpoint is available.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : config?.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No configuration parameters found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {config?.map((item) => (
            <Card key={item.key} className="overflow-hidden">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {item.key}
                    </Badge>
                  </div>
                  <p className="text-sm font-mono text-muted-foreground truncate">
                    {item.value}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 h-8 w-8"
                  onClick={() => copyValue(item.key, item.value)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {config && config.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Total parameters: <strong className="text-foreground">{config.length}</strong>
        </div>
      )}
    </div>
  );
};

export default ConfigTab;
