import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, Image, ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { LANDING_SECTIONS, type LandingBackground } from '@shared/schema';

export default function LandingBackgrounds() {
  const { toast } = useToast();
  const [uploadingSection, setUploadingSection] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: backgrounds = [], isLoading } = useQuery<LandingBackground[]>({
    queryKey: ['/api/landing-backgrounds'],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ sectionId, file }: { sectionId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sectionId', sectionId);

      const res = await fetch('/api/admin/landing-backgrounds', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/landing-backgrounds'] });
      toast({ title: 'Background uploaded', description: 'The background image has been updated.' });
      setUploadingSection(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
      setUploadingSection(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      await apiRequest('DELETE', `/api/admin/landing-backgrounds/${sectionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/landing-backgrounds'] });
      toast({ title: 'Background removed' });
    },
    onError: (err: Error) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleFileSelect = (sectionId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file.', variant: 'destructive' });
      return;
    }
    setUploadingSection(sectionId);
    uploadMutation.mutate({ sectionId, file });
  };

  const getBgForSection = (sectionId: string) => {
    return backgrounds.find(bg => bg.sectionId === sectionId);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/access">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Landing Page Backgrounds
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Upload background images for each section of the landing page.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {LANDING_SECTIONS.map(section => {
          const bg = getBgForSection(section.id);
          const isUploading = uploadingSection === section.id;

          return (
            <Card key={section.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{section.label}</span>
                  <span className="text-xs font-normal text-slate-400">{section.id}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {bg ? (
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img
                      src={bg.imageUrl}
                      alt={`${section.label} background`}
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-2 right-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1 text-xs"
                        disabled={isUploading}
                        onClick={() => fileInputRefs.current[section.id]?.click()}
                      >
                        {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        Replace
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1 text-xs"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(section.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors cursor-pointer"
                    onClick={() => fileInputRefs.current[section.id]?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
                    ) : (
                      <Image className="h-8 w-8 text-slate-400" />
                    )}
                    <span className="text-sm text-slate-500">
                      {isUploading ? 'Uploading...' : 'Click to upload background image'}
                    </span>
                  </button>
                )}

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  ref={el => { fileInputRefs.current[section.id] = el; }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(section.id, file);
                    e.target.value = '';
                  }}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
