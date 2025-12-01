import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getEquipos, createEquipo } from "../services/equipos"

export function useEquipos(empresaId) {
  return useQuery({
    queryKey: ["equipos", empresaId],
    queryFn: () => getEquipos(empresaId),
    enabled: !!empresaId,
  })
}

export function useCreateEquipo() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: createEquipo,
    onSuccess: () => client.invalidateQueries(["equipos"]),
  })
}
