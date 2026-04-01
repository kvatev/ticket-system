import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft, Hash, Users, Copy, UserPlus, Send, Paperclip, X,
  Loader2, MessageSquare, Trash2, Download,
} from "lucide-react";
import { format } from "date-fns";
import { bg } from "date-fns/locale";

export default function ChannelDetailPage() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  const [postContent, setPostContent] = useState("");
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [commentFiles, setCommentFiles] = useState<Record<string, File[]>>({});
  const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null);

  // Channel info
  const { data: channel } = useQuery({
    queryKey: ["channel", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("channels").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Members
  const { data: members } = useQuery({
    queryKey: ["channel-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_members")
        .select("*")
        .eq("channel_id", id!);
      if (error) throw error;
      const uids = data.map((m: any) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", uids);
      const pMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]));
      return data.map((m: any) => ({ ...m, profile: pMap[m.user_id] ?? {} }));
    },
    enabled: !!id,
  });

  // Posts
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["channel-posts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_posts")
        .select("*")
        .eq("channel_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const uids = [...new Set(data.map((p: any) => p.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", uids);
      const pMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
      return data.map((p: any) => ({ ...p, author_name: pMap[p.user_id] ?? "—" }));
    },
    enabled: !!id,
  });

  // Comments for all posts
  const { data: allComments } = useQuery({
    queryKey: ["channel-comments", id],
    queryFn: async () => {
      if (!posts?.length) return [];
      const postIds = posts.map((p) => p.id);
      const { data, error } = await supabase
        .from("channel_comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const uids = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", uids);
      const pMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
      return data.map((c: any) => ({ ...c, author_name: pMap[c.user_id] ?? "—" }));
    },
    enabled: !!posts?.length,
  });

  // Attachments
  const { data: attachments } = useQuery({
    queryKey: ["channel-attachments", id],
    queryFn: async () => {
      if (!posts?.length) return [];
      const { data, error } = await supabase.from("channel_attachments").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!posts?.length,
  });

  // All profiles for adding members
  const { data: allProfiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true);
      return data ?? [];
    },
  });

  // Realtime for posts & comments
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`channel-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_posts", filter: `channel_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["channel-posts", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_comments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["channel-comments", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, queryClient]);

  const isOwner = channel?.created_by === user?.id || role === "admin";

  // Create post
  const createPost = useMutation({
    mutationFn: async () => {
      if (!user || !postContent.trim()) return;
      const { data: post, error } = await supabase
        .from("channel_posts")
        .insert({ channel_id: id!, user_id: user.id, content: postContent.trim() })
        .select()
        .single();
      if (error) throw error;

      for (const file of postFiles) {
        const path = `${id}/${post.id}/${crypto.randomUUID()}-${file.name}`;
        await supabase.storage.from("channel-attachments").upload(path, file);
        await supabase.from("channel_attachments").insert({
          entity_type: "post",
          entity_id: post.id,
          file_name: file.name,
          file_path: path,
          file_type: file.type,
          file_size: file.size,
          user_id: user.id,
        });
      }
      return post;
    },
    onSuccess: () => {
      setPostContent("");
      setPostFiles([]);
      queryClient.invalidateQueries({ queryKey: ["channel-posts", id] });
      queryClient.invalidateQueries({ queryKey: ["channel-attachments", id] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Create comment
  const createComment = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) return;
      const text = commentTexts[postId]?.trim();
      if (!text) return;
      const { data: comment, error } = await supabase
        .from("channel_comments")
        .insert({ post_id: postId, user_id: user.id, content: text })
        .select()
        .single();
      if (error) throw error;

      const cFiles = commentFiles[postId] ?? [];
      for (const file of cFiles) {
        const path = `${id}/${postId}/${crypto.randomUUID()}-${file.name}`;
        await supabase.storage.from("channel-attachments").upload(path, file);
        await supabase.from("channel_attachments").insert({
          entity_type: "comment",
          entity_id: comment.id,
          file_name: file.name,
          file_path: path,
          file_type: file.type,
          file_size: file.size,
          user_id: user.id,
        });
      }
      return comment;
    },
    onSuccess: (_, postId) => {
      setCommentTexts((prev) => ({ ...prev, [postId]: "" }));
      setCommentFiles((prev) => ({ ...prev, [postId]: [] }));
      queryClient.invalidateQueries({ queryKey: ["channel-comments", id] });
      queryClient.invalidateQueries({ queryKey: ["channel-attachments", id] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Add member
  const addMember = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) return;
      const { error } = await supabase.from("channel_members").insert({
        channel_id: id!,
        user_id: selectedUserId,
      });
      if (error) {
        if (error.message.includes("duplicate")) throw new Error("Потребителят вече е член.");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-members", id] });
      toast.success("Потребителят е добавен.");
      setSelectedUserId("");
      setAddMemberOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("channel_posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channel-posts", id] }),
  });

  const downloadFile = async (path: string, name: string) => {
    const { data } = await supabase.storage.from("channel-attachments").download(path);
    if (!data) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const memberUserIds = new Set(members?.map((m) => m.user_id) ?? []);
  const availableProfiles = allProfiles?.filter((p) => !memberUserIds.has(p.user_id)) ?? [];

  if (!channel) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <Button variant="ghost" onClick={() => navigate("/channels")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Назад
      </Button>

      {/* Channel header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-primary" />
                {channel.name}
              </CardTitle>
              {channel.description && <p className="mt-1 text-sm text-muted-foreground">{channel.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <>
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText(channel.invite_code);
                    toast.success("Кодът е копиран!");
                  }}>
                    <Copy className="mr-1 h-3 w-3" /> {channel.invite_code}
                  </Button>
                  <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><UserPlus className="mr-1 h-3 w-3" /> Добави</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Добавяне на член</DialogTitle></DialogHeader>
                      <form onSubmit={(e) => { e.preventDefault(); addMember.mutate(); }} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Потребител</Label>
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            required
                          >
                            <option value="">Изберете...</option>
                            {availableProfiles.map((p) => (
                              <option key={p.user_id} value={p.user_id}>{p.full_name} ({p.email})</option>
                            ))}
                          </select>
                        </div>
                        <Button type="submit" disabled={addMember.isPending} className="w-full">
                          {addMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Добави
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {members?.map((m) => (
              <Badge key={m.id} variant="secondary" className="text-xs">
                {(m as any).profile?.full_name ?? "—"}
                {m.role === "admin" && " ★"}
              </Badge>
            ))}
          </div>
        </CardHeader>
      </Card>

      {/* New post */}
      <Card>
        <CardContent className="pt-4">
          <form onSubmit={(e) => { e.preventDefault(); createPost.mutate(); }} className="space-y-3">
            <Textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="Напишете пост..."
              className="min-h-[80px]"
            />
            <div className="flex flex-wrap gap-2">
              {postFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button type="button" onClick={() => setPostFiles((prev) => prev.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="mr-1 h-3 w-3" /> Файл
              </Button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => {
                if (e.target.files) setPostFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
              }} />
              <Button type="submit" size="sm" disabled={createPost.isPending || !postContent.trim()}>
                {createPost.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
                Публикувай
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Posts */}
      {postsLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !posts?.length ? (
        <p className="text-center text-sm text-muted-foreground py-8">Няма постове все още.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const postComments = allComments?.filter((c) => c.post_id === post.id) ?? [];
            const postAttachments = attachments?.filter((a) => a.entity_type === "post" && a.entity_id === post.id) ?? [];
            const cText = commentTexts[post.id] ?? "";
            const cFiles = commentFiles[post.id] ?? [];

            return (
              <Card key={post.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{(post as any).profiles?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(post.created_at), "dd MMM yyyy, HH:mm", { locale: bg })}</p>
                    </div>
                    {(post.user_id === user?.id || role === "admin") && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                        if (confirm("Изтриване?")) deletePost.mutate(post.id);
                      }}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                  {postAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {postAttachments.map((a) => (
                        <Button key={a.id} variant="outline" size="sm" className="h-7 text-xs" onClick={() => downloadFile(a.file_path, a.file_name)}>
                          <Download className="mr-1 h-3 w-3" /> {a.file_name}
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Comments */}
                  {postComments.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2 pl-4 border-l-2 border-border">
                        {postComments.map((c) => {
                          const cAttachments = attachments?.filter((a) => a.entity_type === "comment" && a.entity_id === c.id) ?? [];
                          return (
                            <div key={c.id}>
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs font-medium text-foreground">{(c as any).profiles?.full_name ?? "—"}</span>
                                <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "dd MMM, HH:mm", { locale: bg })}</span>
                              </div>
                              <p className="text-xs whitespace-pre-wrap">{c.content}</p>
                              {cAttachments.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {cAttachments.map((a) => (
                                    <Button key={a.id} variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => downloadFile(a.file_path, a.file_name)}>
                                      <Download className="mr-1 h-2.5 w-2.5" /> {a.file_name}
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Comment input */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Input
                        value={cText}
                        onChange={(e) => setCommentTexts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="Коментар..."
                        className="h-8 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && cText.trim()) {
                            e.preventDefault();
                            createComment.mutate(post.id);
                          }
                        }}
                      />
                      {cFiles.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cFiles.map((f, i) => (
                            <span key={i} className="flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                              {f.name}
                              <button onClick={() => setCommentFiles((prev) => ({
                                ...prev,
                                [post.id]: (prev[post.id] ?? []).filter((_, j) => j !== i),
                              }))}>
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {
                      setActiveCommentPost(post.id);
                      commentFileInputRef.current?.click();
                    }}>
                      <Paperclip className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={!cText.trim() || createComment.isPending}
                      onClick={() => createComment.mutate(post.id)}
                    >
                      <MessageSquare className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <input ref={commentFileInputRef} type="file" multiple className="hidden" onChange={(e) => {
        if (e.target.files && activeCommentPost) {
          setCommentFiles((prev) => ({
            ...prev,
            [activeCommentPost]: [...(prev[activeCommentPost] ?? []), ...Array.from(e.target.files!)],
          }));
        }
      }} />
    </div>
  );
}
