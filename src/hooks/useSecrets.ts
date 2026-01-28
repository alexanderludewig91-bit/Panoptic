import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllSecrets,
  getSecretById,
  createSecret,
  updateSecret,
  deleteSecret,
  searchSecrets,
  type Secret,
} from "@/lib/secrets";

export function useSecrets() {
  return useQuery({
    queryKey: ["secrets"],
    queryFn: getAllSecrets,
  });
}

export function useSecret(id: string) {
  return useQuery({
    queryKey: ["secrets", id],
    queryFn: () => getSecretById(id),
    enabled: !!id,
  });
}

export function useSearchSecrets(query: string) {
  return useQuery({
    queryKey: ["secrets", "search", query],
    queryFn: () => (query ? searchSecrets(query) : getAllSecrets()),
    staleTime: 0,
  });
}

export function useCreateSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: Omit<Secret, "id" | "createdAt" | "rotatedAt" | "lastUsedAt">
    ) => createSecret(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secrets"] });
    },
  });
}

export function useUpdateSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Pick<Secret, "name" | "category" | "provider" | "value">>;
    }) => updateSecret(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["secrets"] });
      queryClient.invalidateQueries({ queryKey: ["secrets", variables.id] });
    },
  });
}

export function useDeleteSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSecret,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secrets"] });
    },
  });
}
