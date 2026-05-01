import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import type { Chunk, CreateProjectInput, Project } from "@/types/api";

export const useProjects = () => {
  const { api } = useAuth();
  return useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => api("/api/projects").then(res => res.json() as Promise<Project[]>),
  });
};

export const useProject = (id: string) => {
  const { api } = useAuth();
  return useQuery<Project>({
    queryKey: ["projects", id],
    queryFn: () => api(`/api/projects/${id}`).then(res => res.json() as Promise<Project>),
    enabled: !!id,
  });
};

export const useProjectChunks = (projectId: string) => {
  const { api } = useAuth();
  return useQuery<Chunk[]>({
    queryKey: ["projects", projectId, "chunks"],
    queryFn: () => api(`/api/projects/${projectId}/chunks`).then(res => res.json() as Promise<Chunk[]>),
    enabled: !!projectId,
  });
};

export const useCreateProject = () => {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<Project, Error, CreateProjectInput>({
    mutationFn: (data) => api("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }).then(res => res.json() as Promise<Project>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};
