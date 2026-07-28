import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    createShare,
    deleteShare,
    listFileShares,
    listShares,
    type CreateShareInput,
} from "@/lib/api/shares";

export function useShares() {
    return useQuery({
        queryKey: ["shares"],
        queryFn: listShares,
    });
}

export function useFileShares(fileId: string | null) {
    return useQuery({
        queryKey: ["shares", "file", fileId ?? "none"],
        queryFn: () => listFileShares(fileId as string),
        enabled: !!fileId,
    });
}

export function useCreateShare() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ fileId, payload }: { fileId: string; payload: CreateShareInput }) =>
            createShare(fileId, payload),
        onSuccess: (_share, variables) => {
            queryClient.invalidateQueries({ queryKey: ["shares"] });
            queryClient.invalidateQueries({ queryKey: ["shares", "file", variables.fileId] });
        },
    });
}

export function useDeleteShare() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteShare(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["shares"] });
        },
    });
}
