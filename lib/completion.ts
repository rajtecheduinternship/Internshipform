/** Completion always follows published course → module → active video.
 * Callers must pass only the published curriculum. Empty modules are pending,
 * never complete; newly published lessons therefore reopen current completion.
 * Historical per-video completion is retained when content is hidden/restored.
 */
export function summarizeCompletion(modules: { videos: { progress?: { is_completed?: boolean } | null }[] }[]) {
  const summaries = modules.map((module) => {
    const total = module.videos.length;
    const completed = module.videos.filter((v) => v.progress?.is_completed).length;
    return { total_videos: total, completed_videos: completed, is_completed: total > 0 && completed === total };
  });
  const total = summaries.reduce((n, m) => n + m.total_videos, 0);
  const completed = summaries.reduce((n, m) => n + m.completed_videos, 0);
  const pendingEmpty = summaries.filter((m) => m.total_videos === 0).length;
  const isCompleted = modules.length > 0 && summaries.every((m) => m.is_completed);
  return {
    modules: summaries,
    total_modules: modules.length,
    completed_modules: summaries.filter((m) => m.is_completed).length,
    total_videos: total,
    completed_videos: completed,
    percentage: total + pendingEmpty ? Math.min(isCompleted ? 100 : 99, Math.round(completed / (total + pendingEmpty) * 100)) : 0,
    is_completed: isCompleted,
  };
}
