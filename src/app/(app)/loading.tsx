/**
 * Squelette affiché instantanément pendant le chargement d'une page :
 * la barre latérale reste en place, le contenu arrive dès qu'il est prêt.
 * Next.js précharge ce squelette avec les liens, d'où une navigation immédiate.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Chargement">
      <div className="space-y-2">
        <div className="h-3 w-28 bg-slate-800" />
        <div className="h-8 w-48 bg-slate-800" />
      </div>
      <div className="h-14 bg-slate-900" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="space-y-2.5">
            <div className="aspect-[3/4] bg-slate-900" />
            <div className="h-4 w-3/4 bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
