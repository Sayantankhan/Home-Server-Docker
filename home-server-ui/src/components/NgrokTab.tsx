import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  AppWindow,
  Cable,
} from "lucide-react";
import { toast } from "sonner";

interface NgrokUrl {
  id: string;
  url: string;
  label?: string;
  region?: string;
  status: string;
}

interface AppItem {
  id: string;
  name: string;
  port?: number;
  status: string;
  attachedNgrokId?: string;
}

// const initialNgrokPool: NgrokUrl[] = [
//   { id: "n1", url: "https://42ed-2401-4900-1cb9.ngrok-free.app", label: "Pool #1" },
//   { id: "n2", url: "https://9a12-103-21-58-77.ngrok-free.app", label: "Pool #2" },
//   { id: "n3", url: "https://b7c3-49-37-201-12.ngrok-free.app", label: "Pool #3" },
// ];

// const initialApps: AppItem[] = [
//   { id: "a1", name: "poll-app", port: 8099 },
//   { id: "a2", name: "notes-api", port: 8100 },
//   { id: "a3", name: "dashboard", port: 8101 },
// ];

const API_BASE = "";

const NgrokTab = () => {
  const [pool, setPool] = useState<NgrokUrl[]>([]);
  const [apps, setApps] = useState<AppItem[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [attachAppId, setAttachAppId] = useState<string | null>(null);
  const [selectedNgrokId, setSelectedNgrokId] = useState<string>("");

  useEffect(() => {
    fetch(`${API_BASE}/api/ngrok/tunnels`)
      .then(res => res.json())
      .then(data => {
        const mapped: NgrokUrl[] = data.map((t: any) => ({
          id: String(t.id),
          url: t.public_url,
          label: t.name,
          region: t.region,
          status: t.status
        }));
        setPool(mapped);
      })
      .catch(err => console.error("Failed to fetch ngrok tunnels:", err));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/appservices/heartbeat/services`)
      .then(res => res.json())
      .then(data => {
        const mapped: AppItem[] = data.services.map((s: any) => ({
          id: `${s.service}-${s.port}`,
          name: s.service,
          port: Number(s.port),
          status: s.status,
        }));
        setApps(mapped);
      })
      .catch(err => console.error("Failed to fetch services:", err));
  }, []);

  const attachedNgrokIds = new Set(
    apps.map((a) => a.attachedNgrokId).filter(Boolean) as string[]
  );

  const getAppByNgrok = (ngrokId: string) =>
    apps.find((a) => a.attachedNgrokId === ngrokId);

  const addNgrok = () => {
    if (!newUrl.trim()) {
      toast.error("Enter a valid URL");
      return;
    }
    const id = `n${Date.now()}`;
    setPool((prev) => [
      ...prev,
      { id, url: newUrl.trim(), label: newLabel.trim() || `Pool #${prev.length + 1}`, region: "", status: "active" },
    ]);
    setNewUrl("");
    setNewLabel("");
    toast.success("Ngrok URL added to pool");
  };

  const removeNgrok = (id: string) => {
    setApps((prev) =>
      prev.map((a) => (a.attachedNgrokId === id ? { ...a, attachedNgrokId: undefined } : a))
    );
    setPool((prev) => prev.filter((n) => n.id !== id));
    toast.success("Removed from pool");
  };

  const detachFromApp = (appId: string) => {
    setApps((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, attachedNgrokId: undefined } : a))
    );
    toast.success("Detached ngrok URL");
  };

  const openAttach = (appId: string) => {
    setAttachAppId(appId);
    setSelectedNgrokId("");
  };

  const confirmAttach = () => {
    if (!attachAppId || !selectedNgrokId) {
      toast.error("Select a ngrok URL");
      return;
    }
    setApps((prev) =>
      prev.map((a) => {
        if (a.attachedNgrokId === selectedNgrokId && a.id !== attachAppId) {
          return { ...a, attachedNgrokId: undefined };
        }
        if (a.id === attachAppId) {
          return { ...a, attachedNgrokId: selectedNgrokId };
        }
        return a;
      })
    );
    toast.success("Ngrok URL attached");
    setAttachAppId(null);
    setSelectedNgrokId("");
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

  const attachingApp = apps.find((a) => a.id === attachAppId);
  const availableForSelect = pool.filter(
    (n) => !attachedNgrokIds.has(n.id) || getAppByNgrok(n.id)?.id === attachAppId
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            Ngrok Pool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              placeholder="https://xxxx.ngrok-free.app"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Label (optional)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="md:w-48"
            />
            <Button onClick={addNgrok} className="gap-2">
              <Plus className="h-4 w-4" />
              Add to Pool
            </Button>
          </div>

          {pool.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No ngrok URLs in pool. Add one above.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {pool.map((n) => {
                const attachedApp = getAppByNgrok(n.id);
                return (
                  <div
                    key={n.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 rounded-md bg-primary/10 shrink-0">
                        <Cable className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{n.label}</span>
                          {attachedApp ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]"
                            >
                              attached
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              free
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{n.url}</p>
                        {attachedApp && (
                          <p className="text-xs text-primary mt-0.5">
                            -&gt; {attachedApp.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copy(n.url)}
                        title="Copy URL"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" asChild title="Open">
                        <a href={n.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeNgrok(n.id)}
                        title="Remove from pool"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AppWindow className="h-5 w-5 text-primary" />
            Applications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => {
              const ngrok = pool.find((n) => n.id === app.attachedNgrokId);
              return (
                <Card key={app.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold truncate">
                        {app.name}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        {app.port && (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            :{app.port}
                          </Badge>
                        )}
                        {app.status && (
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-[10px] ${
                              app.status === "running"
                                ? "border-green-500 text-green-500"
                                : "border-red-500 text-red-500"
                            }`}
                          >
                            {app.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {ngrok ? (
                      <div className="space-y-2">
                        <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            Tunnel
                          </p>
                          <a
                            href={ngrok.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-400 hover:underline break-all flex items-start gap-1 mt-1"
                          >
                            <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="break-all">{ngrok.url}</span>
                          </a>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-2"
                            onClick={() => openAttach(app.id)}
                          >
                            <Link2 className="h-4 w-4" />
                            Reassign
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 gap-2"
                            onClick={() => detachFromApp(app.id)}
                          >
                            <Link2Off className="h-4 w-4" />
                            Detach
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => openAttach(app.id)}
                      >
                        <Link2 className="h-4 w-4" />
                        Attach Ngrok URL
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={attachAppId !== null}
        onOpenChange={(open) => !open && setAttachAppId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach Ngrok URL to {attachingApp?.name}</DialogTitle>
            <DialogDescription>
              Pick a URL from your pool. Reassigning will detach it from any other app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={selectedNgrokId} onValueChange={setSelectedNgrokId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a ngrok URL" />
              </SelectTrigger>
              <SelectContent>
                {availableForSelect.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    No URLs available
                  </div>
                ) : (
                  availableForSelect.map((n) => {
                    const owner = getAppByNgrok(n.id);
                    return (
                      <SelectItem key={n.id} value={n.id}>
                        <div className="flex flex-col">
                          <span className="text-sm">{n.label}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {n.url}
                            {owner && owner.id !== attachAppId ? ` - used by ${owner.name}` : ""}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachAppId(null)}>
              Cancel
            </Button>
            <Button onClick={confirmAttach}>Attach</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NgrokTab;
