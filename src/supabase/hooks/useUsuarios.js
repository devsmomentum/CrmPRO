import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getUsuarios, createUsuario } from "../services/usuarios"

export function useUsuarios() {
  return useQuery({
    queryKey: ["usuarios"],
    queryFn: getUsuarios,
  })
}

export function useCreateUsuario() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: createUsuario,
    onSuccess: () => client.invalidateQueries(["usuarios"]),
  })
}
