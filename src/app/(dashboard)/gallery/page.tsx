"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/data-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

type Album = { id: string; title: string; description?: string; coverUrl?: string; photos: any[] };

export default function GalleryPage() {
  const { addToast } = useToast();
  const [albums, setAlbums] = React.useState<Album[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"photos" | "videos">("photos");

  const load = async () => {
    const res = await fetch("/api/gallery/albums");
    setAlbums(await res.json());
  };

  React.useEffect(() => { load(); }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body = Object.fromEntries(formData.entries());
    await fetch("/api/gallery/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setModalOpen(false);
    load();
    addToast({ type: "success", title: "تم إنشاء الألبوم" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="مكتبة الصور والفيديو"
        description="إدارة ومشاركة الصور والفیديوهات"
        actions={tab === "photos" && <Button onClick={() => setModalOpen(true)}>ألبوم جديد</Button>}
      />

      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "photos" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          onClick={() => setTab("photos")}
        >الصور</button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "videos" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          onClick={() => setTab("videos")}
        >الفيديو</button>
      </div>

      {tab === "photos" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <Link href={`/gallery/${album.id}`} key={album.id}>
              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-40 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  {album.coverUrl ? (
                    <img src={album.coverUrl} alt={album.title} className="h-full w-full object-cover" />
                  ) : (
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21M3 13a9 9 0 1 1 9-9M9 7h.01" />
                    </svg>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{album.title}</h3>
                  {album.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{album.description}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <Badge variant="secondary">{album.photos.length} صورة</Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          مكتبة الفيديو - قريباً
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="ألبوم جديد">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="title">عنوان الألبوم *</Label><Input id="title" name="title" required /></div>
          <div className="space-y-2"><Label htmlFor="description">الوصف</Label><Textarea id="description" name="description" rows={3} /></div>
          <div className="space-y-2"><Label htmlFor="coverUrl">رابط صورة الغلاف</Label><Input id="coverUrl" name="coverUrl" type="url" placeholder="https://..." /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
            <Button type="submit">حفظ</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
