import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllSettings,
  setSetting,
  updateDataPath,
  isSetupCompleted,
  completeSetup,
  verifyPassword,
  setMasterPassword,
  type AppSettings,
} from "@/lib/settings";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: getAllSettings,
  });
}

export function useSetupCompleted() {
  return useQuery({
    queryKey: ["settings", "setupCompleted"],
    queryFn: isSetupCompleted,
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { key: keyof AppSettings; value: AppSettings[keyof AppSettings] }) => {
      await setSetting(params.key, params.value);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useUpdateDataPath() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDataPath,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useCompleteSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeSetup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useVerifyPassword() {
  return useMutation({
    mutationFn: verifyPassword,
  });
}

export function useSetMasterPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setMasterPassword,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
