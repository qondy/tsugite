import {
  collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { Project } from './types';

export const INBOX_TITLE = 'Inbox（未整理）';

function toProject(id: string, data: DocumentData): Project {
  return {
    id,
    title: data.title,
    order: data.order ?? 0,
    archived: data.archived ?? false,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export function subscribeProjects(uid: string, callback: (projects: Project[]) => void): () => void {
  const q = query(collection(db, 'users', uid, 'projects'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => toProject(d.id, d.data())));
  });
}

export function createProject(uid: string, title: string, order: number): Promise<string> {
  return addDoc(collection(db, 'users', uid, 'projects'), {
    title,
    order,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).then((ref) => ref.id);
}

export function renameProject(uid: string, projectId: string, title: string): Promise<void> {
  return updateDoc(doc(db, 'users', uid, 'projects', projectId), {
    title,
    updatedAt: serverTimestamp(),
  });
}

export function archiveProject(uid: string, projectId: string, archived: boolean): Promise<void> {
  return updateDoc(doc(db, 'users', uid, 'projects', projectId), {
    archived,
    updatedAt: serverTimestamp(),
  });
}

export function deleteProject(uid: string, projectId: string): Promise<void> {
  return deleteDoc(doc(db, 'users', uid, 'projects', projectId));
}
