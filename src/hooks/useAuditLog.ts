import { useQuery } from "@tanstack/react-query";
import { getAuditLog, getAuditLogCount } from "@/lib/audit";

export function useAuditLog(options?: {
  limit?: number;
  offset?: number;
  action?: string;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  return useQuery({
    queryKey: ["auditLog", options],
    queryFn: () => getAuditLog(options),
  });
}

export function useAuditLogCount(options?: {
  action?: string;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  return useQuery({
    queryKey: ["auditLogCount", options],
    queryFn: () => getAuditLogCount(options),
  });
}
