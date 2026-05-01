import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export const useProjects = () => {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api("/api/projects").then(res => res.json()),
  });
};

export const useProject = (id: string) => {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => api(`/api/projects/${id}`).then(res => res.json()),
    enabled: !!id,
  });
};

export const useCreateProject = () => {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};
