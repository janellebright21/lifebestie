/** Serialize writes so a slow older save cannot overwrite a newer plan. */
export function createPlanSaveQueue<T>(write: (snapshot: T) => Promise<{ error: string | null }>) {
  let pending = Promise.resolve<{ error: string | null }>({ error: null });
  return (snapshot: T) => {
    pending = pending.then(async () => {
      try {
        return await write(snapshot);
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Could not save your plan.' };
      }
    });
    return pending;
  };
}
