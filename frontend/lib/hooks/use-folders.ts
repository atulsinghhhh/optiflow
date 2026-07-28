import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    createFolder,
    deleteFolder,
    getFolder,
    listFolders,
    updateFolder,
    type Folder,
} from "@/lib/api/folders";

const foldersKey = (parentId?: string) => ["folders", parentId ?? "root"] as const;
const folderKey = (id: string) => ["folder", id] as const;

export function useFolders(parentId?: string) {
    return useQuery({
        queryKey: foldersKey(parentId),
        queryFn: () => listFolders(parentId),
    });
}

export function useFolder(id: string | null) {
    return useQuery({
        queryKey: id ? folderKey(id) : ["folder", "none"],
        queryFn: () => getFolder(id as string),
        enabled: !!id,
    });
}

export function useCreateFolder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createFolder,
        onSuccess: (folder: Folder) => {
            queryClient.invalidateQueries({ queryKey: foldersKey(folder.parent_id ?? undefined) });
        },
    });
}

export function useUpdateFolder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: { name?: string; parent_id?: string | null } }) =>
            updateFolder(id, payload),
        onSuccess: (folder: Folder, variables) => {
            queryClient.invalidateQueries({ queryKey: folderKey(variables.id) });
            queryClient.invalidateQueries({ queryKey: foldersKey(folder.parent_id ?? undefined) });
            queryClient.invalidateQueries({ queryKey: ["folders"] });
        },
    });
}

export function useDeleteFolder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteFolder(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["folders"] });
            queryClient.invalidateQueries({ queryKey: ["files"] });
        },
    });
}
