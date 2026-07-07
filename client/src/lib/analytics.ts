export const track = (name: string, props?: Record<string, unknown>) => {
  // plug your analytics here (PostHog/GA/etc.)
  console.debug("[analytics]", name, props);
};

// Upload-specific tracking helpers  
export const trackUploadStart = (files: number, estimatedBytes?: number) => {
  track('upload_start', { files, est_bytes: estimatedBytes });
};

export const trackUploadDone = (files: number, durationMs: number, totalBytes?: number) => {
  track('upload_done', { files, ms: durationMs, total_bytes: totalBytes });
};

export const trackReportSubmit = (hasPhotos: boolean, type?: string, isAnonymous?: boolean) => {
  track('report_submit', { has_photos: hasPhotos, type, anon: isAnonymous });
};

export const trackReportAbandon = (hasPhotos: boolean, type?: string) => {
  track('report_abandon', { has_photos: hasPhotos, type });
};