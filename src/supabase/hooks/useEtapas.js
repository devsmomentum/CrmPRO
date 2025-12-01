import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getEtapas, createEtapa } from "../services/etapas"

export function useEtapas(pipelineId) {
  return useQuery({
    queryKey: ["etapas", pipelineId],
    queryFn: () => getEtapas(pipelineId),
    enabled: !!pipelineId,
  })
}

export function useCreateEtapa() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: createEtapa,
    onSuccess: () => client.invalidateQueries(["etapas"]),
  })
}
