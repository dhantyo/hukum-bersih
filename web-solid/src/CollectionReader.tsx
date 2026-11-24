import { For } from 'solid-js';
import { MergedLaw } from './MergedLaw';
import type { getCollection } from './lib/collections';
import './reader.css';

type Collection = NonNullable<Awaited<ReturnType<typeof getCollection>>>;

export function CollectionReader(props: { collection: Collection }) {
  return <main>
    <a href="/koleksi/">Koleksi</a>
    <h1>{props.collection.name}</h1>
    <p>{props.collection.title}</p>
    <h2 id="riwayat">Riwayat</h2>
    <ol><For each={props.collection.members}>{(member) => <li>
      <span>{member.role}</span>{' · '}
      {member.law ? <a href={member.law.u}>{member.law.c} · {member.law.t}</a> : member.id}
    </li>}</For></ol>
      {props.collection.merged && <MergedLaw version={props.collection.merged} />}
  </main>;
}
