import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getPersonas, createPersona } from "../services/persona"

export function usePersona(equipoId) {
  return useQuery({
    queryKey: ["persona", equipoId],
    queryFn: () => getPersonas(equipoId),
    enabled: !!equipoId,
  })
}

export function useCreatePersona() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: createPersona,
    onSuccess: () => client.invalidateQueries(["persona"]),
  })
}
