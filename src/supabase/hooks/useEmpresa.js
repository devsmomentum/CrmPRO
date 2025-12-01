import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getEmpresas, createEmpresa } from "../services/empresa"

export function useEmpresa() {
  return useQuery({
    queryKey: ["empresa"],
    queryFn: getEmpresas,
  })
}

export function useCreateEmpresa() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: createEmpresa,
    onSuccess: () => client.invalidateQueries(["empresa"]),
  })
}
