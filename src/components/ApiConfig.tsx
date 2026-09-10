import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import type { ApiConfig as ApiConfigType } from "@/types/traffic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";

interface Props {
  config: ApiConfigType;
  onChange: (c: ApiConfigType) => void;
}

export function ApiConfig({ config, onChange }: Props) {
  const [show, setShow] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-accent" /> API Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>API URL</Label>
          <Input
            value={config.apiUrl}
            onChange={(e) => onChange({ ...config, apiUrl: e.target.value })}
            spellCheck={false}
          />
        </div>
        <div>
          <Label>API Key (x-api-key)</Label>
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={config.apiKey}
              placeholder={config.mode === "mock" ? "not needed in mock mode" : "paste key…"}
              onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
              spellCheck={false}
              className="pr-9"
            />
            <button
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              aria-label="Toggle key visibility"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <p className="text-[11px] leading-snug text-text-muted">
          The key defaults from{" "}
          <code className="text-text-secondary">VITE_TRAFFIC_API_KEY</code> in{" "}
          <code className="text-text-secondary">.env</code>. Any key sent from a
          browser is visible to the client — proxy through a backend for
          production.
        </p>
      </CardContent>
    </Card>
  );
}
