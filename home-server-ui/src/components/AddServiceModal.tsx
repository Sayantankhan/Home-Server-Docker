import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const API_BASE = "http://localhost:5000";

interface AddServiceData {
  name: string;
  image: string;
  ports?: Record<string, number>;
  environment?: Record<string, string>;
  command?: string;
  restart_policy?: string;
}

const addService = async (data: AddServiceData): Promise<void> => {
  const response = await fetch(`${API_BASE}/api/services/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to add service");
  }
};

const parseKeyValuePairs = (text: string): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!text.trim()) return result;
  
  text.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key?.trim()) {
      result[key.trim()] = valueParts.join("=").trim();
    }
  });
  return result;
};

const parsePorts = (text: string): Record<string, number> => {
  const result: Record<string, number> = {};
  if (!text.trim()) return result;
  
  text.split("\n").forEach((line) => {
    const match = line.match(/^(\d+)\s*:\s*(\d+)(?:\/(\w+))?$/);
    if (match) {
      const [, hostPort, containerPort, protocol = "tcp"] = match;
      result[`${containerPort}/${protocol}`] = parseInt(hostPort, 10);
    }
  });
  return result;
};

export const AddServiceModal = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [ports, setPorts] = useState("");
  const [environment, setEnvironment] = useState("");
  const [command, setCommand] = useState("");
  const [restartPolicy, setRestartPolicy] = useState("unless-stopped");

  const mutation = useMutation({
    mutationFn: addService,
    onSuccess: () => {
      toast.success(`Service "${name}" created successfully`);
      queryClient.invalidateQueries({ queryKey: ["services"] });
      resetForm();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create service: ${error.message}`);
    },
  });

  const resetForm = () => {
    setName("");
    setImage("");
    setPorts("");
    setEnvironment("");
    setCommand("");
    setRestartPolicy("unless-stopped");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !image.trim()) {
      toast.error("Name and Image are required");
      return;
    }

    const data: AddServiceData = {
      name: name.trim(),
      image: image.trim(),
      restart_policy: restartPolicy,
    };

    const parsedPorts = parsePorts(ports);
    if (Object.keys(parsedPorts).length > 0) {
      data.ports = parsedPorts;
    }

    const parsedEnv = parseKeyValuePairs(environment);
    if (Object.keys(parsedEnv).length > 0) {
      data.environment = parsedEnv;
    }

    if (command.trim()) {
      data.command = command.trim();
    }

    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Service
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Service</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Container Name *</Label>
            <Input
              id="name"
              placeholder="my-container"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Docker Image *</Label>
            <Input
              id="image"
              placeholder="nginx:latest"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ports">Port Mappings</Label>
            <Textarea
              id="ports"
              placeholder="8080:80&#10;443:443/tcp"
              value={ports}
              onChange={(e) => setPorts(e.target.value)}
              className="font-mono text-sm"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Format: hostPort:containerPort (one per line)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="environment">Environment Variables</Label>
            <Textarea
              id="environment"
              placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="font-mono text-sm"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Format: KEY=value (one per line)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="command">Command (optional)</Label>
            <Input
              id="command"
              placeholder="e.g., /bin/sh -c 'echo hello'"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="restart-policy">Restart Policy</Label>
            <Select value={restartPolicy} onValueChange={setRestartPolicy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="always">Always</SelectItem>
                <SelectItem value="on-failure">On Failure</SelectItem>
                <SelectItem value="unless-stopped">Unless Stopped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create Service"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};