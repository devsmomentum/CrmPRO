import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getPanel, createPanel } from "../services/panel"

export function usePanel(empresaId) {
  return useQuery({
    queryKey: ["panel", empresaId],
    queryFn: () => getPanel(empresaId),
    enabled: !!empresaId,
  })
}

export function useCreatePanel() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: createPanel,
    onSuccess: () => client.invalidateQueries(["panel"]),
  })
}
