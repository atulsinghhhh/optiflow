import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getMe, updateMe } from "@/lib/api/me";

export function useMe() {
    return useQuery({
        queryKey: ["me"],
        queryFn: getMe,
        retry: false,
    });
}

export function useUpdateMe() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateMe,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["me"] });
        },
    });
}
