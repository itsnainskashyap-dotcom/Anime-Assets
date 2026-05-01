import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bug, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";

export default function AdminErrorLibrary() {
  const { api } = useAuth();
  const [search, setSearch] = useState("");

  const { data: errors = [], isLoading } = useQuery({
    queryKey: ["admin-errors"],
    queryFn: () => api("/api/admin/error-library").then(res => res.json()).catch(() => []),
  });

  const filteredErrors = errors.filter((e: any) => 
    e.code?.toLowerCase().includes(search.toLowerCase()) || 
    e.message?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Error Library</h1>
          <p className="text-muted-foreground mt-1">Known system errors and their resolution strategies.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by error code or message..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
      </div>

      <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground border-b border-border/50">
            <tr>
              <th className="px-4 py-3 font-medium">Error Code</th>
              <th className="px-4 py-3 font-medium">Message Pattern</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Resolution Strategy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : filteredErrors.length > 0 ? (
              filteredErrors.map((error: any, i: number) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs text-destructive">{error.code}</td>
                  <td className="px-4 py-3 font-medium">{error.message}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{error.category || 'System'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{error.resolution || 'Manual intervention required.'}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No errors documented in library.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
