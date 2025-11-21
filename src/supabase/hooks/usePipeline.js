import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getPipelines, createPipeline } from "../services/pipeline"

export function usePipeline(empresaId) {
  return useQuery({
    queryKey: ["pipeline", empresaId],
    queryFn: () => getPipelines(empresaId),
    enabled: !!empresaId,
  })
}

export function useCreatePipeline() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: createPipeline,
    onSuccess: () => client.invalidateQueries(["pipeline"]),
  })
}
