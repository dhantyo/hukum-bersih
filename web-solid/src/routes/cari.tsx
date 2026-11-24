import { createFileRoute } from '@tanstack/solid-router';
import { createSignal, For } from 'solid-js';
import { getSearchRelease } from '../lib/search';

interface SearchHit {
  url: string;
  meta: { title?: string };
  sub_results: { title: string; url: string }[];
}

interface Pagefind {
  init(): Promise<void>;
  search(query: string): Promise<{ results: { data(): Promise<SearchHit> }[] }>;
}

function legalLink(url: string): boolean {
  return /^\/(?:uu|koleksi|ruu)\/[a-z0-9./_-]+(?:#[a-z0-9_.:%-]+)?$/i.test(url);
}

export const Route = createFileRoute('/cari')({
  loader: () => getSearchRelease(),
  head: () => ({ meta: [{ title: 'Cari | Hukum Bersih' }] }),
  component: SearchPage,
});

function SearchPage() {
  const release = Route.useLoaderData();
  const [hits, setHits] = createSignal<SearchHit[]>([]);
  const [message, setMessage] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  let index: { release: string; pagefind: Promise<Pagefind> } | undefined;

  async function search(event: SubmitEvent) {
    if (!(event.currentTarget instanceof HTMLFormElement)) return;
    event.preventDefault();
    const query = new FormData(event.currentTarget).get('q');
    if (typeof query !== 'string' || !query.trim() || busy()) return;
    setBusy(true);
    try {
      const currentRelease = release();
      if (index?.release !== currentRelease) {
        index = { release: currentRelease, pagefind: loadIndex(currentRelease) };
      }
      const { results } = await (await index.pagefind).search(query.trim());
      const matches = await Promise.all(results.slice(0, 10).map((result) => result.data()));
      const legalHits = matches.filter((match) => legalLink(match.url));
      setHits(legalHits);
      setMessage(legalHits.length ? '' : 'Tidak ada hasil.');
    } catch (error) {
      console.error('Pagefind search failed', error);
      index = undefined;
      setHits([]);
      setMessage('Pencarian gagal. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return <main>
    <h1>Cari teks hukum</h1>
    <form onSubmit={search} role="search">
      <label for="search-query">Kata kunci</label>
      <input id="search-query" name="q" type="search" required />
      <button type="submit" disabled={busy()}>Cari</button>
    </form>
    <p role="status">{message()}</p>
    <ul><For each={hits()}>{(hit) => <SearchResult hit={hit} />}</For></ul>
  </main>;
}

async function loadIndex(release: string): Promise<Pagefind> {
  const modulePath = `/search-index/${release}/pagefind.js`;
  const pagefind: Pagefind = await import(/* @vite-ignore */ modulePath);
  await pagefind.init();
  return pagefind;
}

function SearchResult(props: { hit: SearchHit }) {
  return <li>
    <a href={props.hit.url}>{props.hit.meta.title ?? props.hit.url}</a>
    <ul><For each={props.hit.sub_results.filter((article) => legalLink(article.url))}>{(article) =>
      <li><a href={article.url}>{article.title}</a></li>
    }</For></ul>
  </li>;
}
