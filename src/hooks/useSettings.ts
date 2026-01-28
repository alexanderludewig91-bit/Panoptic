import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllSettings,
  setSetting,
  updateDataPath,
  isSetupCompleted,
  completeSetup,
  verifyPassword,
  setMasterPassword,
  databaseExistsAt,
  getDatabaseInfo,
  getDatabaseInfoAt,
  switchToExistingDatabase,
  type AppSettings,
  type DataPathUpdateResult,
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
    mutationFn: async (params: { path: string; overwrite?: boolean }): Promise<DataPathUpdateResult> => {
      return await updateDataPath(params.path, { overwrite: params.overwrite });
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["settings"] });
      }
    },
  });
}

export function useCheckDatabaseExists() {
  return useMutation({
    mutationFn: databaseExistsAt,
  });
}

export function useDatabaseInfo() {
  return useQuery({
    queryKey: ["database", "info"],
    queryFn: getDatabaseInfo,
  });
}

export function useGetDatabaseInfoAt() {
  return useMutation({
    mutationFn: getDatabaseInfoAt,
  });
}

export function useSwitchToExistingDatabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: switchToExistingDatabase,
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate all queries to refresh with new database
        queryClient.invalidateQueries();
      }
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
